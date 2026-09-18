import { ok, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { createManualListing } from '@/server/listings';
import { serialiseListing } from '@/server/serializers';

/** POST /api/listings/manual — starts a project from the user's own photos. */
export const POST = route(async () => {
  const user = await requireUser();
  const listing = await createManualListing(user.id);
  return ok({ listing: await serialiseListing({ ...listing, images: [] }) }, 201);
});
