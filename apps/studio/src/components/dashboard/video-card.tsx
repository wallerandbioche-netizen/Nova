import Link from 'next/link';
import { Clock, Film } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDuration } from '@/lib/utils';

export interface VideoCardData {
  id: string;
  name: string;
  status: string;
  aspectRatio: string;
  durationSeconds: number | null;
  posterUrl: string | null;
  createdAt: string;
}

const STATUS_TONE = {
  COMPLETED: { tone: 'success' as const, label: 'Prête' },
  FAILED: { tone: 'danger' as const, label: 'Échec' },
  DRAFT: { tone: 'neutral' as const, label: 'Brouillon' },
  QUEUED: { tone: 'warning' as const, label: 'En attente' },
  PROCESSING: { tone: 'warning' as const, label: 'Traitement' },
  RENDERING: { tone: 'warning' as const, label: 'Rendu' },
  UPLOADING: { tone: 'warning' as const, label: 'Finalisation' },
};

export function VideoCard({ video }: { video: VideoCardData }) {
  const status = STATUS_TONE[video.status as keyof typeof STATUS_TONE] ?? STATUS_TONE.DRAFT;

  return (
    <Link
      href={`/dashboard/videos/${video.id}`}
      className="group block overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-white transition-shadow hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-video overflow-hidden bg-ink-100">
        {video.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.posterUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-ink-300">
            <Film className="h-8 w-8" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      <div className="p-4">
        <h3 className="truncate font-medium text-ink-900">{video.name}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
          <span>{video.aspectRatio === 'VERTICAL' ? '9:16' : video.aspectRatio === 'SQUARE' ? '1:1' : '16:9'}</span>
          {video.durationSeconds ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(video.durationSeconds)}
            </span>
          ) : null}
          <span>{formatDate(video.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
