import { RATE_LIMITS } from '@/lib/rate-limit';
import { createPortalSession } from '@/features/billing/service';
import { requireViewer } from '@/server/session';
import { enforceRateLimit, jsonOk, route } from '@/server/http';

export const runtime = 'nodejs';

/** POST /api/stripe/create-portal — opens the Stripe Customer Portal. */
export const POST = route('stripe.portal', async () => {
  const viewer = await requireViewer();
  await enforceRateLimit(RATE_LIMITS.billing, `user:${viewer.id}`);

  const session = await createPortalSession(viewer.id);
  return jsonOk(session);
});
