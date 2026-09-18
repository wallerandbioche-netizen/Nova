import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { clientKey, ok, readJson, route } from '@/lib/http';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { signupSchema } from '@/lib/validation';
import { hashPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { creditService } from '@/lib/credits/credit-service';
import { getSignupBonusCredits } from '@/lib/config/system-config';

export const POST = route(async (request: NextRequest) => {
  rateLimit(clientKey(request, 'signup'), RATE_LIMITS.auth);
  const input = await readJson(request, signupSchema);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('CONFLICT', 'Un compte existe déjà avec cette adresse e-mail.');
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name ?? null,
      subscription: { create: { plan: 'FREE', status: 'ACTIVE' } },
    },
  });

  // Welcome credits, recorded like any other credit movement.
  const bonus = await getSignupBonusCredits();
  if (bonus > 0) {
    await creditService.grant({
      userId: user.id,
      amount: bonus,
      type: 'BONUS',
      description: 'Crédits offerts à l’inscription',
      idempotencyKey: `signup:${user.id}`,
    });
  }

  const token = await createSession(user.id, request.headers.get('user-agent') ?? undefined);
  await setSessionCookie(token);

  return ok({ user: { id: user.id, email: user.email, name: user.name }, credits: bonus }, 201);
});
