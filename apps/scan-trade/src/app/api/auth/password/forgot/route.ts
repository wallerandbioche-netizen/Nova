import { RATE_LIMITS } from '@/lib/rate-limit';
import { forgotPasswordSchema, requestPasswordReset } from '@/features/auth/service';
import { enforceRateLimit, getClientIp, jsonOk, route } from '@/server/http';

export const runtime = 'nodejs';

export const POST = route('auth.password.forgot', async (request: Request) => {
  await enforceRateLimit(RATE_LIMITS.passwordReset, `ip:${getClientIp(request)}`);

  const body = await request.json().catch(() => ({}));
  const { email } = forgotPasswordSchema.parse(body);

  await enforceRateLimit(RATE_LIMITS.passwordReset, `email:${email}`);
  await requestPasswordReset(email);

  // Same answer whether or not the address exists.
  return jsonOk({
    ok: true,
    message: 'Si un compte existe avec cette adresse, un lien de réinitialisation vient de partir.',
  });
});
