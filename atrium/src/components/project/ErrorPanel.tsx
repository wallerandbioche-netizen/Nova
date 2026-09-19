'use client';

import { useState } from 'react';
import { ImportPhotos } from '@/components/landing/ImportPhotos';
import { ButtonLink } from '@/components/ui/Button';
import type { ProjectError } from '@/types/domain';

/** Codes pour lesquels l'import de photos est la suite logique. */
const OFFER_IMPORT = new Set(['SOURCE_UNAVAILABLE', 'INVALID_URL', 'NOT_ENOUGH_PHOTOS']);

export function ErrorPanel({ error }: { error: ProjectError | null }) {
  const [failure, setFailure] = useState<string | null>(null);
  const offerImport = error ? OFFER_IMPORT.has(error.code) : false;

  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="grid h-11 w-11 place-items-center rounded-full border border-line"
        aria-hidden="true"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-muted">
          <path
            d="M7.5 4v4.2M7.5 10.8v.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>

      <h1 className="mt-7 max-w-md text-title text-balance">
        {error?.message ?? 'Une erreur est survenue. Veuillez réessayer.'}
      </h1>

      {offerImport && (
        // Une annonce illisible ne doit pas être une impasse : les photos de
        // l'utilisateur donnent exactement le même résultat.
        <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-muted">
          Vous pouvez créer la même vidéo à partir des photos de votre logement.
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {offerImport && <ImportPhotos appearance="button" label="Importer vos photos" onError={setFailure} />}
        <ButtonLink href="/" variant={offerImport ? 'quiet' : 'primary'} size="lg">
          Réessayer avec un lien
        </ButtonLink>
      </div>

      {failure && (
        <p className="mt-4 text-caption text-danger" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
