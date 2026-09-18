'use client';

import { useRef, useState, type DragEvent } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatBytes } from '@/lib/utils';

interface UploadZoneProps {
  onFiles: (files: File[]) => Promise<void>;
  maxBytes: number;
  disabled?: boolean;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** Manual upload: the fallback that guarantees no listing is a dead end. */
export function UploadZone({ onFiles, maxBytes, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const tooBig = files.find((file) => file.size > maxBytes);
    if (tooBig) {
      setError(`« ${tooBig.name} » dépasse ${formatBytes(maxBytes)}.`);
      return;
    }
    const wrongType = files.find((file) => !ACCEPTED.includes(file.type));
    if (wrongType) {
      setError('Formats acceptés : JPG, JPEG, PNG et WebP.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await onFiles(files);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Import impossible.');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    if (!disabled) void handle(event.dataTransfer.files);
  };

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-[var(--radius-card)] border-2 border-dashed p-8 text-center transition-colors',
          over ? 'border-accent-500 bg-accent-50/50' : 'border-ink-200 bg-white',
        )}
      >
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-ink-100 text-ink-500">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
        </span>
        <p className="font-medium text-ink-900">Glissez vos photos ici</p>
        <p className="mt-1 text-sm text-ink-500">
          JPG, PNG ou WebP — {formatBytes(maxBytes)} maximum par fichier
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          Choisir des fichiers
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(event) => {
            void handle(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
