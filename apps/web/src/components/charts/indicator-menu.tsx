'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LineChart } from 'lucide-react';
import type { IndicatorToggles } from '@/types/chart';
import { cn } from '@/lib/utils/cn';

const ITEMS: { key: keyof IndicatorToggles; label: string; hint: string }[] = [
  { key: 'ema20', label: 'EMA 20', hint: 'Moyenne mobile exponentielle courte' },
  { key: 'ema50', label: 'EMA 50', hint: 'Moyenne mobile intermédiaire' },
  { key: 'ema200', label: 'EMA 200', hint: 'Moyenne mobile longue' },
  { key: 'vwap', label: 'VWAP', hint: 'Prix moyen pondéré par les volumes (glissant)' },
  { key: 'volume', label: 'Volume', hint: 'Histogramme des volumes' },
  { key: 'rsi', label: 'RSI 14', hint: 'Panneau séparé' },
  { key: 'macd', label: 'MACD', hint: 'Panneau séparé' },
];

export function IndicatorMenu({
  value,
  onChange,
  className,
}: {
  value: IndicatorToggles;
  onChange: (value: IndicatorToggles) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = ITEMS.filter((item) => value[item.key]).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:border-line-strong"
      >
        <LineChart className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
        Indicateurs
        <span className="tabular text-ink-subtle">{active}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-fade-rise absolute right-0 z-40 mt-1.5 w-64 rounded-[var(--radius-card)] border border-line bg-surface p-1.5 shadow-pop"
        >
          {ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-surface-muted"
            >
              <input
                type="checkbox"
                checked={value[item.key]}
                onChange={(event) => onChange({ ...value, [item.key]: event.target.checked })}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-brand)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">{item.label}</span>
                <span className="block text-[11.5px] text-ink-muted">{item.hint}</span>
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
