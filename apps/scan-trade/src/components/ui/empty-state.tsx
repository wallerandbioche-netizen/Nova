import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong',
        'bg-surface/40 px-6 py-14 text-center',
        className,
      )}
    >
      {icon && <div className="mb-4 text-content-faint">{icon}</div>}
      <p className="text-base font-medium text-content">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm text-content-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
