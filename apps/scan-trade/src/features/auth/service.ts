import { z } from 'zod';
import type { MarketType, TradingStyle } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getCoreEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getMailer } from '@/lib/mail';
import { emailSchema, hashPassword, passwordSchema, verifyPassword } from '@/lib/auth/password';
import { PASSWORD_RESET_TTL_MINUTES, generateResetToken, hashToken } from '@/lib/auth/tokens';
import { getStorage } from '@/lib/storage';
import { cancelSubscriptionForUser } from '@/features/billing/service';

/** Account lifecycle: registration, password recovery, deletion (§22 / §26). */

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(80).optional(),
});

export const onboardingSchema = z.object({
  market: z.enum(['CRYPTO', 'FOREX', 'INDICES', 'STOCKS', 'COMMODITIES', 'OTHER']).nullable(),
  style: z.enum(['SCALPING', 'DAY_TRADING', 'SWING_TRADING', 'OTHER']).nullable(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export async function registerUser(input: z.infer<typeof registerSchema>): Promise<{ id: string; email: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    // Registration is the one place where revealing that an address is taken is
    // unavoidable — the alternative is an account the user cannot access.
    throw new AppError('conflict', 'Un compte existe déjà avec cette adresse e-mail.');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name ?? null,
      passwordHash,
      subscription: { create: { status: 'NONE' } },
    },
    select: { id: true, email: true },
  });

  logger.info('auth.registered', { userId: user.id });
  return user;
}

export async function completeOnboarding(
  userId: string,
  input: { market: MarketType | null; style: TradingStyle | null },
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      marketPreference: input.market,
      tradingStyle: input.style,
      onboardedAt: new Date(),
    },
  });
}

/**
 * Starts a password reset.
 *
 * Always resolves the same way, whether or not the address exists: an
 * enumeration oracle on this endpoint would leak the customer list.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) {
    logger.info('auth.password_reset.unknown_email');
    return;
  }

  // One live token per user: requesting a new link invalidates the previous one.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { token, tokenHash, expiresAt } = generateResetToken();
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  const resetUrl = `${getCoreEnv().APP_URL}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;

  try {
    await getMailer().sendPasswordReset({
      to: user.email,
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    });
    logger.info('auth.password_reset.sent', { userId: user.id });
  } catch (error) {
    logger.error('auth.password_reset.delivery_failed', { userId: user.id, error });
    // Reported as success to the caller: the token exists, and surfacing the
    // failure would still tell an attacker the address is registered.
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new AppError('validation_error', 'Ce lien de réinitialisation est invalide ou a expiré.');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Every existing session is revoked: a reset is often a response to a
    // compromise.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  logger.info('auth.password_reset.completed', { userId: record.userId });
}

export async function changePassword(
  userId: string,
  input: z.infer<typeof changePasswordSchema>,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw AppError.notFound();

  if (!user.passwordHash) {
    throw new AppError(
      'validation_error',
      "Ce compte n'a pas de mot de passe : il a été créé via Google. Utilise « mot de passe oublié » pour en définir un.",
    );
  }

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) throw new AppError('validation_error', 'Le mot de passe actuel est incorrect.');

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
  logger.info('auth.password_changed', { userId });
}

/**
 * Deletes an account and everything attached to it (§44).
 *
 * Order matters: stored images are removed first, because once the rows are
 * gone we no longer know which objects belonged to this user.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const analyses = await prisma.analysis.findMany({
    where: { userId },
    select: { id: true, imageKey: true },
  });

  const storage = getStorage();
  let failedObjects = 0;
  for (const analysis of analyses) {
    try {
      await storage.remove(analysis.imageKey);
    } catch (error) {
      failedObjects += 1;
      logger.error('account.delete.image_failed', { userId, analysisId: analysis.id, error });
    }
  }

  await cancelSubscriptionForUser(userId);

  // Cascades remove analyses, levels, reasoning, sessions, accounts, tokens.
  await prisma.user.delete({ where: { id: userId } });

  logger.info('account.deleted', { userId, analyses: analyses.length, failedObjects });
}
