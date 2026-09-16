import { randomBytes } from 'node:crypto';
import type { InvestorProfile, NotificationPreferences, PublicUser } from '@nova/types';
import type { InvestorProfileInput, UpdateProfileInput } from '@nova/validation';
import type { Env } from '../../config/env.js';
import type { Database } from '../../infrastructure/database/prisma.js';
import { badRequest, notFound } from '../../http/errors.js';
import type { AuditLogService } from '../audit-logs/audit-log.service.js';
import { hashPassword } from '../auth/password.js';
import { hashToken } from '../auth/tokens.js';
import type { MailProvider } from '../../services/mail/providers/index.js';
import { horizonToDb, toInvestorProfile, toPublicUser, type ApiHorizon } from './user.mapper.js';

/** User profile, investor profile, notification preferences and password reset. */
export class UserService {
  constructor(
    private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly env: Env,
    private readonly mail: MailProvider,
  ) {}

  /**
   * Starts a password reset.
   *
   * Runs the same way whether or not the account exists, and returns nothing either way: the
   * caller always answers 202 with a constant message, so the endpoint cannot be used to
   * enumerate registered addresses.
   */
  async requestPasswordReset(email: string, ipHash: string | null): Promise<void> {
    const user = await this.db.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) return;

    // Invalidate any reset already in flight: only the latest link works.
    await this.db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.env.PASSWORD_RESET_TTL_MINUTES * 60_000);

    await this.db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    });

    const link = `${this.env.APP_DEEP_LINK_BASE}reset-password?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: 'Réinitialiser votre mot de passe NOVA',
      text: [
        `Bonjour ${user.firstName},`,
        '',
        'Vous avez demandé à réinitialiser votre mot de passe NOVA.',
        `Ce lien est valable ${this.env.PASSWORD_RESET_TTL_MINUTES} minutes :`,
        link,
        '',
        'Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer ce message : votre mot de passe reste inchangé.',
        '',
        'L’équipe NOVA',
      ].join('\n'),
    });

    await this.auditLog.record({
      userId: user.id,
      action: 'auth.password_reset_requested',
      resource: 'user',
      resourceId: user.id,
      ipHash,
    });
  }

  /** Completes a password reset and ends every existing session. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await this.db.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!stored || stored.usedAt || stored.expiresAt <= new Date()) {
      throw badRequest('Ce lien de réinitialisation est invalide ou a expiré.');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: stored.userId }, data: { passwordHash } });
      await tx.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      });
      // A password reset must invalidate sessions an attacker may already hold.
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.auditLog.record({
      userId: stored.userId,
      action: 'auth.password_reset_completed',
      resource: 'user',
      resourceId: stored.userId,
    });
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.db.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw notFound('Compte introuvable');
    return toPublicUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    const user = await this.db.user.update({
      where: { id: userId },
      data: {
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.contentDepth ? { contentDepth: input.contentDepth } : {}),
      },
    });
    return toPublicUser(user);
  }

  async getInvestorProfile(userId: string): Promise<InvestorProfile | null> {
    const profile = await this.db.investorProfile.findUnique({ where: { userId } });
    return profile ? toInvestorProfile(profile) : null;
  }

  /** Creates or updates the investor profile; onboarding sends the whole object. */
  async upsertInvestorProfile(
    userId: string,
    input: InvestorProfileInput,
  ): Promise<InvestorProfile> {
    const data = {
      investmentGoal: input.investmentGoal,
      investmentHorizon: horizonToDb(input.investmentHorizon as ApiHorizon),
      experienceLevel: input.experienceLevel,
      riskTolerance: input.riskTolerance,
      knowledgeLevel: input.knowledgeLevel ?? input.experienceLevel,
      interestedAssetTypes: input.interestedAssetTypes,
    };

    const profile = await this.db.investorProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return toInvestorProfile(profile);
  }

  async patchInvestorProfile(
    userId: string,
    input: Partial<InvestorProfileInput>,
  ): Promise<InvestorProfile> {
    const existing = await this.db.investorProfile.findUnique({ where: { userId } });
    if (!existing) {
      throw notFound('Profil investisseur introuvable. Terminez d’abord l’onboarding.');
    }
    const profile = await this.db.investorProfile.update({
      where: { userId },
      data: {
        ...(input.investmentGoal ? { investmentGoal: input.investmentGoal } : {}),
        ...(input.investmentHorizon
          ? { investmentHorizon: horizonToDb(input.investmentHorizon as ApiHorizon) }
          : {}),
        ...(input.experienceLevel ? { experienceLevel: input.experienceLevel } : {}),
        ...(input.riskTolerance ? { riskTolerance: input.riskTolerance } : {}),
        ...(input.knowledgeLevel ? { knowledgeLevel: input.knowledgeLevel } : {}),
        ...(input.interestedAssetTypes ? { interestedAssetTypes: input.interestedAssetTypes } : {}),
      },
    });
    return toInvestorProfile(profile);
  }

  /** Marks onboarding as complete. Idempotent: the first completion date is kept. */
  async completeOnboarding(userId: string): Promise<PublicUser> {
    const user = await this.db.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw notFound('Compte introuvable');
    if (user.onboardingCompletedAt) return toPublicUser(user);

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date() },
    });
    await this.auditLog.record({
      userId,
      action: 'onboarding.completed',
      resource: 'user',
      resourceId: userId,
    });
    return toPublicUser(updated);
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const preferences = await this.db.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return {
      dailyBrief: preferences.dailyBrief,
      importantNews: preferences.importantNews,
      learning: preferences.learning,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
    };
  }

  async updateNotificationPreferences(
    userId: string,
    input: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const preferences = await this.db.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
    return {
      dailyBrief: preferences.dailyBrief,
      importantNews: preferences.importantNews,
      learning: preferences.learning,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
    };
  }
}
