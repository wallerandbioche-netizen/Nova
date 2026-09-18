import { ok, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { deleteListing, requireListing, suggestSelection } from '@/server/listings';
import { serialiseListing } from '@/server/serializers';

interface Context {
  params: Promise<{ id: string }>;
}

export const GET = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const listing = await requireListing(user.id, id);
  return ok({
    listing: await serialiseListing(listing),
    suggestedSelection: suggestSelection(listing.images),
  });
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await deleteListing(user.id, id);
  return ok({ ok: true });
});
