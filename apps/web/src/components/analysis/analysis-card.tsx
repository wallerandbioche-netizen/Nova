import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { MarketAnalysis } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { ChartThumbnail } from '@/components/charts/chart-thumbnail';
import { generateCandles } from '@/lib/market-data';
import { BIAS_LABEL, SETUP_LABEL } from '@/lib/utils/labels';
import { formatPrice, relativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/** Compact analysis card used on the dashboard and in list views. */
export function AnalysisCard({
  analysis,
  className,
}: {
  analysis: MarketAnalysis;
  className?: string;
}) {
  const direction = analysis.setup?.direction ?? null;
  const tone = direction === 'long' ? 'long' : direction === 'short' ? 'short' : 'neutral';
  const Icon = direction === 'long' ? ArrowUpRight : direction === 'short' ? ArrowDownRight : Minus;
  const candles = generateCandles({
    assetId: analysis.asset.id,
    timeframe: analysis.timeframe,
    count: 60,
  });

  return (
    <Link
      href={`/analyse/${analysis.id}`}
      className={cn(
        'group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card transition-all hover:border-line-strong hover:shadow-raised',
        className,
      )}
    >
      <div className="bg-surface-muted px-3 pt-3 pb-2">
        <ChartThumbnail candles={candles} width={320} height={72} className="w-full" />
      </div>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">
              {analysis.asset.symbol}
              <span className="ml-1.5 text-[12px] font-normal text-ink-subtle">
                {analysis.timeframe}
              </span>
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {analysis.setup ? SETUP_LABEL[analysis.setup.kind] : 'Aucun trade'} ·{' '}
              {formatPrice(analysis.lastPrice, analysis.asset)}
            </p>
          </div>
          <Badge tone={tone} icon={<Icon className="h-3 w-3" aria-hidden />}>
            {direction === 'long'
              ? 'Achat'
              : direction === 'short'
                ? 'Vente'
                : BIAS_LABEL[analysis.marketBias]}
          </Badge>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-ink-subtle">
          <span>Confluence {analysis.confluence.score.toFixed(1)}/10</span>
          <span>{relativeTime(analysis.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
