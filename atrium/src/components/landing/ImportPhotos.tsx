'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { GENERIC_ERROR, startFromFiles } from './createProject';

interface ImportPhotosProps {
  appearance?: 'link' | 'button';
  label?: string;
  disabled?: boolean;
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Import direct de photos.
 *
 * C'est le chemin qui aboutit toujours : il ne dépend d'aucun site tiers.
 * Il est proposé à deux endroits — sous le champ de l'accueil, et dans l'écran
 * d'erreur lorsqu'une annonce n'a pas pu être lue, pour que l'échec ne soit
 * jamais une impasse.
 */
export function ImportPhotos({
  appearance = 'link',
  label = 'ou importez vos photos',
  disabled = false,
  onError,
  onBusyChange,
}: ImportPhotosProps) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const inputId = useId();

  async function onFiles(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (files.length === 0) return;

    setPending(true);
    onBusyChange?.(true);
    try {
      router.push(`/p/${await startFromFiles(files)}`);
    } catch (failure) {
      onError?.(failure instanceof Error ? failure.message : GENERIC_ERROR);
      setPending(false);
      onBusyChange?.(false);
    }
  }

  const text = pending ? 'Import en cours…' : label;
  const busy = disabled || pending;

  return (
    <>
      {appearance === 'button' ? (
        <Button type="button" variant="secondary" size="lg" disabled={busy} onClick={() => input.current?.click()}>
          {text}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="text-caption text-muted underline decoration-line-strong underline-offset-4
                     transition-colors duration-quick hover:text-ink hover:decoration-ink/40
                     disabled:opacity-40"
        >
          {text}
        </button>
      )}
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="sr-only"
        onChange={onFiles}
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );
}
