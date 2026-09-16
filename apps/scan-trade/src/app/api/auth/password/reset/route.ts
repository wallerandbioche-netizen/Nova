import { RATE_LIMITS } from '@/lib/rate-limit';
import { resetPassword, resetPasswordSchema } from '@/features/auth/service';
import { enforceRateLimit, getClientIp, jsonOk, route } from '@/server/http';

export const runtime = 'nodejs';

export const POST = route('auth.password.reset', async (request: Request) => {
  await enforceRateLimit(RATE_LIMITS.passwordReset, `ip:${getClientIp(request)}`);

  const body = await request.json().catch(() => ({}));
  const input = resetPasswordSchema.parse(body);
  await resetPassword(input.token, input.password);

  return jsonOk({ ok: true });
});
