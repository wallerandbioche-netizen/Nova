import type { MultiTimeframeRead } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { BIAS_LABEL, REGIME_LABEL } from '@/lib/utils/labels';
import { cn } from '@/lib/utils/cn';

const ALIGNMENT_LABEL = {
  strong: 'Alignement fort',
  partial: 'Alignement partiel',
  conflicting: 'Unités contradictoires',
} as const;

export function MultiTimeframePanel({
  mtf,
  className,
}: {
  mtf: MultiTimeframeRead;
  className?: string;
}) {
  const rows = [
    { key: 'higher', label: 'Contexte', read: mtf.higher },
    { key: 'intermediate', label: 'Structure', read: mtf.intermediate },
    { key: 'execution', label: 'Exécution', read: mtf.execution },
  ];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Badge
          tone={
            mtf.alignment === 'strong' ? 'long' : mtf.alignment === 'conflicting' ? 'warn' : 'muted'
          }
        >
          {ALIGNMENT_LABEL[mtf.alignment]}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-line">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className={cn(
              'flex items-center justify-between gap-3 px-3 py-2',
              index > 0 && 'border-t border-line',
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-[74px] shrink-0 text-[11px] font-semibold tracking-[0.05em] text-ink-subtle uppercase">
                {row.label}
              </span>
              <span className="text-[12.5px] font-semibold text-ink">{row.read.timeframe}</span>
            </div>
            <div className="flex items-center gap-2 text-right">
              <span className="hidden text-[11.5px] text-ink-subtle sm:block">
                {REGIME_LABEL[row.read.regime]}
              </span>
              <Badge
                tone={
                  row.read.bias === 'bullish'
                    ? 'long'
                    : row.read.bias === 'bearish'
                      ? 'short'
                      : 'neutral'
                }
              >
                {BIAS_LABEL[row.read.bias]}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[12.5px] leading-5 text-ink-muted">{mtf.description}</p>
    </div>
  );
}
