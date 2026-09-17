import type { ReasoningCategory, TechnicalArea } from '@prisma/client';
import type { ReasoningView, TechnicalObservationView } from '@/types/analysis';
import { Card, CardHeader } from '@/components/ui/card';

const AREA_LABEL: Record<TechnicalArea, string> = {
  TREND: 'Trend',
  MARKET_STRUCTURE: 'Market Structure',
  SUPPORT_RESISTANCE: 'Support & Resistance',
  MOMENTUM: 'Momentum',
  INDICATORS: 'Indicators',
  VOLUME: 'Volume',
  OTHER: 'Autres observations',
};

/** Technical analysis cards (§11). Only the areas the model actually filled in. */
export function TechnicalAnalysisSection({ items }: { items: TechnicalObservationView[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="technical-heading" className="space-y-3">
      <h2 id="technical-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-content-muted">
        Technical Analysis
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => (
          <Card key={`${item.category}-${index}`} className="p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-content-faint">{AREA_LABEL[item.category]}</p>
            <p className="mt-2 text-sm font-medium text-content">{item.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-content-muted">{item.detail}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

const REASONING_LABEL: Record<ReasoningCategory, string> = {
  OBSERVATION: 'Ce qui est observé',
  INTERPRETATION: 'Lecture du scénario',
  CONFIRMATION: 'Ce qui confirmerait',
  INVALIDATION: 'Ce qui invaliderait',
  CONFIDENCE: 'Niveau de confiance',
  LIMITATION: 'Limites de cette analyse',
};

const ORDER: ReasoningCategory[] = [
  'OBSERVATION',
  'INTERPRETATION',
  'CONFIRMATION',
  'INVALIDATION',
  'CONFIDENCE',
  'LIMITATION',
];

/** "Why this setup?" (§12) — grouped bullet points, never a wall of prose. */
export function ReasoningSection({ items }: { items: ReasoningView[] }) {
  if (items.length === 0) return null;

  const grouped = ORDER.map((category) => ({
    category,
    entries: items.filter((item) => item.category === category),
  })).filter((group) => group.entries.length > 0);

  return (
    <Card>
      <CardHeader title="Why this setup ?" description="Observations et lecture, séparées." />
      <div className="space-y-5 px-5 pb-6 pt-4 sm:px-6">
        {grouped.map((group) => (
          <div key={group.category}>
            <p className="text-xs uppercase tracking-[0.12em] text-content-faint">
              {REASONING_LABEL[group.category]}
            </p>
            <ul className="mt-2 space-y-1.5">
              {group.entries.map((entry, index) => (
                <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-content-muted">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-content-faint" />
                  <span>{entry.content}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
