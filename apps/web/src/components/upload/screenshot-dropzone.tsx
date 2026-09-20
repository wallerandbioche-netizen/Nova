'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageUp, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 6 * 1024 * 1024;

export interface ScreenshotDropzoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  className?: string;
  disabled?: boolean;
}

/** Drag & drop, file picker and clipboard paste, with a preview and a reset. */
export function ScreenshotDropzone({ file, onFile, className, disabled }: ScreenshotDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const accept = useCallback(
    (candidate: File | null | undefined) => {
      if (!candidate) return;
      if (!ACCEPTED.includes(candidate.type)) {
        setError('Format non supporté. Utilisez PNG, JPG ou WEBP.');
        return;
      }
      if (candidate.size > MAX_BYTES) {
        setError('Image trop lourde : 6 Mo maximum.');
        return;
      }
      setError(null);
      onFile(candidate);
    },
    [onFile],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (disabled) return;
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith('image/'),
      );
      if (item) accept(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [accept, disabled]);

  if (file && previewUrl) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="overflow-hidden rounded-[12px] border border-line bg-surface-muted">
          {/* A blob URL cannot go through the image optimizer, so this stays a plain <img>. */}
          <img
            src={previewUrl}
            alt={`Aperçu de ${file.name}`}
            className="max-h-[320px] w-full object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="truncate text-[12.5px] text-ink-muted">
            {file.name} · {(file.size / 1024).toFixed(0)} Ko
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Remplacer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onFile(null)} disabled={disabled}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Retirer
            </Button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="sr-only"
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) accept(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          'flex flex-col items-center justify-center rounded-[12px] border border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface-muted',
          disabled && 'opacity-60',
        )}
      >
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-brand shadow-card">
          <Upload className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-[14px] font-semibold text-ink">Glissez une capture ici</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          PNG, JPG ou WEBP — vous pouvez aussi coller directement avec ⌘V
        </p>
        <Button className="mt-4" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <ImageUp className="h-4 w-4" aria-hidden />
          Choisir un fichier
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="sr-only"
          aria-label="Choisir une capture de graphique"
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </div>
      <p className="mt-2 text-center text-[11.5px] text-ink-subtle">
        TradingView · MetaTrader · Binance · Bourse Direct · Trade Republic
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-center text-[12px] font-medium text-short">
          {error}
        </p>
      ) : null}
    </div>
  );
}
