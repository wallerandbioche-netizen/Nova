'use client';

import type { ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/utils/cn';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title = 'Une erreur est survenue', message, onRetry, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-2xl border border-danger-border bg-danger-soft px-5 py-5 sm:px-6', className)}
    >
      <p className="text-sm font-semibold text-danger">{title}</p>
      <p className="mt-1.5 text-sm text-content-muted">{message}</p>
      {(onRetry || action) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Réessayer
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}

/** Compact inline variant for form-level failures. */
export function InlineError({ message, className }: { message: string; className?: string }) {
  return (
    <p
      role="alert"
      className={cn('rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger', className)}
    >
      {message}
    </p>
  );
}

export function InlineSuccess({ message, className }: { message: string; className?: string }) {
  return (
    <p
      role="status"
      className={cn('rounded-lg border border-accent-border bg-accent-soft px-3 py-2 text-sm text-accent', className)}
    >
      {message}
    </p>
  );
}
