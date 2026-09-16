import { RATE_LIMITS } from '@/lib/rate-limit';
import { registerSchema, registerUser } from '@/features/auth/service';
import { enforceRateLimit, getClientIp, jsonCreated, route } from '@/server/http';

export const runtime = 'nodejs';

export const POST = route('auth.register', async (request: Request) => {
  await enforceRateLimit(RATE_LIMITS.register, `ip:${getClientIp(request)}`);

  const body = await request.json().catch(() => ({}));
  const input = registerSchema.parse(body);
  const user = await registerUser(input);

  return jsonCreated({ id: user.id, email: user.email });
});
