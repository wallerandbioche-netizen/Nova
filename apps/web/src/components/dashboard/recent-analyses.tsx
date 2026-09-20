'use client';

import Link from 'next/link';
import { ArrowRight, History } from 'lucide-react';
import { AnalysisCard } from '@/components/analysis/analysis-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionTitle } from '@/components/ui/card';
import { useHistory } from '@/hooks/use-history';

export function RecentAnalyses({ limit = 3 }: { limit?: number }) {
  const { entries, ready } = useHistory();
  const recent = entries.slice(0, limit);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle>Dernières analyses</SectionTitle>
        <Link
          href="/journal"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
        >
          Tout voir
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {!ready ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: limit }).map((_value, index) => (
            <Skeleton key={index} className="h-[196px] rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : recent.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {recent.map((entry) => (
            <AnalysisCard key={entry.analysis.id} analysis={entry.analysis} />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface">
          <EmptyState
            icon={<History className="h-4 w-4" aria-hidden />}
            title="Aucune analyse pour l’instant"
            description="Lancez votre première analyse pour remplir votre journal."
          />
        </div>
      )}
    </section>
  );
}
