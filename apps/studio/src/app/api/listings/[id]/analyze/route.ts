import { ok, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { requireListing, suggestSelection } from '@/server/listings';
import { markDuplicates } from '@/server/images';
import { serialiseListing } from '@/server/serializers';

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/listings/:id/analyze
 * Re-runs duplicate detection and the automatic selection. Photos are analysed once at import,
 * so this is cheap and never re-downloads or re-analyses anything.
 */
export const POST = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await requireListing(user.id, id);
  await markDuplicates(id);
  const listing = await requireListing(user.id, id);

  return ok({
    listing: await serialiseListing(listing),
    suggestedSelection: suggestSelection(listing.images),
  });
});
