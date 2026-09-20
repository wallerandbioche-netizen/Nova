'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const ANALYSIS_STEPS = [
  'Lecture du contexte et des données',
  'Structure de marché et niveaux clés',
  'Indicateurs, momentum et figures',
  'Scénarios, risque et plan d’exécution',
] as const;

/**
 * Progress list shown while the engine runs. The steps mirror the real
 * pipeline stages rather than an arbitrary animation.
 */
export function AnalysisProgress({
  active = true,
  className,
  stepMs = 550,
}: {
  active?: boolean;
  className?: string;
  stepMs?: number;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) return;
    setStep(0);
    const interval = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, ANALYSIS_STEPS.length - 1));
    }, stepMs);
    return () => window.clearInterval(interval);
  }, [active, stepMs]);

  return (
    <div className={cn('space-y-2.5', className)} aria-live="polite">
      <p className="text-[11px] font-semibold tracking-[0.07em] text-ink-subtle uppercase">
        Analyse en cours
      </p>
      <ul className="space-y-2.5">
        {ANALYSIS_STEPS.map((label, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li key={label} className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  done && 'border-brand bg-brand text-white',
                  current && 'border-brand text-brand',
                  !done && !current && 'border-line-strong text-ink-subtle',
                )}
              >
                {done ? (
                  <Check className="h-2.5 w-2.5" aria-hidden />
                ) : current ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
                ) : null}
              </span>
              <span
                className={cn(
                  'text-[12.5px]',
                  done || current ? 'font-medium text-ink' : 'text-ink-subtle',
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
