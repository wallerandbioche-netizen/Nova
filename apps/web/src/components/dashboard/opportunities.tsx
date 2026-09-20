import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { MarketAnalysis } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatRatio } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * Instruments where the engine actually found a setup. An empty list is a
 * legitimate outcome and is shown as such.
 */
export function Opportunities({
  analyses,
  className,
}: {
  analyses: MarketAnalysis[];
  className?: string;
}) {
  if (!analyses.length) {
    return (
      <EmptyState
        title="Aucune opportunité retenue"
        description="Aucun instrument suivi ne réunit les conditions exigées. C’est un résultat valide : il n’y a rien à exécuter."
        className={className}
      />
    );
  }

  return (
    <ul className={cn('divide-y divide-line', className)}>
      {analyses.map((analysis) => {
        const setup = analysis.setup;
        if (!setup) return null;
        const long = setup.direction === 'long';
        const Icon = long ? ArrowUpRight : ArrowDownRight;
        return (
          <li key={analysis.id}>
            <Link
              href={`/analyse/${analysis.id}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]',
                  long ? 'bg-long-soft text-long' : 'bg-short-soft text-short',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-[13.5px] font-semibold text-ink">
                  {analysis.asset.symbol}
                  <span className="text-[11.5px] font-normal text-ink-subtle">
                    {analysis.timeframe}
                  </span>
                </p>
                <p className="truncate text-[12px] text-ink-muted">{setup.label}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[12px] font-semibold tabular text-ink">
                  R/R {formatRatio(setup.riskReward)}
                </p>
                <p className="text-[11.5px] text-ink-subtle">
                  Confluence {analysis.confluence.score.toFixed(1)}/10
                </p>
              </div>
              <Badge tone={long ? 'long' : 'short'}>{long ? 'Achat' : 'Vente'}</Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
