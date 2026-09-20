'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Check, Lock } from 'lucide-react';
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
  features,
  className,
}: {
  unlocked: boolean;
  /** Rendered as-is once unlocked; the lock never renders it. */
  children?: ReactNode;
  title?: string;
  description?: string;
  preview?: ReactNode;
  /** What the subscription unlocks, listed under the call to action. */
  features?: string[];
  className?: string;
}) {
  if (unlocked) return <>{children}</>;

  return (
    <div className={cn('relative overflow-hidden rounded-[12px] border border-line', className)}>
      {/* The preview is capped so the call to action always sits in view. */}
      <div aria-hidden className="blur-locked max-h-[420px] overflow-hidden select-none">
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
        {features?.length ? (
          <ul className="mx-auto max-w-xs space-y-1 text-left">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-1.5 text-[12px] leading-4 text-ink-muted"
              >
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-brand" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        ) : null}
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
