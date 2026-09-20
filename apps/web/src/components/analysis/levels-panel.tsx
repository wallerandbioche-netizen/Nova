import type { Asset } from '@/types/market';
import type { LevelZone } from '@/types/analysis';
import { STRENGTH_LABEL } from '@/lib/utils/labels';
import { formatPrice, formatPercent } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export function LevelsPanel({
  levels,
  asset,
  className,
}: {
  levels: LevelZone[];
  asset: Asset;
  className?: string;
}) {
  if (!levels.length) {
    return (
      <p className={cn('text-[12.5px] text-ink-muted', className)}>
        Aucune zone suffisamment testée pour être retenue sur cette unité de temps.
      </p>
    );
  }

  return (
    <ul className={cn('space-y-1', className)}>
      {levels.map((level) => (
        <li
          key={`${level.type}-${level.price}`}
          className="flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-surface-muted"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                'h-7 w-1 shrink-0 rounded-full',
                level.type === 'support' ? 'bg-long' : 'bg-short',
              )}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-medium tabular text-ink">
                {formatPrice(level.zone.low, asset)} — {formatPrice(level.zone.high, asset)}
              </p>
              <p className="text-[11.5px] text-ink-muted">
                {level.type === 'support' ? 'Support' : 'Résistance'} ·{' '}
                {STRENGTH_LABEL[level.strength].toLowerCase()} · {level.reactions} réaction
                {level.reactions > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'text-[12px] font-semibold tabular whitespace-nowrap',
              level.distancePercent >= 0 ? 'text-ink-muted' : 'text-ink-muted',
            )}
          >
            {formatPercent(level.distancePercent)}
          </span>
        </li>
      ))}
    </ul>
  );
}
