'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Lock, Minus } from 'lucide-react';
import type { MarketAnalysis } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { ChartThumbnail } from '@/components/charts/chart-thumbnail';
import { useSettings } from '@/hooks/use-settings';
import { generateCandles } from '@/lib/market-data';
import { BIAS_LABEL, SETUP_LABEL } from '@/lib/utils/labels';
import { relativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * Compact analysis card. The verdict is always readable; the figures behind it
 * follow the plan the account is on.
 */
export function AnalysisCard({
  analysis,
  screenshot,
  className,
}: {
  analysis: MarketAnalysis;
  screenshot?: string;
  className?: string;
}) {
  const [settings] = useSettings();
  const direction = analysis.setup?.direction ?? null;
  const tone = direction === 'long' ? 'long' : direction === 'short' ? 'short' : 'neutral';
  const Icon = direction === 'long' ? ArrowUpRight : direction === 'short' ? ArrowDownRight : Minus;

  return (
    <Link
      href={`/analyse/${analysis.id}`}
      className={cn(
        'group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card transition-all hover:border-line-strong hover:shadow-raised',
        className,
      )}
    >
      <div className="flex h-[96px] items-center justify-center overflow-hidden bg-surface-muted">
        {screenshot ? (
          /* Stored capture: a data URL, which the image optimizer cannot take. */
          <img src={screenshot} alt="" className="h-full w-full object-cover" />
        ) : (
          <ChartThumbnail
            candles={generateCandles({
              assetId: analysis.asset.id,
              timeframe: analysis.timeframe,
              count: 60,
            })}
            width={320}
            height={72}
            className="w-full"
          />
        )}
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
              {settings.subscribed
                ? analysis.setup
                  ? SETUP_LABEL[analysis.setup.kind]
                  : 'Aucun trade'
                : analysis.setup
                  ? 'Configuration identifiée'
                  : 'Aucun trade'}
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
          {settings.subscribed ? (
            <span>Confluence {analysis.confluence.score.toFixed(1)}/10</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" aria-hidden />
              Détail réservé aux abonnés
            </span>
          )}
          <span>{relativeTime(analysis.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
