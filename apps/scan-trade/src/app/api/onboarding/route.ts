import { completeOnboarding, onboardingSchema } from '@/features/auth/service';
import { requireViewer } from '@/server/session';
import { jsonOk, route } from '@/server/http';

export const runtime = 'nodejs';

/** POST /api/onboarding — records the two optional onboarding answers (§23). */
export const POST = route('onboarding.complete', async (request: Request) => {
  const viewer = await requireViewer();
  const body = await request.json().catch(() => ({}));
  const input = onboardingSchema.parse(body);

  await completeOnboarding(viewer.id, { market: input.market, style: input.style });
  return jsonOk({ ok: true });
});
