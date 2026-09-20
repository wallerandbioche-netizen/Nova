'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Free plan shows the directional verdict; the detailed plan is reserved for
 * subscribers. The locked content is never rendered as readable text.
 */
export function Paywall({
  unlocked,
  children,
  title = 'Réservé aux abonnés',
  description = 'Le verdict directionnel est offert. Le reste de l’analyse est réservé aux abonnés.',
  preview,
  className,
}: {
  unlocked: boolean;
  children: ReactNode;
  title?: string;
  description?: string;
  preview?: ReactNode;
  className?: string;
}) {
  if (unlocked) return <>{children}</>;

  return (
    <div className={cn('relative overflow-hidden rounded-[12px] border border-line', className)}>
      <div aria-hidden className="blur-locked select-none">
        {preview ?? <div className="h-44 bg-surface-muted" />}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/70 px-6 text-center backdrop-blur-[2px]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-muted shadow-card">
          <Lock className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-ink">{title}</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-5 text-ink-muted">
            {description}
          </p>
        </div>
        <Link
          href="/abonnement"
          className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          Débloquer maintenant — 199,99 €
        </Link>
      </div>
    </div>
  );
}
