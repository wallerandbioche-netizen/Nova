import type { Metadata } from 'next';
import type { AnalysisStatus } from '@prisma/client';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { AnalysisRow } from '@/components/analysis/analysis-row';
import { Disclaimer } from '@/components/layout/disclaimer';
import { getAnalysisService } from '@/server/services';
import { requireViewer } from '@/server/session';
import { cn } from '@/utils/cn';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Historique' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const FILTERS: Array<{ label: string; status?: AnalysisStatus }> = [
  { label: 'Toutes' },
  { label: 'Scénarios', status: 'COMPLETED' },
  { label: 'No trade', status: 'NO_TRADE' },
  { label: 'Données insuffisantes', status: 'INSUFFICIENT_DATA' },
  { label: 'Indisponibles', status: 'FAILED' },
];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; status?: string }>;
}) {
  const viewer = await requireViewer();
  const query = await searchParams;

  const status = FILTERS.find((filter) => filter.status === query.status)?.status;

  const result = await getAnalysisService().list(viewer.id, {
    limit: PAGE_SIZE,
    cursor: query.cursor,
    status,
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold text-content">Historique</h1>
          <p className="mt-2 text-sm text-content-muted">
            {result.total === 0
              ? 'Aucune analyse pour le moment.'
              : `${result.total} analyse${result.total > 1 ? 's' : ''} · les plus récentes en premier`}
          </p>
        </div>
        <ButtonLink href="/analyses/nouvelle">+ Nouvelle analyse</ButtonLink>
      </div>

      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = filter.status === status;
          return (
            <Link
              key={filter.label}
              href={filter.status ? `/historique?status=${filter.status}` : '/historique'}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'inline-flex h-9 items-center rounded-lg border px-3.5 text-sm transition-colors',
                active
                  ? 'border-border-strong bg-surface-raised text-content'
                  : 'border-border text-content-muted hover:text-content',
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {result.items.length === 0 ? (
        <EmptyState
          title="Tu n'as encore aucune analyse."
          description="Importe une capture de ton graphique pour obtenir ton premier plan."
          action={<ButtonLink href="/analyses/nouvelle">Analyser mon chart</ButtonLink>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {result.items.map((item) => (
              <AnalysisRow key={item.id} item={item} />
            ))}
          </div>
        </Card>
      )}

      {result.nextCursor && (
        <div className="flex justify-center">
          <ButtonLink
            href={`/historique?${new URLSearchParams({
              ...(status ? { status } : {}),
              cursor: result.nextCursor,
            }).toString()}`}
            variant="secondary"
          >
            Charger les analyses suivantes
          </ButtonLink>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
