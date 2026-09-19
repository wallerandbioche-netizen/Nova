'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { cn } from '@/lib/cn';
import type { ProjectView, StageView } from '@/types/api';

function currentStage(stages: StageView[]): StageView | undefined {
  return stages.find((stage) => stage.status === 'active') ?? stages.find((s) => s.status === 'pending');
}

export function ProgressPanel({ project }: { project: ProjectView | null }) {
  const stages = project?.stages ?? [];
  const active = currentStage(stages);

  return (
    <div className="flex flex-col items-center text-center">
      <ProgressRing value={project?.progress ?? 0} />

      <h1 className="mt-9 text-title text-balance">Analyse de votre annonce</h1>

      <div className="mt-3 h-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={active?.id ?? 'idle'}
            className="text-[0.9375rem] text-muted"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {active?.label ?? 'Préparation'}
          </motion.p>
        </AnimatePresence>
      </div>

      <ol className="mt-12 flex flex-col gap-3.5 text-left">
        {stages.map((stage) => (
          <li key={stage.id} className="flex items-center gap-3">
            <span className="relative grid h-3 w-3 shrink-0 place-items-center" aria-hidden="true">
              <span
                className={cn(
                  'block h-1.5 w-1.5 rounded-full transition-colors duration-calm',
                  stage.status === 'done' && 'bg-ink',
                  stage.status === 'active' && 'bg-accent',
                  stage.status === 'pending' && 'bg-line-strong',
                  stage.status === 'failed' && 'bg-danger',
                )}
              />
              {stage.status === 'active' && (
                <span
                  className="absolute h-3 w-3 rounded-full bg-accent"
                  style={{ animation: 'atrium-breathe 1.9s ease-in-out infinite' }}
                />
              )}
            </span>
            <span
              className={cn(
                'text-[0.9375rem] transition-colors duration-calm',
                stage.status === 'pending' ? 'text-faint' : 'text-ink',
              )}
            >
              {stage.label}
            </span>
          </li>
        ))}
      </ol>

      {project?.listing?.isDemo && (
        <p className="mt-12 max-w-sm text-caption text-faint">
          Cette annonce est illustrée par un jeu de photos de démonstration.
        </p>
      )}
    </div>
  );
}
