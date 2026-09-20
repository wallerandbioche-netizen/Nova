import { ArrowDownRight, ArrowUpRight, Clock, Minus, ShieldCheck } from 'lucide-react';
import type { MarketAnalysis } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from '@/components/ui/progress-ring';
import { BIAS_LABEL, RISK_PROFILE_LABEL } from '@/lib/utils/labels';
import { formatDateTime, formatPrice } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * Verdict header: direction, one-line summary and the confluence dial.
 * The dial is labelled as an agreement measure, never as a win probability.
 */
export function Verdict({
  analysis,
  headline,
  className,
}: {
  analysis: MarketAnalysis;
  headline?: string;
  className?: string;
}) {
  const direction = analysis.setup?.direction ?? null;
  const tone = direction === 'long' ? 'long' : direction === 'short' ? 'short' : 'neutral';
  const Icon = direction === 'long' ? ArrowUpRight : direction === 'short' ? ArrowDownRight : Minus;

  const verdictLabel = direction
    ? `${direction === 'long' ? 'Achat' : 'Vente'} · Biais ${BIAS_LABEL[analysis.marketBias].toLowerCase()}`
    : `Aucun trade · Biais ${BIAS_LABEL[analysis.marketBias].toLowerCase()}`;

  return (
    <div className={cn('px-5 pt-4 pb-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
              tone === 'long' && 'bg-long-soft text-long',
              tone === 'short' && 'bg-short-soft text-short',
              tone === 'neutral' && 'bg-neutral-soft text-neutral-tone',
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[19px] leading-6 font-semibold tracking-[-0.02em] text-ink">
                {analysis.asset.symbol}
              </h2>
              <span className="text-[13px] font-medium text-ink-subtle">{analysis.timeframe}</span>
              <span className="text-[13px] tabular text-ink-muted">
                {formatPrice(analysis.lastPrice, analysis.asset)}
              </span>
            </div>
            <p
              className={cn(
                'mt-0.5 text-[13.5px] font-semibold',
                tone === 'long' && 'text-long',
                tone === 'short' && 'text-short',
                tone === 'neutral' && 'text-neutral-tone',
              )}
            >
              {verdictLabel}
            </p>
            <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-ink-muted">
              {headline ?? analysis.narrative.setup}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge tone="brand" icon={<ShieldCheck className="h-3 w-3" aria-hidden />}>
            Risque {RISK_PROFILE_LABEL[analysis.riskProfile].toLowerCase()}
          </Badge>
          <div className="text-center">
            <ProgressRing
              value={analysis.confluence.score * 10}
              tone={tone === 'neutral' ? 'neutral' : tone}
              size={54}
              label={`Confluence ${analysis.confluence.score.toFixed(1)} sur 10`}
            />
            <p className="mt-1 text-[10px] font-semibold tracking-[0.06em] text-ink-subtle uppercase">
              Confluence
            </p>
          </div>
        </div>
      </div>

      {analysis.patterns.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {analysis.patterns.slice(-4).map((pattern) => (
            <Badge key={`${pattern.kind}-${pattern.index}`} tone="muted">
              {pattern.label}
            </Badge>
          ))}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-ink-subtle">
            <Clock className="h-3 w-3" aria-hidden />
            {formatDateTime(analysis.createdAt)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
