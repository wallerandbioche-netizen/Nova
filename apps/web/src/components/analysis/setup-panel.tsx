import { Target, TrendingDown, TrendingUp } from 'lucide-react';
import type { Asset } from '@/types/market';
import type { TradeSetup } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { formatPrice, formatPriceRange, formatRatio } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/** Trade plan: entry zone, stop, targets, ratio, invalidation and reasons. */
export function SetupPanel({
  setup,
  asset,
  className,
}: {
  setup: TradeSetup;
  asset: Asset;
  className?: string;
}) {
  const long = setup.direction === 'long';
  const Icon = long ? TrendingUp : TrendingDown;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={long ? 'long' : 'short'} icon={<Icon className="h-3 w-3" aria-hidden />}>
          {long ? 'Achat' : 'Vente'}
        </Badge>
        <Badge tone="brand">{setup.label}</Badge>
        <Badge tone="outline">{setup.timeframe}</Badge>
        <span className="ml-auto text-[13px] font-semibold tabular text-ink">
          R/R {formatRatio(setup.riskReward)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-line bg-line">
        <Cell
          label="Zone d'entrée"
          value={formatPriceRange(setup.entryZone.low, setup.entryZone.high, asset)}
        />
        <Cell label="Stop loss" value={formatPrice(setup.stopLoss, asset)} tone="short" />
        {setup.takeProfits.map((takeProfit) => (
          <Cell
            key={takeProfit.label}
            label={`${takeProfit.label} · ${takeProfit.r.toFixed(1)}R`}
            value={formatPrice(takeProfit.price, asset)}
            tone="long"
            hint={takeProfit.rationale}
          />
        ))}
        <Cell label="Risque / rendement" value={formatRatio(setup.riskReward)} />
      </dl>

      <div className="rounded-[12px] border border-line bg-surface-muted p-3">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <Target className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
          Invalidation
        </p>
        <p className="mt-1 text-[12.5px] leading-5 text-ink-muted">{setup.invalidation}</p>
      </div>

      <div>
        <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-subtle uppercase">
          Pourquoi cette configuration
        </p>
        <ul className="mt-2 space-y-1.5">
          {setup.reasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-[12.5px] leading-5 text-ink-muted">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-subtle uppercase">
          Conditions qui annulent l’idée
        </p>
        <ul className="mt-2 space-y-1.5">
          {setup.noTradeConditions.map((condition) => (
            <li key={condition} className="flex gap-2 text-[12.5px] leading-5 text-ink-muted">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn" />
              {condition}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'long' | 'short';
  hint?: string;
}) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <dt className="text-[11px] font-medium text-ink-subtle">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-[13.5px] font-semibold tabular',
          tone === 'long' && 'text-long',
          tone === 'short' && 'text-short',
          tone === 'default' && 'text-ink',
        )}
      >
        {value}
      </dd>
      {hint ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
