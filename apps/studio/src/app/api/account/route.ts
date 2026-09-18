import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/http';
import { clearSessionCookie, requireUser } from '@/lib/auth/session';
import { getStorage } from '@/lib/storage';

/**
 * DELETE /api/account — removes the account and everything attached to it.
 * Stored bytes go first: a row without its files is recoverable, a file without its row is not.
 */
export const DELETE = route(async () => {
  const user = await requireUser();
  await getStorage().deletePrefix(`users/${user.id}`).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } });
  await clearSessionCookie();
  return ok({ ok: true });
});
