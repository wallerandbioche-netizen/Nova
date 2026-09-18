import type { NextRequest } from 'next/server';
import { clientKey, ok, readJson, route } from '@/lib/http';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { importListingSchema } from '@/lib/validation';
import { requireUser } from '@/lib/auth/session';
import { importListingForUser } from '@/server/listings';
import { serialiseListing } from '@/server/serializers';

/** POST /api/listings/import — turns a public listing URL into an analysed photo set. */
export const POST = route(async (request: NextRequest) => {
  const user = await requireUser();
  rateLimit(clientKey(request, `import:${user.id}`), RATE_LIMITS.import);

  const { url } = await readJson(request, importListingSchema);
  const outcome = await importListingForUser(user.id, url);

  return ok(
    {
      listing: await serialiseListing(outcome.listing),
      suggestedSelection: outcome.suggestedSelection,
      notice: outcome.notice,
    },
    201,
  );
});
