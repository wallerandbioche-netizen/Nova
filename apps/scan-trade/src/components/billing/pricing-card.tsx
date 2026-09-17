import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { PRO_PLAN } from '@/features/billing/service';
import { cn } from '@/utils/cn';

export interface PricingCardProps {
  action: ReactNode;
  note?: string;
  className?: string;
}

/** The single plan (§20). One card, no fake tiers, no struck-through anchor price. */
export function PricingCard({ action, note, className }: PricingCardProps) {
  return (
    <Card tone="raised" className={cn('mx-auto w-full max-w-md overflow-hidden', className)}>
      <div className="border-b border-border px-6 py-6">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-content-muted">{PRO_PLAN.name}</p>
        <p className="mt-3 flex items-baseline gap-1.5">
          <span className="numeric text-display font-semibold text-content">{PRO_PLAN.priceLabel}</span>
          <span className="text-sm text-content-muted">{PRO_PLAN.period}</span>
        </p>
        <p className="mt-2 text-sm text-content-muted">Toutes les fonctionnalités, sans limite d&apos;analyses.</p>
      </div>

      <ul className="space-y-2.5 px-6 py-6">
        {PRO_PLAN.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-content-muted">
            <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-accent" fill="none" aria-hidden="true">
              <path
                d="m3.5 8.5 3 3 6-7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <div className="px-6 pb-6">
        {action}
        {note && <p className="mt-3 text-center text-xs text-content-faint">{note}</p>}
      </div>
    </Card>
  );
}
