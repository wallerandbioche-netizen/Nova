import { cn } from '@/lib/utils/cn';

export function Sparkline({
  values,
  width = 96,
  height = 28,
  className,
  tone,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  tone?: 'long' | 'short';
}) {
  if (values.length < 2)
    return <svg width={width} height={height} className={className} aria-hidden />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, Number.EPSILON);
  const step = width / (values.length - 1);
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const resolvedTone = tone ?? (last >= first ? 'long' : 'short');
  const color = resolvedTone === 'long' ? 'var(--color-long)' : 'var(--color-short)';

  const points = values
    .map((value, index) => `${index * step},${height - ((value - min) / span) * (height - 4) - 2}`)
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('block', className)}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}
