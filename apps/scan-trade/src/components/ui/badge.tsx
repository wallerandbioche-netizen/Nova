import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type BadgeTone = 'neutral' | 'accent' | 'danger' | 'warning' | 'muted';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-raised text-content border-border-strong',
  accent: 'bg-accent-soft text-accent border-accent-border',
  danger: 'bg-danger-soft text-danger border-danger-border',
  warning: 'bg-warning-soft text-warning border-warning-border',
  muted: 'bg-transparent text-content-faint border-border',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
