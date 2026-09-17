import Link from 'next/link';
import type { AnalysisListItem } from '@/types/analysis';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDateTime, formatPrice, formatRiskReward, orUnknown } from '@/utils/format';

/** One history row: thumbnail, identity, and the four numbers that matter (§15). */
export function AnalysisRow({ item, thumbnail = true }: { item: AnalysisListItem; thumbnail?: boolean }) {
  const hasPlan = item.status === 'COMPLETED';

  return (
    <Link
      href={`/analyses/${item.id}`}
      className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-raised/50 sm:px-5"
    >
      {thumbnail && (
        <span className="hidden h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-black/40 sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/analyses/${item.id}/image`}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-content">
            {orUnknown(item.asset)}
            {item.timeframe ? ` · ${item.timeframe}` : ''}
          </span>
          <StatusBadge status={item.status} />
          {item.bias && hasPlan && (
            <span
              className={`text-xs font-semibold ${item.bias === 'LONG' ? 'text-accent' : item.bias === 'SHORT' ? 'text-danger' : 'text-content-faint'}`}
            >
              {item.bias}
            </span>
          )}
        </span>
        <span className="mt-1 block text-xs text-content-faint">{formatDateTime(item.createdAt)}</span>
      </span>

      <span className="hidden shrink-0 items-baseline gap-6 md:flex">
        <Metric label="Entry" value={hasPlan ? formatPrice(item.entryMin) : '—'} />
        <Metric label="SL" value={hasPlan ? formatPrice(item.stopLoss) : '—'} tone="danger" />
        <Metric label="TP1" value={hasPlan ? formatPrice(item.takeProfit1) : '—'} tone="accent" />
        <Metric label="R:R" value={hasPlan ? formatRiskReward(item.riskReward) : '—'} />
      </span>

      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-content-faint" fill="none" aria-hidden="true">
        <path d="m6 3.5 5 4.5-5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'danger' }) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : 'text-content';
  return (
    <span className="block w-20 text-right">
      <span className="block text-[10px] uppercase tracking-[0.1em] text-content-faint">{label}</span>
      <span className={`numeric mt-0.5 block truncate text-sm font-medium ${value === '—' ? 'text-content-faint' : color}`}>
        {value}
      </span>
    </span>
  );
}
