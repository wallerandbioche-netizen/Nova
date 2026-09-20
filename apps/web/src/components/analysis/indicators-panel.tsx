import type { Asset } from '@/types/market';
import type { MarketAnalysis } from '@/types/analysis';
import { formatPrice } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export function IndicatorsPanel({
  analysis,
  asset,
  className,
}: {
  analysis: MarketAnalysis;
  asset: Asset;
  className?: string;
}) {
  const { indicators } = analysis;
  const entries: { label: string; value: string; hint?: string }[] = [
    {
      label: 'EMA 20',
      value: indicators.ema20 != null ? formatPrice(indicators.ema20, asset) : 'Indisponible',
    },
    {
      label: 'EMA 50',
      value: indicators.ema50 != null ? formatPrice(indicators.ema50, asset) : 'Indisponible',
    },
    {
      label: 'EMA 200',
      value:
        indicators.ema200 != null
          ? formatPrice(indicators.ema200, asset)
          : 'Historique insuffisant',
    },
    {
      label: 'RSI 14',
      value: indicators.rsi14 != null ? indicators.rsi14.toFixed(1) : 'Indisponible',
    },
    {
      label: 'MACD',
      value: indicators.macd ? indicators.macd.histogram.toFixed(2) : 'Indisponible',
      hint: indicators.macd ? 'histogramme' : undefined,
    },
    {
      label: 'ATR 14',
      value: indicators.atr14 != null ? formatPrice(indicators.atr14, asset) : 'Indisponible',
    },
    {
      label: 'VWAP',
      value: indicators.vwap != null ? formatPrice(indicators.vwap, asset) : 'Indisponible',
      hint: 'glissant 48 périodes',
    },
    {
      label: 'Volume',
      value: indicators.volume ? `${(indicators.volume.ratio * 100).toFixed(0)} %` : 'Indisponible',
      hint: 'de la moyenne 20',
    },
  ];

  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-line bg-line sm:grid-cols-4',
        className,
      )}
    >
      {entries.map((entry) => (
        <div key={entry.label} className="bg-surface px-3 py-2.5">
          <dt className="text-[11px] font-medium text-ink-subtle">{entry.label}</dt>
          <dd className="mt-0.5 text-[13px] font-semibold tabular text-ink">{entry.value}</dd>
          {entry.hint ? <p className="text-[10.5px] text-ink-subtle">{entry.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}
