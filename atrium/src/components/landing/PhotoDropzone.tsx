'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import {
  ACCEPTED_TYPES,
  MAX_PHOTOS,
  MIN_PHOTOS,
  RECOMMENDED_PHOTOS,
  isAcceptedPhoto,
  preparePhoto,
  releasePreview,
  type PreparedPhoto,
} from '@/lib/client/photos';
import { uploadPhotos } from '@/lib/client/upload';
import { GENERIC_ERROR, startProject } from './createProject';

type Phase = 'idle' | 'preparing' | 'uploading' | 'starting';

const EASE = [0.22, 1, 0.36, 1] as const;

export function PhotoDropzone() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const busy = phase !== 'idle';

  // Les aperçus sont des URL d'objet : sans libération, le navigateur garde
  // chaque photo en mémoire jusqu'au rechargement de la page.
  useEffect(() => {
    return () => {
      for (const photo of photos) releasePreview(photo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nettoyage au démontage seulement
  }, []);

  const addFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (busy) return;
      setError(null);

      const usable = files.filter(isAcceptedPhoto);
      if (usable.length === 0) {
        setError('Ces fichiers ne sont pas des photos exploitables.');
        return;
      }

      setPhase('preparing');
      setProgress(0);
      const prepared: PreparedPhoto[] = [];

      for (const [index, file] of usable.entries()) {
        const photo = await preparePhoto(file);
        if (photo) prepared.push(photo);
        setProgress((index + 1) / usable.length);
      }

      setPhotos((current) => {
        const room = Math.max(0, MAX_PHOTOS - current.length);
        const accepted = prepared.slice(0, room);
        for (const extra of prepared.slice(room)) releasePreview(extra);
        if (accepted.length < prepared.length) {
          setError(`${MAX_PHOTOS} photos au maximum : les suivantes ont été ignorées.`);
        }
        return [...current, ...accepted];
      });

      setPhase('idle');
      setProgress(0);
    },
    [busy],
  );

  function remove(target: PreparedPhoto): void {
    releasePreview(target);
    setPhotos((current) => current.filter((photo) => photo !== target));
  }

  function clear(): void {
    for (const photo of photos) releasePreview(photo);
    setPhotos([]);
    setError(null);
  }

  async function create(): Promise<void> {
    if (photos.length < MIN_PHOTOS) {
      setError(`Il faut au moins ${MIN_PHOTOS} photos pour créer une vidéo.`);
      return;
    }

    setError(null);
    setPhase('uploading');
    setProgress(0);
    try {
      const uploadId = await uploadPhotos(photos, setProgress);
      setPhase('starting');
      router.push(`/p/${await startProject({ uploadId })}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : GENERIC_ERROR);
      setPhase('idle');
      setProgress(0);
    }
  }

  function onDrop(event: DragEvent): void {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void addFiles([...event.dataTransfer.files]);
  }

  const empty = photos.length === 0;

  return (
    <div className="w-full max-w-2xl">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          'relative rounded-2xl border bg-surface transition-colors duration-calm ease-out-soft',
          dragging ? 'border-ink/40 bg-veil' : 'border-line',
          empty ? 'p-0' : 'p-4 sm:p-5',
        )}
      >
        {empty ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl
                       px-6 py-16 text-center transition-colors duration-quick
                       hover:bg-veil/60 disabled:opacity-50 sm:py-20"
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-full border border-line"
              aria-hidden="true"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-muted">
                <path
                  d="M9 12.5V3.5M9 3.5L5.5 7M9 3.5L12.5 7M3 13v1.5A1.5 1.5 0 0 0 4.5 16h9a1.5 1.5 0 0 0 1.5-1.5V13"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="flex flex-col gap-1.5">
              <span className="text-heading">
                {phase === 'preparing' ? 'Préparation des photos…' : 'Déposez vos photos'}
              </span>
              <span className="text-caption text-faint">
                ou cliquez pour parcourir · {RECOMMENDED_PHOTOS} photos ou plus, idéalement
              </span>
            </span>
          </button>
        ) : (
          <>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-2.5">
              <AnimatePresence initial={false}>
                {photos.map((photo) => (
                  <motion.li
                    key={photo.preview}
                    layout
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.24, ease: EASE }}
                    className="group relative aspect-square overflow-hidden rounded-md bg-veil"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local, jamais servi par le réseau */}
                    <img
                      src={photo.preview}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                    <button
                      type="button"
                      onClick={() => remove(photo)}
                      disabled={busy}
                      aria-label="Retirer cette photo"
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full
                                 bg-ink/70 text-canvas opacity-0 backdrop-blur transition-opacity
                                 duration-quick group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <path
                          d="M1 1l7 7M8 1L1 8"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5">
              <p className="text-caption text-muted">
                {photos.length} photo{photos.length > 1 ? 's' : ''}
                {photos.length < RECOMMENDED_PHOTOS && (
                  <span className="text-faint"> · ajoutez-en pour une séquence plus riche</span>
                )}
              </p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  disabled={busy || photos.length >= MAX_PHOTOS}
                  className="text-caption text-muted transition-colors duration-quick
                             hover:text-ink disabled:opacity-40"
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={clear}
                  disabled={busy}
                  className="text-caption text-muted transition-colors duration-quick
                             hover:text-ink disabled:opacity-40"
                >
                  Tout retirer
                </button>
              </div>
            </div>
          </>
        )}

        {/* Un trait fin suffit à rendre compte de l'avancement : pas de barre
            qui prend toute la place pour une attente de quelques secondes. */}
        <AnimatePresence>
          {busy && (
            <motion.div
              className="absolute inset-x-0 bottom-0 h-px overflow-hidden rounded-b-2xl bg-line"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="h-full bg-ink"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: phase === 'starting' ? 1 : progress }}
                style={{ transformOrigin: 'left' }}
                transition={{ duration: 0.3, ease: EASE }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          void addFiles(files);
        }}
      />

      <div className="mt-6 flex flex-col items-center gap-4">
        {/* Tant qu'aucune photo n'est déposée, la zone est elle-même l'appel à
            l'action : un bouton grisé n'aurait rien à proposer. */}
        <AnimatePresence initial={false}>
          {!empty && (
            <motion.div
              key="cta"
              className="w-full sm:w-auto"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.26, ease: EASE }}
            >
              <Button
                type="button"
                size="lg"
                onClick={() => void create()}
                disabled={busy || photos.length < MIN_PHOTOS}
                className="w-full sm:w-auto sm:min-w-56"
              >
                {phase === 'uploading'
                  ? 'Envoi des photos…'
                  : phase === 'starting'
                    ? 'Analyse en cours'
                    : 'Créer la vidéo'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex min-h-6 items-center justify-center text-caption">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={error ?? 'hint'}
              className={error ? 'text-danger' : 'text-faint'}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              {...(error ? { role: 'alert' as const } : {})}
            >
              {error ?? 'Aucune musique. Aucune voix. Juste votre espace.'}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
