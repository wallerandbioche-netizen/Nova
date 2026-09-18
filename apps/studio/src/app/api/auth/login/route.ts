import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { clientKey, ok, readJson, route } from '@/lib/http';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/validation';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';

export const POST = route(async (request: NextRequest) => {
  rateLimit(clientKey(request, 'login'), RATE_LIMITS.auth);
  const input = await readJson(request, loginSchema);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Same message and comparable timing whether the account exists or not.
  const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
  if (!user || !valid) {
    throw new AppError('UNAUTHORIZED', 'E-mail ou mot de passe incorrect.');
  }

  const token = await createSession(user.id, request.headers.get('user-agent') ?? undefined);
  await setSessionCookie(token);

  return ok({ user: { id: user.id, email: user.email, name: user.name } });
});
