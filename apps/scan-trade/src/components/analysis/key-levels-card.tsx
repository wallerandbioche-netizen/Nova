import type { LevelType } from '@prisma/client';
import type { KeyLevelView } from '@/types/analysis';
import { Card, CardHeader } from '@/components/ui/card';
import { formatPrice } from '@/utils/format';
import { cn } from '@/utils/cn';

const LEVEL_LABEL: Record<LevelType, string> = {
  SUPPORT_PRIMARY: 'Support principal',
  SUPPORT_SECONDARY: 'Support secondaire',
  RESISTANCE_PRIMARY: 'Résistance principale',
  RESISTANCE_SECONDARY: 'Résistance secondaire',
  ENTRY_ZONE: "Zone d'entrée",
  INVALIDATION: 'Invalidation',
  TAKE_PROFIT_1: 'Take Profit 1',
  TAKE_PROFIT_2: 'Take Profit 2',
};

const LEVEL_TONE: Record<LevelType, 'support' | 'resistance' | 'entry' | 'risk' | 'target'> = {
  SUPPORT_PRIMARY: 'support',
  SUPPORT_SECONDARY: 'support',
  RESISTANCE_PRIMARY: 'resistance',
  RESISTANCE_SECONDARY: 'resistance',
  ENTRY_ZONE: 'entry',
  INVALIDATION: 'risk',
  TAKE_PROFIT_1: 'target',
  TAKE_PROFIT_2: 'target',
};

const TONE_COLOR: Record<'support' | 'resistance' | 'entry' | 'risk' | 'target', string> = {
  support: 'text-accent',
  resistance: 'text-warning',
  entry: 'text-content',
  risk: 'text-danger',
  target: 'text-accent',
};

const TONE_BG: Record<'support' | 'resistance' | 'entry' | 'risk' | 'target', string> = {
  support: 'bg-accent',
  resistance: 'bg-warning',
  entry: 'bg-content',
  risk: 'bg-danger',
  target: 'bg-accent',
};

/**
 * Key levels (§10).
 *
 * The screenshot is never drawn over: the model reports prices, not pixel
 * coordinates, so any overlay on the original image would be a guess. Instead
 * the levels are plotted on their own price ladder beside the list — an
 * accurate rendering of what was actually returned, and the original capture
 * stays untouched.
 */
export function KeyLevelsCard({ levels }: { levels: KeyLevelView[] }) {
  const priced = levels.filter(
    (level): level is KeyLevelView & { price: number } => level.price != null,
  );
  if (levels.length === 0) return null;

  const values = priced.flatMap((level) => [level.price, level.priceMax ?? level.price]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  // A ladder needs at least two distinct prices to mean anything.
  const showLadder = priced.length >= 2 && span > 0;

  const positionOf = (price: number) => ((price - min) / span) * 100;

  return (
    <Card>
      <CardHeader title="Key Levels" description="Niveaux identifiés sur la capture analysée." />
      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className={cn('gap-6', showLadder ? 'grid sm:grid-cols-[auto_1fr]' : 'block')}>
          {showLadder && (
            <div className="relative hidden w-14 sm:block" aria-hidden="true">
              <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-border-strong" />
              {priced.map((level, index) => {
                const tone = LEVEL_TONE[level.type];
                return (
                  <span
                    key={`${level.type}-${index}`}
                    className={cn(
                      'absolute left-1/2 h-1.5 w-6 -translate-x-1/2 rounded-full',
                      TONE_BG[tone],
                    )}
                    style={{ bottom: `calc(0.5rem + ${positionOf(level.price)}% - 3px)` }}
                  />
                );
              })}
            </div>
          )}

          <ul className="space-y-px">
            {levels.map((level, index) => {
              const tone = LEVEL_TONE[level.type];
              return (
                <li
                  key={`${level.type}-${index}`}
                  className="flex items-start justify-between gap-4 rounded-lg px-1 py-2.5 hover:bg-surface-raised/50"
                >
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium', TONE_COLOR[tone])}>
                      {LEVEL_LABEL[level.type]}
                    </p>
                    {level.label && (
                      <p className="mt-0.5 text-xs text-content-muted">{level.label}</p>
                    )}
                  </div>
                  <p className="numeric shrink-0 text-sm font-semibold text-content">
                    {level.price == null
                      ? '—'
                      : level.priceMax != null
                        ? `${formatPrice(level.price)} — ${formatPrice(level.priceMax)}`
                        : formatPrice(level.price)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
}
