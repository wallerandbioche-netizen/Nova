import type { AnalysisDetail } from '@/types/analysis';
import { Card } from '@/components/ui/card';
import { BiasBadge } from '@/components/ui/status-badge';
import { formatPrice, formatRange, formatRiskReward } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * The trade plan (§9).
 *
 * Deliberately the loudest block on the page: Entry, SL and TP are what a
 * trader reads first, on a phone, in a hurry. Every number is labelled as a
 * level read from the chart — never as an order to place.
 */
export function TradePlanCard({ analysis }: { analysis: AnalysisDetail }) {
  if (analysis.status !== 'COMPLETED' || !analysis.bias) return null;

  const isLong = analysis.bias === 'LONG';

  return (
    <Card tone="raised" className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-content-muted">Trade Setup</h2>
        <BiasBadge bias={analysis.bias} />
      </div>

      <dl className="divide-y divide-border">
        <Row
          label="Zone d'entrée"
          value={formatRange(analysis.entryMin, analysis.entryMax)}
          accent="neutral"
          emphasis
        />
        <Row label="Stop Loss" value={formatPrice(analysis.stopLoss)} accent="danger" emphasis />
        <Row label="Take Profit 1" value={formatPrice(analysis.takeProfit1)} accent="accent" emphasis />
        {analysis.takeProfit2 != null && (
          <Row label="Take Profit 2" value={formatPrice(analysis.takeProfit2)} accent="accent" emphasis />
        )}
        <Row label="Risk / Reward" value={formatRiskReward(analysis.riskReward)} accent="neutral" />
      </dl>

      {analysis.invalidation && (
        <div className="border-t border-border bg-surface/60 px-5 py-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-content-faint">Invalidation</p>
          <p className="mt-1.5 text-sm leading-relaxed text-content-muted">{analysis.invalidation}</p>
        </div>
      )}

      <p className="border-t border-border px-5 py-3.5 text-xs leading-relaxed text-content-faint sm:px-6">
        Niveaux potentiels issus de l&apos;analyse de la capture. Scan Trade ne place et n&apos;exécute aucun ordre.
        {isLong
          ? ' Un scénario haussier n’est pas une prévision de hausse.'
          : ' Un scénario baissier n’est pas une prévision de baisse.'}
      </p>
    </Card>
  );
}

function Row({
  label,
  value,
  accent,
  emphasis = false,
}: {
  label: string;
  value: string;
  accent: 'neutral' | 'accent' | 'danger';
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6">
      <dt className="text-sm text-content-muted">{label}</dt>
      <dd
        className={cn(
          'numeric text-right font-semibold',
          emphasis ? 'text-lg sm:text-xl' : 'text-base',
          accent === 'danger' && 'text-danger',
          accent === 'accent' && 'text-accent',
          accent === 'neutral' && 'text-content',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
