import { Info } from 'lucide-react';
import type { MarketAnalysis } from '@/types/analysis';
import { cn } from '@/lib/utils/cn';

/** Always states where the numbers come from — simulated data is labelled. */
export function DataSourceNote({
  analysis,
  className,
}: {
  analysis: MarketAnalysis;
  className?: string;
}) {
  return (
    <p
      className={cn('flex items-start gap-1.5 text-[11.5px] leading-4 text-ink-subtle', className)}
    >
      <Info className="mt-px h-3 w-3 shrink-0" aria-hidden />
      <span>
        {analysis.dataSource.label} · {analysis.dataSource.candles} bougies ·{' '}
        {analysis.reasoningProvider === 'engine'
          ? 'rédaction par le moteur déterministe'
          : 'rédaction par un modèle, chiffres calculés par le moteur'}
        .
      </span>
    </p>
  );
}
