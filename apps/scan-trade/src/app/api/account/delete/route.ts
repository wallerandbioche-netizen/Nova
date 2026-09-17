import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { deleteAccount } from '@/features/auth/service';
import { requireViewer } from '@/server/session';
import { enforceRateLimit, jsonOk, route } from '@/server/http';

export const runtime = 'nodejs';

const bodySchema = z.object({
  /** The user must type their own e-mail. A single click must not be enough. */
  confirmation: z.string().trim().toLowerCase(),
});

/** POST /api/account/delete — irreversible. */
export const POST = route('account.delete', async (request: Request) => {
  const viewer = await requireViewer();
  await enforceRateLimit(RATE_LIMITS.accountDelete, `user:${viewer.id}`);

  const body = await request.json().catch(() => ({}));
  const { confirmation } = bodySchema.parse(body);

  if (confirmation !== viewer.email.toLowerCase()) {
    throw AppError.validation(
      'Saisis exactement ton adresse e-mail pour confirmer la suppression.',
    );
  }

  await deleteAccount(viewer.id);
  return jsonOk({ ok: true });
});
