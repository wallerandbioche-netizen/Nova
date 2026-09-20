import type { ConfluenceResult } from '@/types/analysis';
import { Dot } from '@/components/ui/badge';
import { STRENGTH_LABEL } from '@/lib/utils/labels';
import { cn } from '@/lib/utils/cn';

const TONE_CLASS = {
  bullish: 'text-long',
  bearish: 'text-short',
  neutral: 'text-ink-muted',
  warning: 'text-warn',
} as const;

const TONE_DOT = {
  bullish: 'long',
  bearish: 'short',
  neutral: 'neutral',
  warning: 'warn',
} as const;

export function ConfluencePanel({
  confluence,
  className,
}: {
  confluence: ConfluenceResult;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      {confluence.factors.map((factor) => (
        <div
          key={factor.key}
          className="flex items-start gap-3 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-surface-muted"
        >
          <span className="mt-1.5">
            <Dot tone={TONE_DOT[factor.signal]} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-medium text-ink">{factor.label}</p>
              <p
                className={cn(
                  'text-[12px] font-semibold whitespace-nowrap',
                  TONE_CLASS[factor.signal],
                )}
              >
                {factor.direction === 'long'
                  ? 'Haussier'
                  : factor.direction === 'short'
                    ? 'Baissier'
                    : 'Neutre'}
                <span className="ml-1 font-normal text-ink-subtle">
                  {STRENGTH_LABEL[factor.strength].toLowerCase()}
                </span>
              </p>
            </div>
            <p className="mt-0.5 text-[12px] leading-4 text-ink-muted">{factor.explanation}</p>
          </div>
        </div>
      ))}

      <div className="mt-2 flex items-center justify-between rounded-[10px] bg-surface-muted px-3 py-2">
        <p className="text-[12px] text-ink-muted">
          Score de confluence — mesure l’accord entre les facteurs, pas une probabilité de gain.
        </p>
        <p className="text-[15px] font-semibold tabular text-ink">
          {confluence.score.toFixed(1)}
          <span className="text-ink-subtle"> / 10</span>
        </p>
      </div>
    </div>
  );
}
