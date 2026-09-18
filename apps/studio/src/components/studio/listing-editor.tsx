'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoGrid } from '@/components/studio/photo-grid';
import { UploadZone } from '@/components/studio/upload-zone';
import { api, type SerialisedListing } from '@/lib/api-client';

/** Editing the photo set of an existing project: add, remove, reorder. */
export function ListingEditor({
  listing: initial,
  suggestedSelection,
  maxUploadBytes,
}: {
  listing: SerialisedListing;
  suggestedSelection: string[];
  maxUploadBytes: number;
}) {
  const [listing, setListing] = useState(initial);
  const [suggested, setSuggested] = useState(suggestedSelection);
  const [selection, setSelection] = useState(suggestedSelection);

  const upload = async (files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    const payload = await api<{ listing: SerialisedListing; suggestedSelection: string[] }>(
      `/api/listings/${listing.id}/images`,
      { method: 'POST', body: form },
    );
    setListing(payload.listing);
    setSuggested(payload.suggestedSelection);
  };

  const remove = async (imageId: string) => {
    const payload = await api<{ listing: SerialisedListing; suggestedSelection: string[] }>(
      `/api/listings/${listing.id}/images?imageId=${imageId}`,
      { method: 'DELETE' },
    );
    setListing(payload.listing);
    setSuggested(payload.suggestedSelection);
    setSelection((current) => current.filter((id) => id !== imageId));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link href="/dashboard/videos">
              <ArrowLeft />
              Retour
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
            {listing.title ?? 'Photos du projet'}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{listing.images.length} photos</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSelection(suggested)}>
          <Sparkles />
          Optimiser automatiquement
        </Button>
      </div>

      <PhotoGrid
        images={listing.images}
        selection={selection}
        onSelectionChange={setSelection}
        onDelete={(id) => void remove(id)}
      />

      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-700">
          <Upload className="h-4 w-4" />
          Ajouter des photos
        </p>
        <UploadZone onFiles={upload} maxBytes={maxUploadBytes} />
      </div>
    </div>
  );
}
