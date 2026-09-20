import { CircleSlash } from 'lucide-react';
import type { NoTradeVerdict } from '@/types/analysis';
import { NO_TRADE_LABEL } from '@/lib/utils/labels';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

/**
 * NO TRADE is a first-class outcome: it is shown with the same weight as a
 * setup, with the exact gates that rejected the idea.
 */
export function NoTradePanel({
  noTrade,
  className,
}: {
  noTrade: NoTradeVerdict;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-start gap-3 rounded-[12px] border border-line bg-surface-muted p-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-neutral-soft text-neutral-tone">
          <CircleSlash className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-ink">Aucun trade proposé</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-ink-muted">
            Le marché ne présente pas les conditions exigées par votre profil de risque. Ne rien
            faire est un résultat valide.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {noTrade.codes.map((code) => (
          <Badge key={code} tone="warn">
            {NO_TRADE_LABEL[code]}
          </Badge>
        ))}
      </div>

      <ul className="space-y-1.5">
        {noTrade.reasons.map((reason) => (
          <li key={reason} className="flex gap-2 text-[12.5px] leading-5 text-ink-muted">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn" />
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
