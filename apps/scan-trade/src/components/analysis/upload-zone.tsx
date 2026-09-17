'use client';

import { useCallback, useId, useRef, useState, type DragEvent } from 'react';
import { ACCEPTED_MIME_TYPES, formatBytes } from '@/lib/storage/upload-limits';
import { cn } from '@/utils/cn';

export interface UploadZoneProps {
  onSelect: (file: File) => void;
  maxBytes: number;
  disabled?: boolean;
  error?: string | undefined;
}

const ACCEPT = ACCEPTED_MIME_TYPES.join(',');

/**
 * Drag & drop, file picker, or the phone camera (§6).
 *
 * The same client-side checks run server-side before anything is stored — this
 * pass exists only to fail fast and explain why.
 */
export function UploadZone({ onSelect, maxBytes, disabled = false, error }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const describedById = useId();

  const accept = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
        setLocalError('Formats acceptés : JPG, PNG ou WEBP.');
        return;
      }
      if (file.size > maxBytes) {
        setLocalError(`Cette image fait ${formatBytes(file.size)}. La limite est de ${formatBytes(maxBytes)}.`);
        return;
      }
      setLocalError(null);
      onSelect(file);
    },
    [maxBytes, onSelect],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    accept(event.dataTransfer.files?.[0]);
  };

  const message = error ?? localError;

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors sm:py-14',
          dragging ? 'border-accent bg-accent-soft' : 'border-border-strong bg-surface/40',
          disabled && 'opacity-50',
          message && 'border-danger',
        )}
      >
        <svg
          viewBox="0 0 32 32"
          className="mx-auto h-9 w-9 text-content-faint"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M16 21V9m0 0-4.5 4.5M16 9l4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 20v3a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>

        <p className="mt-4 text-sm font-medium text-content">Dépose ta capture d&apos;écran ici</p>
        <p id={describedById} className="mt-1 text-xs text-content-muted">
          JPG, PNG ou WEBP — {formatBytes(maxBytes)} maximum
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-11 items-center rounded-lg border border-border-strong bg-surface-raised px-4 text-sm text-content transition-colors hover:bg-[#1D222C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Choisir une image
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
            className="inline-flex h-11 items-center rounded-lg px-4 text-sm text-content-muted transition-colors hover:text-content disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"
          >
            Prendre une photo
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-describedby={describedById}
          aria-label="Capture du graphique à analyser"
          onChange={(event) => accept(event.target.files?.[0])}
        />
        {/* `capture` opens the rear camera directly on mobile. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Photographier un graphique"
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </div>

      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
