'use client';

import { Progress } from '@/components/ui/progress';
import type { SerialisedJob } from '@/lib/api-client';

const STAGES = ['preparing_photos', 'building_edit', 'rendering', 'uploading'] as const;

const STAGE_LABELS: Record<string, string> = {
  queued: 'En file d’attente',
  preparing_photos: 'Préparation des photos',
  building_edit: 'Création du montage',
  rendering: 'Rendu vidéo',
  uploading: 'Finalisation',
  completed: 'Votre vidéo est prête',
  failed: 'Échec du rendu',
};

/**
 * Progress display.
 *
 * The percentage comes from the renderer's own frame counter. While the job is queued there is
 * no real measurement to show, so the bar is indeterminate instead of inventing a number.
 */
export function RenderProgress({ job }: { job: SerialisedJob | null }) {
  const stage = job?.stage ?? 'queued';
  const measurable = job !== null && job.progress > 0 && stage !== 'queued';

  return (
    <div className="rounded-[var(--radius-card)] border border-ink-200 bg-white p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="font-medium text-ink-900">{STAGE_LABELS[stage] ?? stage}</p>
        {measurable ? (
          <p className="text-sm tabular-nums text-ink-500">{job.progress} %</p>
        ) : (
          <p className="text-sm text-ink-400">En cours…</p>
        )}
      </div>

      <Progress value={measurable ? job.progress : null} />

      <ol className="mt-5 space-y-2 text-sm">
        {STAGES.map((entry) => {
          const currentIndex = STAGES.indexOf(stage as (typeof STAGES)[number]);
          const entryIndex = STAGES.indexOf(entry);
          const done = currentIndex > entryIndex || job?.status === 'COMPLETED';
          const active = entry === stage;
          return (
            <li
              key={entry}
              className={
                done ? 'text-ink-400 line-through' : active ? 'text-ink-900' : 'text-ink-300'
              }
            >
              {STAGE_LABELS[entry]}
            </li>
          );
        })}
      </ol>

      {job?.error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {job.error}
        </p>
      ) : null}
    </div>
  );
}
