import type { AnalysisDetail } from '@/types/analysis';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CONFIDENCE_LABEL, displayBias, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';

const BIAS_STYLES: Record<string, string> = {
  LONG: 'text-accent',
  SHORT: 'text-danger',
  NEUTRAL: 'text-content-muted',
  'NO TRADE': 'text-content-muted',
  'DONNÉES INSUFFISANTES': 'text-content-muted',
  INDISPONIBLE: 'text-danger',
};

/** The headline of an analysis (§8): bias first, then the one-paragraph summary. */
export function AnalysisSummary({ analysis }: { analysis: AnalysisDetail }) {
  const bias = displayBias(analysis.status, analysis.bias);
  const declined = analysis.status === 'NO_TRADE' || analysis.status === 'INSUFFICIENT_DATA';

  return (
    <Card tone="raised" className="px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-content-faint">Market Bias</p>
          <p
            className={cn(
              'mt-1.5 text-display font-semibold tracking-tight',
              BIAS_STYLES[bias] ?? 'text-content',
            )}
          >
            {bias}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {analysis.confidence && (
            <Badge tone="muted">Confiance : {CONFIDENCE_LABEL[analysis.confidence]}</Badge>
          )}
          <Badge tone="muted">{formatDateTime(analysis.createdAt)}</Badge>
        </div>
      </div>

      {declined && (
        <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-content">
          {analysis.status === 'NO_TRADE'
            ? "Aucun scénario suffisamment clair n'a été identifié sur ce graphique."
            : 'Analyse insuffisante — aucune configuration exploitable détectée sur cette capture.'}
        </p>
      )}

      {analysis.summary && (
        <p className="mt-4 text-sm leading-relaxed text-content-muted">{analysis.summary}</p>
      )}

      {analysis.confidence && (
        <p className="mt-3 text-xs leading-relaxed text-content-faint">
          Le niveau de confiance décrit la cohérence des éléments visibles sur la capture. Ce
          n&apos;est pas une probabilité de gain.
        </p>
      )}
    </Card>
  );
}

/** Model-reported caveats (§8 / §13). Hidden entirely when there are none. */
export function AnalysisWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <section
      aria-labelledby="warnings-heading"
      className="rounded-2xl border border-warning-border bg-warning-soft px-5 py-4 sm:px-6"
    >
      <h2
        id="warnings-heading"
        className="text-xs font-semibold uppercase tracking-[0.14em] text-warning"
      >
        Points de vigilance
      </h2>
      <ul className="mt-2.5 space-y-1.5">
        {warnings.map((warning, index) => (
          <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-content-muted">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warning" />
            <span>{warning}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
