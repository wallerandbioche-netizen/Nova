import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Sidebar upsell. Hidden once the account is subscribed. */
export function UpgradeCard({ className }: { className?: string }) {
  return (
    <Link
      href="/abonnement"
      className={cn(
        'block rounded-[12px] border border-line bg-surface-muted p-3 transition-colors hover:border-brand-ring hover:bg-brand-soft',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold whitespace-nowrap text-ink">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
        Passer à l’abonnement
      </span>
      <span className="mt-1 block text-[11px] leading-4 text-ink-muted">
        Analyses gratuites illimitées — résultat flouté.
      </span>
    </Link>
  );
}
