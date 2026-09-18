'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

/** `value === null` means "working, with no measurable progress" — shown as an indeterminate bar. */
export const Progress = ({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) => (
  <ProgressPrimitive.Root
    value={value ?? undefined}
    className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-ink-200', className)}
  >
    {value === null ? (
      <div className="shimmer absolute inset-0 bg-ink-300" />
    ) : (
      <ProgressPrimitive.Indicator
        className="h-full rounded-full bg-ink-900 transition-[width] duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    )}
  </ProgressPrimitive.Root>
);
