'use client';

import { Activity, CircleSlash, Gauge, Layers } from 'lucide-react';
import { Stat } from '@/components/ui/stat';
import { useHistory } from '@/hooks/use-history';

/** Journal-derived counters. Everything is computed from stored analyses. */
export function OverviewStats() {
  const { entries } = useHistory();

  const today = new Date().toDateString();
  const todayCount = entries.filter(
    (entry) => new Date(entry.analysis.createdAt).toDateString() === today,
  ).length;
  const activeSetups = entries.filter(
    (entry) => entry.analysis.setup && entry.status === 'en_cours',
  ).length;
  const noTradeCount = entries.filter((entry) => !entry.analysis.setup).length;
  const averageConfluence = entries.length
    ? entries.reduce((total, entry) => total + entry.analysis.confluence.score, 0) / entries.length
    : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Analyses aujourd’hui"
        value={todayCount}
        hint={`${entries.length} au total dans le journal`}
        icon={<Activity className="h-3.5 w-3.5" aria-hidden />}
      />
      <Stat
        label="Configurations suivies"
        value={activeSetups}
        hint="Idées encore en cours"
        tone="brand"
        icon={<Layers className="h-3.5 w-3.5" aria-hidden />}
      />
      <Stat
        label="Configurations retenues"
        value={entries.filter((entry) => entry.analysis.setup).length}
        hint="Analyses ayant passé tous les filtres"
        icon={<Gauge className="h-3.5 w-3.5" aria-hidden />}
      />
      <Stat
        label="Confluence moyenne"
        value={`${averageConfluence.toFixed(1)}/10`}
        hint={`${noTradeCount} analyse(s) sans trade`}
        icon={<CircleSlash className="h-3.5 w-3.5" aria-hidden />}
      />
    </div>
  );
}
