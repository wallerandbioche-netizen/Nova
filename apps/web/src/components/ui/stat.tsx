import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'long' | 'short' | 'brand';
  icon?: ReactNode;
  className?: string;
}) {
  const valueTone = {
    default: 'text-ink',
    long: 'text-long',
    short: 'text-short',
    brand: 'text-brand',
  }[tone];

  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 shadow-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.07em] text-ink-subtle uppercase">
          {label}
        </p>
        {icon ? <span className="text-ink-subtle">{icon}</span> : null}
      </div>
      <p
        className={cn(
          'mt-1.5 text-[22px] leading-7 font-semibold tabular tracking-[-0.02em]',
          valueTone,
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[12px] leading-4 text-ink-muted">{hint}</p> : null}
    </div>
  );
}
