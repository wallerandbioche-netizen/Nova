import { AppError } from '@/lib/errors';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createCheckoutSession } from '@/features/billing/service';
import { requireViewer } from '@/server/session';
import { enforceRateLimit, jsonOk, route } from '@/server/http';

export const runtime = 'nodejs';

/** POST /api/stripe/create-checkout — opens a Stripe Checkout session. */
export const POST = route('stripe.checkout', async () => {
  const viewer = await requireViewer();
  await enforceRateLimit(RATE_LIMITS.billing, `user:${viewer.id}`);

  if (viewer.isSubscribed) {
    throw new AppError('conflict', 'Ton abonnement Scan Trade Pro est déjà actif.');
  }

  const session = await createCheckoutSession({
    id: viewer.id,
    email: viewer.email,
    name: viewer.name,
  });

  return jsonOk(session);
});
