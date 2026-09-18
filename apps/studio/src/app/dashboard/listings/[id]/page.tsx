import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { getEnv } from '@/lib/config/env';
import { requireListing, suggestSelection } from '@/server/listings';
import { serialiseListing } from '@/server/serializers';
import { ListingEditor } from '@/components/studio/listing-editor';

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const listing = await requireListing(user.id, id).catch(() => null);
  if (!listing) notFound();

  return (
    <ListingEditor
      listing={await serialiseListing(listing)}
      suggestedSelection={suggestSelection(listing.images)}
      maxUploadBytes={getEnv().MAX_UPLOAD_BYTES}
    />
  );
}
