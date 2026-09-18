import type { NextRequest } from 'next/server';
import { ok, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { checkoutSchema } from '@/lib/validation';
import { createCheckoutSession } from '@/lib/stripe/checkout';

export const POST = route(async (request: NextRequest) => {
  const user = await requireUser();
  const input = await readJson(request, checkoutSchema);
  const session = await createCheckoutSession({
    userId: user.id,
    email: user.email,
    planId: input.planId,
    packId: input.packId,
  });
  return ok(session);
});
