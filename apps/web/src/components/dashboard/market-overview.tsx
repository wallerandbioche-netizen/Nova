import Link from 'next/link';
import type { MarketQuote } from '@/types/market';
import { Sparkline } from '@/components/charts/sparkline';
import { formatPercent, formatPrice } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export function MarketOverview({
  quotes,
  className,
}: {
  quotes: MarketQuote[];
  className?: string;
}) {
  return (
    <ul className={cn('divide-y divide-line', className)}>
      {quotes.map((quote) => (
        <li key={quote.asset.id}>
          <Link
            href={`/marches?actif=${quote.asset.id}`}
            className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-muted"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-ink">{quote.asset.symbol}</p>
              <p className="truncate text-[11.5px] text-ink-subtle">{quote.asset.name}</p>
            </div>
            <Sparkline values={quote.spark} className="hidden sm:block" />
            <div className="w-24 text-right">
              <p className="text-[13px] font-semibold tabular text-ink">
                {formatPrice(quote.last, quote.asset)}
              </p>
              <p
                className={cn(
                  'text-[11.5px] font-medium tabular',
                  quote.changePercent >= 0 ? 'text-long' : 'text-short',
                )}
              >
                {formatPercent(quote.changePercent)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
