import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `raised` lifts a card off another card; `flat` sits directly on the page. */
  tone?: 'flat' | 'raised';
}

export function Card({ tone = 'flat', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border shadow-card',
        tone === 'raised' ? 'bg-surface-raised' : 'bg-surface',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6', className)}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-content-muted">
          {title}
        </h2>
        {description && <p className="text-sm text-content-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-5 sm:px-6 sm:py-6', className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('hairline px-5 py-4 sm:px-6', className)}>{children}</div>;
}
