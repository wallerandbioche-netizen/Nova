import type { AnalysisDetail } from '@/types/analysis';
import { Card, CardHeader } from '@/components/ui/card';
import { MARKET_LABEL, UNKNOWN, formatPrice, orUnknown } from '@/utils/format';

/**
 * The captured chart and what could actually be read from it (§8).
 *
 * Every field falls back to "Non identifié" rather than to a plausible guess:
 * an unlabelled field is information, not a gap to be filled.
 */
export function ChartAnalysisCard({ analysis }: { analysis: AnalysisDetail }) {
  const facts: Array<{ label: string; value: string }> = [
    { label: 'Asset', value: orUnknown(analysis.asset) },
    { label: 'Timeframe', value: orUnknown(analysis.timeframe) },
    { label: 'Marché', value: analysis.market ? MARKET_LABEL[analysis.market] : UNKNOWN },
    { label: 'Type de graphique', value: orUnknown(analysis.chartType) },
    {
      label: 'Prix approximatif',
      value: analysis.approxPrice != null ? formatPrice(analysis.approxPrice) : UNKNOWN,
    },
  ];

  return (
    <Card>
      <CardHeader title="Graphique analysé" description="Informations réellement identifiées sur la capture." />
      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <figure className="overflow-hidden rounded-xl border border-border bg-black/40">
          {/*
            Served through an authenticated route, never from a public bucket.
            `next/image` is skipped on purpose: the optimiser would have to fetch
            a private, signed URL server-side for no visual gain.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/analyses/${analysis.id}/image`}
            alt={`Capture du graphique analysé${analysis.asset ? ` — ${analysis.asset}` : ''}`}
            className="max-h-[460px] w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        </figure>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-xs uppercase tracking-[0.12em] text-content-faint">{fact.label}</dt>
              <dd className="numeric mt-1 truncate text-sm font-medium text-content" title={fact.value}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}
