'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { looksLikeAirbnbUrl } from '@/lib/listing/url';
import { cn } from '@/lib/cn';
import type { ApiErrorResponse, CreateProjectResponse, UploadResponse } from '@/types/api';

const GENERIC_ERROR = 'Une erreur est survenue. Veuillez réessayer.';

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
  return body?.error?.message ?? GENERIC_ERROR;
}

export function CreateForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | 'link' | 'upload'>(null);

  async function start(body: Record<string, unknown>): Promise<void> {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await readError(response));
    const { id } = (await response.json()) as CreateProjectResponse;
    router.push(`/p/${id}`);
  }

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (pending) return;

    const source = value.trim();
    // Un lien manifestement invalide est signalé sans aller-retour serveur :
    // l'utilisateur regarde encore son champ.
    if (source === '' || (!looksLikeAirbnbUrl(source) && !source.startsWith('folder:'))) {
      setError('Ce lien ne semble pas être une annonce valide.');
      return;
    }

    setError(null);
    setPending('link');
    try {
      await start({ source });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : GENERIC_ERROR);
      setPending(null);
    }
  }

  async function onFiles(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (files.length === 0) return;

    setError(null);
    setPending('upload');
    try {
      const form = new FormData();
      for (const file of files) form.append('photos', file);

      const response = await fetch('/api/uploads', { method: 'POST', body: form });
      if (!response.ok) throw new Error(await readError(response));
      const { uploadId } = (await response.json()) as UploadResponse;
      await start({ uploadId });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : GENERIC_ERROR);
      setPending(null);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={onSubmit} noValidate>
        <div
          className={cn(
            'flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2',
            'sm:rounded-full sm:border sm:bg-surface sm:p-1.5 sm:pl-6 sm:shadow-lift',
            'sm:transition-colors sm:duration-quick',
            error ? 'sm:border-danger/40' : 'sm:border-line sm:focus-within:border-ink/30',
          )}
        >
          <label htmlFor="listing-url" className="sr-only">
            Lien de votre annonce
          </label>
          <input
            id="listing-url"
            name="listing-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="Collez votre lien Airbnb"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            disabled={pending !== null}
            className={cn(
              'h-13 w-full min-w-0 rounded-full border bg-surface px-5 text-[1rem]',
              'tracking-[-0.011em] outline-none placeholder:text-faint',
              'transition-colors duration-quick disabled:opacity-60',
              'sm:h-11 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0',
              error ? 'border-danger/40' : 'border-line focus:border-ink/30',
            )}
          />
          <Button type="submit" size="lg" disabled={pending !== null} className="w-full sm:w-auto">
            {pending === 'link' ? 'Analyse en cours' : 'Créer la vidéo'}
          </Button>
        </div>
      </form>

      <div className="mt-4 flex min-h-6 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-caption">
        <AnimatePresence mode="wait" initial={false}>
          {error ? (
            <motion.p
              key="error"
              className="text-danger"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              role="alert"
            >
              {error}
            </motion.p>
          ) : (
            <motion.p
              key="hint"
              className="text-faint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              Aucune musique. Aucune voix. Juste votre espace.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={pending !== null}
          className="text-caption text-muted underline decoration-line-strong underline-offset-4
                     transition-colors duration-quick hover:text-ink hover:decoration-ink/40
                     disabled:opacity-40"
        >
          {pending === 'upload' ? 'Import en cours…' : 'ou importez vos photos'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="sr-only"
          onChange={onFiles}
          tabIndex={-1}
        />
      </div>
    </div>
  );
}
