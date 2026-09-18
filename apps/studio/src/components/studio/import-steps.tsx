'use client';

import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepState = 'pending' | 'active' | 'done';

export interface ImportStep {
  label: string;
  state: StepState;
}

/** The loading screen. Steps only advance on a real event — nothing here is theatre. */
export function ImportSteps({ steps, title }: { steps: ImportStep[]; title: string }) {
  return (
    <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-ink-200 bg-white p-8">
      <h2 className="text-lg font-medium text-ink-900">{title}</h2>
      <ul className="mt-6 space-y-4">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3">
            <span
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs',
                step.state === 'done' && 'border-ink-900 bg-ink-900 text-white',
                step.state === 'active' && 'border-ink-900 text-ink-900',
                step.state === 'pending' && 'border-ink-200 text-ink-300',
              )}
            >
              {step.state === 'done' ? (
                <Check className="h-3.5 w-3.5" />
              ) : step.state === 'active' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
            </span>
            <span
              className={cn(
                'text-sm',
                step.state === 'pending' ? 'text-ink-400' : 'text-ink-800',
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
