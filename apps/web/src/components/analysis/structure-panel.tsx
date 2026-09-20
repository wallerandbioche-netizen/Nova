import type { MarketAnalysis } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

export function StructurePanel({
  analysis,
  className,
}: {
  analysis: MarketAnalysis;
  className?: string;
}) {
  const { marketStructure } = analysis;
  const tone =
    marketStructure.state === 'bullish'
      ? 'long'
      : marketStructure.state === 'bearish'
        ? 'short'
        : 'neutral';

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>
          {marketStructure.state === 'bullish'
            ? 'Structure haussière'
            : marketStructure.state === 'bearish'
              ? 'Structure baissière'
              : 'Structure en range'}
        </Badge>
        {marketStructure.sequence.map((event, index) => (
          <span
            key={`${event}-${index}`}
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular',
              event === 'HH' || event === 'HL'
                ? 'bg-long-soft text-long'
                : 'bg-short-soft text-short',
            )}
          >
            {event}
          </span>
        ))}
      </div>

      <p className="text-[12.5px] leading-5 text-ink-muted">{marketStructure.description}</p>

      {marketStructure.events.length ? (
        <ul className="space-y-1.5">
          {marketStructure.events.map((event) => (
            <li key={`${event.type}-${event.time}`} className="flex items-start gap-2">
              <Badge tone={event.direction === 'bullish' ? 'long' : 'short'}>{event.type}</Badge>
              <span className="text-[12.5px] leading-5 text-ink-muted">{event.description}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-ink-subtle">
          Aucune cassure de structure (BOS) ni changement de caractère (CHoCH) confirmé sur la
          fenêtre analysée.
        </p>
      )}
    </div>
  );
}
