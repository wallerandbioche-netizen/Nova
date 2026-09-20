import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type BadgeTone = 'neutral' | 'long' | 'short' | 'warn' | 'brand' | 'outline' | 'muted';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-soft text-neutral-tone',
  long: 'bg-long-soft text-long',
  short: 'bg-short-soft text-short',
  warn: 'bg-warn-soft text-warn',
  brand: 'bg-brand-soft text-brand',
  outline: 'border border-line text-ink-muted',
  muted: 'bg-surface-muted text-ink-muted',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Dot({ tone = 'neutral' }: { tone?: BadgeTone }) {
  const colors: Record<BadgeTone, string> = {
    neutral: 'bg-neutral-tone',
    long: 'bg-long',
    short: 'bg-short',
    warn: 'bg-warn',
    brand: 'bg-brand',
    outline: 'bg-ink-subtle',
    muted: 'bg-ink-subtle',
  };
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full', colors[tone])} />;
}
