'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Lock, Search } from 'lucide-react';
import type { Timeframe } from '@/types/market';
import { TIMEFRAMES } from '@/types/market';
import type { SetupKind } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChartThumbnail } from '@/components/charts/chart-thumbnail';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Stat } from '@/components/ui/stat';
import { Tabs } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useHistory } from '@/hooks/use-history';
import { useSettings } from '@/hooks/use-settings';
import { STATUS_LABEL, type AnalysisStatus } from '@/lib/storage/history';
import { generateCandles } from '@/lib/market-data';
import { SETUP_LABEL } from '@/lib/utils/labels';
import { formatDateTime, formatPrice, formatRatio } from '@/lib/utils/format';

type DirectionFilter = 'all' | 'long' | 'short' | 'none';
const PAGE_SIZE = 8;

/** Placeholder standing in for a figure the free plan does not show. */
function Locked() {
  return (
    <span className="inline-flex items-center gap-1 text-ink-subtle" title="Réservé aux abonnés">
      <Lock className="h-3 w-3" aria-hidden />
      <span aria-label="Réservé aux abonnés">•••</span>
    </span>
  );
}

const STATUS_TONE: Record<AnalysisStatus, 'brand' | 'long' | 'short'> = {
  en_cours: 'brand',
  confirme: 'long',
  invalide: 'short',
};

/** Journal: every analysis, filterable and searchable, with its outcome. */
export function JournalTable() {
  const { entries, ready } = useHistory();
  const [settings] = useSettings();
  const unlocked = settings.subscribed;
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [query, setQuery] = useState('');
  const [timeframe, setTimeframe] = useState<Timeframe | 'all'>('all');
  const [setupKind, setSetupKind] = useState<SetupKind | 'all' | 'none'>('all');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter(({ analysis }) => {
      const analysisDirection = analysis.setup?.direction ?? 'none';
      if (direction !== 'all' && analysisDirection !== direction) return false;
      if (timeframe !== 'all' && analysis.timeframe !== timeframe) return false;
      if (setupKind === 'none' && analysis.setup) return false;
      if (setupKind !== 'all' && setupKind !== 'none' && analysis.setup?.kind !== setupKind)
        return false;
      if (!needle) return true;
      return (
        analysis.asset.symbol.toLowerCase().includes(needle) ||
        analysis.asset.name.toLowerCase().includes(needle) ||
        (analysis.setup ? SETUP_LABEL[analysis.setup.kind].toLowerCase().includes(needle) : false)
      );
    });
  }, [entries, direction, timeframe, setupKind, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const confirmed = entries.filter((entry) => entry.status === 'confirme').length;
  const closed = entries.filter((entry) => entry.status !== 'en_cours').length;
  const averageConfluence = entries.length
    ? entries.reduce((total, entry) => total + entry.analysis.confluence.score, 0) / entries.length
    : 0;

  const counts = {
    all: entries.length,
    long: entries.filter((entry) => entry.analysis.setup?.direction === 'long').length,
    short: entries.filter((entry) => entry.analysis.setup?.direction === 'short').length,
    none: entries.filter((entry) => !entry.analysis.setup).length,
  };

  if (!ready) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_value, index) => (
            <Skeleton key={index} className="h-[86px] rounded-[var(--radius-card)]" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-[var(--radius-card)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Analyses" value={entries.length} hint="Toutes sources confondues" />
        <Stat
          label="Verdicts confirmés"
          value={closed ? `${Math.round((confirmed / closed) * 100)} %` : '—'}
          hint={`${confirmed} confirmé(s) sur ${closed} clôturé(s)`}
          tone="long"
        />
        <Stat
          label="Confluence moyenne"
          value={unlocked ? `${averageConfluence.toFixed(1)}/10` : <Locked />}
          hint={unlocked ? 'Accord moyen entre les facteurs' : 'Réservé aux abonnés'}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Tabs
            label="Filtrer par direction"
            value={direction}
            onChange={(next) => {
              setDirection(next);
              setPage(0);
            }}
            items={[
              { value: 'all', label: 'Toutes', count: counts.all },
              { value: 'long', label: 'Achat', count: counts.long },
              { value: 'short', label: 'Vente', count: counts.short },
              { value: 'none', label: 'Sans trade', count: counts.none },
            ]}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              label="Unité de temps"
              className="w-[152px]"
              value={timeframe}
              onChange={(next) => {
                setTimeframe(next);
                setPage(0);
              }}
              options={[
                { value: 'all' as const, label: 'Toutes les UT' },
                ...TIMEFRAMES.map((item) => ({ value: item, label: item })),
              ]}
            />
            <Select
              label="Configuration"
              className="w-[206px]"
              value={setupKind}
              onChange={(next) => {
                setSetupKind(next);
                setPage(0);
              }}
              options={[
                { value: 'all' as const, label: 'Toutes configurations' },
                { value: 'none' as const, label: 'Aucun trade' },
                ...(Object.keys(SETUP_LABEL) as SetupKind[]).map((kind) => ({
                  value: kind,
                  label: SETUP_LABEL[kind],
                })),
              ]}
            />
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle"
                aria-hidden
              />
              <Input
                aria-label="Rechercher un actif"
                placeholder="Rechercher un actif"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                className="h-9 w-[190px] pl-8"
              />
            </div>
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <Th className="w-[104px]">Graphique</Th>
              <Th>Actif</Th>
              <Th className="hidden md:table-cell">Configuration</Th>
              <Th>Verdict</Th>
              <Th className="hidden lg:table-cell">Entrée / Stop</Th>
              <Th className="hidden sm:table-cell">R/R</Th>
              <Th>Confluence</Th>
              <Th>Issue</Th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <EmptyRow colSpan={8}>Aucune analyse ne correspond à ces filtres.</EmptyRow>
            ) : (
              visible.map(({ analysis, status, screenshot }) => {
                const setup = analysis.setup;
                const candles = generateCandles({
                  assetId: analysis.asset.id,
                  timeframe: analysis.timeframe,
                  count: 40,
                });
                return (
                  <tr key={analysis.id} className="transition-colors hover:bg-surface-muted">
                    <Td>
                      <Link
                        href={`/analyse/${analysis.id}`}
                        aria-label={`Ouvrir l’analyse ${analysis.asset.symbol}`}
                      >
                        {screenshot ? (
                          /* Stored capture: a data URL the optimizer cannot take. */
                          <img
                            src={screenshot}
                            alt=""
                            className="h-[34px] w-[88px] rounded object-cover"
                          />
                        ) : (
                          <ChartThumbnail candles={candles} width={88} height={34} />
                        )}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/analyse/${analysis.id}`} className="block">
                        <span className="block text-[13px] font-semibold text-ink">
                          {analysis.asset.symbol}
                          <span className="ml-1.5 text-[11.5px] font-normal text-ink-subtle">
                            {analysis.timeframe}
                          </span>
                        </span>
                        <span className="block text-[11.5px] text-ink-subtle">
                          {formatDateTime(analysis.createdAt)}
                        </span>
                      </Link>
                    </Td>
                    <Td className="hidden text-[12.5px] text-ink-muted md:table-cell">
                      {!unlocked ? <Locked /> : setup ? SETUP_LABEL[setup.kind] : '—'}
                    </Td>
                    <Td>
                      <Badge
                        tone={setup ? (setup.direction === 'long' ? 'long' : 'short') : 'neutral'}
                      >
                        {setup ? (setup.direction === 'long' ? 'Achat' : 'Vente') : 'Aucun trade'}
                      </Badge>
                    </Td>
                    <Td className="hidden text-[12.5px] tabular text-ink-muted lg:table-cell">
                      {!unlocked ? (
                        <Locked />
                      ) : setup ? (
                        `${formatPrice((setup.entryZone.low + setup.entryZone.high) / 2, analysis.asset)} / ${formatPrice(setup.stopLoss, analysis.asset)}`
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="hidden text-[12.5px] font-semibold tabular sm:table-cell">
                      {!unlocked ? <Locked /> : setup ? formatRatio(setup.riskReward) : '—'}
                    </Td>
                    <Td className="text-[12.5px] font-semibold tabular">
                      {unlocked ? (
                        <>
                          {analysis.confluence.score.toFixed(1)}
                          <span className="font-normal text-ink-subtle">/10</span>
                        </>
                      ) : (
                        <Locked />
                      )}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-[12px] text-ink-muted">
            {filtered.length} analyse{filtered.length > 1 ? 's' : ''} · page {currentPage + 1} sur{' '}
            {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={currentPage === 0}
            >
              Précédent
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={currentPage >= pageCount - 1}
            >
              Suivant
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
