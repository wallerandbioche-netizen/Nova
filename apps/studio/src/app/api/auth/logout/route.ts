import { ok, route } from '@/lib/http';
import { clearSessionCookie } from '@/lib/auth/session';

export const POST = route(async () => {
  await clearSessionCookie();
  return ok({ ok: true });
});
