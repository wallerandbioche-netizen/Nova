import { RATE_LIMITS } from '@/lib/rate-limit';
import { changePassword, changePasswordSchema } from '@/features/auth/service';
import { requireViewer } from '@/server/session';
import { enforceRateLimit, jsonOk, route } from '@/server/http';

export const runtime = 'nodejs';

/** POST /api/account/password — change the password while signed in. */
export const POST = route('account.password', async (request: Request) => {
  const viewer = await requireViewer();
  await enforceRateLimit(RATE_LIMITS.passwordReset, `user:${viewer.id}`);

  const body = await request.json().catch(() => ({}));
  const input = changePasswordSchema.parse(body);
  await changePassword(viewer.id, input);

  return jsonOk({ ok: true });
});
