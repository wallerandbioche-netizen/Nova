import type { Candle } from '@/types/market';
import { cn } from '@/lib/utils/cn';

/**
 * Static SVG candles used in lists and cards. Rendering them server-side keeps
 * the journal and the dashboard fast — the interactive chart is only loaded on
 * the Analyzer.
 */
export function ChartThumbnail({
  candles,
  width = 180,
  height = 64,
  className,
  tone = 'auto',
}: {
  candles: Candle[];
  width?: number;
  height?: number;
  className?: string;
  tone?: 'auto' | 'long' | 'short' | 'neutral';
}) {
  const sample = candles.slice(-48);
  if (sample.length < 2) {
    return (
      <div className={cn('rounded-md bg-surface-muted', className)} style={{ width, height }} />
    );
  }

  const highs = sample.map((candle) => candle.high);
  const lows = sample.map((candle) => candle.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = Math.max(max - min, Number.EPSILON);
  const slot = width / sample.length;
  const bodyWidth = Math.max(slot * 0.58, 1.2);

  const y = (price: number) => height - ((price - min) / span) * (height - 6) - 3;

  const colorFor = (candle: Candle) => {
    if (tone === 'long') return 'var(--color-long)';
    if (tone === 'short') return 'var(--color-short)';
    if (tone === 'neutral') return 'var(--color-neutral-tone)';
    return candle.close >= candle.open ? 'var(--color-long)' : 'var(--color-short)';
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('block', className)}
      aria-hidden
    >
      {sample.map((candle, index) => {
        const x = index * slot + slot / 2;
        const color = colorFor(candle);
        const openY = y(candle.open);
        const closeY = y(candle.close);
        const top = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
        return (
          <g key={candle.time}>
            <line
              x1={x}
              x2={x}
              y1={y(candle.high)}
              y2={y(candle.low)}
              stroke={color}
              strokeWidth={0.8}
              opacity={0.8}
            />
            <rect
              x={x - bodyWidth / 2}
              y={top}
              width={bodyWidth}
              height={bodyHeight}
              fill={color}
              rx={0.5}
            />
          </g>
        );
      })}
    </svg>
  );
}
