import Link from 'next/link';
import type { MarketQuote, Timeframe } from '@/types/market';
import type { MarketAnalysis } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { Sparkline } from '@/components/charts/sparkline';
import { Table, Td, Th } from '@/components/ui/table';
import { BIAS_LABEL, REGIME_LABEL, SETUP_LABEL } from '@/lib/utils/labels';
import { formatCompact, formatPercent, formatPrice } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface MarketRow {
  quote: MarketQuote;
  analysis: MarketAnalysis;
}

/** Scan board: one deterministic engine read per instrument. */
export function MarketTable({ rows, timeframe }: { rows: MarketRow[]; timeframe: Timeframe }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Actif</Th>
          <Th className="text-right">Dernier</Th>
          <Th className="hidden text-right sm:table-cell">Variation</Th>
          <Th className="hidden md:table-cell">Tendance</Th>
          <Th className="hidden lg:table-cell">Régime</Th>
          <Th>Biais {timeframe}</Th>
          <Th className="hidden md:table-cell">Configuration</Th>
          <Th className="text-right">Confluence</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ quote, analysis }) => (
          <tr key={quote.asset.id} className="transition-colors hover:bg-surface-muted">
            <Td>
              <Link href={`/analyser?actif=${quote.asset.id}`} className="block">
                <span className="block text-[13px] font-semibold text-ink">
                  {quote.asset.symbol}
                </span>
                <span className="block text-[11.5px] text-ink-subtle">{quote.asset.name}</span>
              </Link>
            </Td>
            <Td className="text-right text-[13px] font-semibold tabular">
              {formatPrice(quote.last, quote.asset)}
            </Td>
            <Td
              className={cn(
                'hidden text-right text-[12.5px] font-medium tabular sm:table-cell',
                quote.changePercent >= 0 ? 'text-long' : 'text-short',
              )}
            >
              {formatPercent(quote.changePercent)}
            </Td>
            <Td className="hidden md:table-cell">
              <Sparkline values={quote.spark} />
            </Td>
            <Td className="hidden text-[12.5px] text-ink-muted lg:table-cell">
              {REGIME_LABEL[analysis.marketRegime]}
            </Td>
            <Td>
              <Badge
                tone={
                  analysis.marketBias === 'bullish'
                    ? 'long'
                    : analysis.marketBias === 'bearish'
                      ? 'short'
                      : 'neutral'
                }
              >
                {BIAS_LABEL[analysis.marketBias]}
              </Badge>
            </Td>
            <Td className="hidden text-[12.5px] text-ink-muted md:table-cell">
              {analysis.setup ? SETUP_LABEL[analysis.setup.kind] : 'Aucun trade'}
            </Td>
            <Td className="text-right text-[12.5px] font-semibold tabular">
              {analysis.confluence.score.toFixed(1)}
              <span className="font-normal text-ink-subtle">/10</span>
              <span className="block text-[10.5px] font-normal text-ink-subtle">
                Vol. {formatCompact(quote.volume)}
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
