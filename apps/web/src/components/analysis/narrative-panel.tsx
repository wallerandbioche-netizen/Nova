import type { AnalysisNarrative } from '@/types/analysis';
import { cn } from '@/lib/utils/cn';

const SECTIONS: { key: keyof AnalysisNarrative; label: string }[] = [
  { key: 'marketContext', label: 'Contexte de marché' },
  { key: 'structure', label: 'Structure' },
  { key: 'keyLevels', label: 'Niveaux clés' },
  { key: 'momentum', label: 'Momentum' },
  { key: 'volume', label: 'Volume' },
  { key: 'setup', label: 'Configuration' },
  { key: 'entry', label: 'Entrée' },
  { key: 'riskManagement', label: 'Gestion du risque' },
  { key: 'invalidation', label: 'Invalidation' },
];

/** The reasoning, section by section, so the trader can follow the logic. */
export function NarrativePanel({
  narrative,
  className,
}: {
  narrative: AnalysisNarrative;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {SECTIONS.map((section) => {
        const value = narrative[section.key];
        if (!value) return null;
        return (
          <div key={section.key}>
            <p className="text-[11px] font-semibold tracking-[0.07em] text-ink-subtle uppercase">
              {section.label}
            </p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-muted">{value}</p>
          </div>
        );
      })}
    </div>
  );
}
