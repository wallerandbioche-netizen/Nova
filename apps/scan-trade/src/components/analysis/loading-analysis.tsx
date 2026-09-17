'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/utils/cn';

/**
 * Loading state for a running scan (§7, step 4).
 *
 * The steps advance on a timer because the API exposes no progress, but the
 * component never claims to be finished: the last step stays lit until the real
 * response arrives, and nothing here shows a percentage or an ETA that would
 * imply a fixed duration.
 */
const STEPS = [
  'Analyse du graphique…',
  'Identification de la tendance…',
  'Recherche des niveaux clés…',
  'Construction des scénarios…',
  'Finalisation de l’analyse…',
] as const;

const STEP_INTERVAL_MS = 4200;

export function LoadingAnalysis({ className }: { className?: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      // Hold on the final step: the scan is done when the server says so.
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-0.5 w-full overflow-hidden bg-surface-raised" aria-hidden="true">
        <div className="h-full w-1/3 animate-progress-indeterminate bg-accent/70" />
      </div>

      <div className="px-5 py-6 sm:px-6 sm:py-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-content-muted">Scan en cours</p>

        <ol className="mt-5 space-y-3" aria-live="polite">
          {STEPS.map((label, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                    done && 'border-accent-border bg-accent-soft text-accent',
                    active && 'border-accent-border bg-accent-soft text-accent',
                    !done && !active && 'border-border text-content-faint',
                  )}
                >
                  {done ? '✓' : active ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> : ''}
                </span>
                <span
                  className={cn(
                    'text-sm transition-colors',
                    active ? 'text-content' : done ? 'text-content-muted' : 'text-content-faint',
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-6 text-xs leading-relaxed text-content-faint">
          La durée dépend de la capture et du service d&apos;analyse. Tu peux quitter cette page : le résultat
          restera disponible dans ton historique.
        </p>
      </div>
    </Card>
  );
}
