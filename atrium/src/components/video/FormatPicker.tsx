'use client';

import { cn } from '@/lib/cn';
import { FORMAT_LABELS, VIDEO_FORMATS, type VideoFormat } from '@/types/domain';

interface FormatPickerProps {
  value: VideoFormat;
  rendered: VideoFormat[];
  disabled: boolean;
  onSelect: (format: VideoFormat) => void;
}

/**
 * Choix du cadrage, proposé seulement une fois la première vidéo obtenue :
 * au premier écran, l'utilisateur n'a rien à décider.
 */
export function FormatPicker({ value, rendered, disabled, onSelect }: FormatPickerProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-1"
      role="group"
      aria-label="Format de la vidéo"
    >
      {VIDEO_FORMATS.map((format) => {
        const selected = format === value;
        return (
          <button
            key={format}
            type="button"
            disabled={disabled || selected}
            aria-pressed={selected}
            onClick={() => onSelect(format)}
            className={cn(
              'relative rounded-full px-3.5 py-1.5 text-caption tabular-nums',
              'transition-colors duration-quick ease-out-soft disabled:cursor-default',
              selected ? 'bg-ink text-canvas' : 'text-muted hover:text-ink disabled:opacity-40',
            )}
            title={`${FORMAT_LABELS[format]}${rendered.includes(format) ? '' : ' — nouveau rendu'}`}
          >
            {format}
          </button>
        );
      })}
    </div>
  );
}
