'use client';

import { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SerialisedImage } from '@/lib/api-client';

interface PhotoGridProps {
  images: SerialisedImage[];
  /** Selected ids, in the order they will appear in the video. */
  selection: string[];
  onSelectionChange: (next: string[]) => void;
  onDelete?: (imageId: string) => void;
}

/**
 * The photo editor: select, deselect, reorder by dragging, delete.
 * The number badge shows the position in the final video, not the position in the listing.
 */
export function PhotoGrid({ images, selection, onSelectionChange, onDelete }: PhotoGridProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const toggle = (id: string) => {
    onSelectionChange(
      selection.includes(id) ? selection.filter((entry) => entry !== id) : [...selection, id],
    );
  };

  const reorder = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const next = [...selection];
    const from = next.indexOf(sourceId);
    const to = next.indexOf(targetId);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, sourceId);
    onSelectionChange(next);
  };

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image) => {
        const position = selection.indexOf(image.id);
        const selected = position !== -1;

        return (
          <li
            key={image.id}
            draggable={selected}
            onDragStart={() => setDragging(image.id)}
            onDragEnd={() => {
              setDragging(null);
              setDragOver(null);
            }}
            onDragOver={(event) => {
              if (!selected || !dragging) return;
              event.preventDefault();
              setDragOver(image.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragging) reorder(dragging, image.id);
              setDragOver(null);
            }}
            className={cn(
              'group relative overflow-hidden rounded-xl border-2 bg-white transition-all',
              selected ? 'border-ink-900' : 'border-transparent opacity-60 hover:opacity-100',
              dragOver === image.id && dragging !== image.id ? 'ring-2 ring-accent-500' : '',
            )}
          >
            <button
              type="button"
              onClick={() => toggle(image.id)}
              className="block w-full"
              aria-pressed={selected}
              aria-label={`${selected ? 'Retirer' : 'Ajouter'} ${image.roomLabel}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.thumbnailUrl}
                alt={image.roomLabel}
                className="aspect-4/3 w-full object-cover"
                loading="lazy"
              />
            </button>

            <div className="absolute left-2 top-2 flex items-center gap-1.5">
              <span
                className={cn(
                  'grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                  selected ? 'bg-ink-900 text-white' : 'bg-white/90 text-ink-400',
                )}
              >
                {selected ? position + 1 : '·'}
              </span>
              {image.isDuplicate ? <Badge tone="warning">Doublon</Badge> : null}
            </div>

            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {selected ? (
                <span className="grid h-7 w-7 cursor-grab place-items-center rounded-lg bg-white/90 text-ink-500">
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(image.id)}
                  aria-label="Supprimer la photo"
                  className="grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-ink-500 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center justify-between px-2.5 py-2 text-xs text-ink-400">
              <span className="truncate">{image.roomLabel}</span>
              <span className="tabular-nums">
                {image.width}×{image.height}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
