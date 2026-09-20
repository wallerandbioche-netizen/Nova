import { cn } from '@/lib/utils/cn';

/**
 * Confidence dial. The value is the confluence score expressed in percent of
 * its own scale — it is a measure of agreement, never a win probability.
 */
export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 5,
  tone = 'brand',
  label,
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: 'brand' | 'long' | 'short' | 'neutral';
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const colors: Record<typeof tone, string> = {
    brand: 'var(--color-brand)',
    long: 'var(--color-long)',
    short: 'var(--color-short)',
    neutral: 'var(--color-neutral-tone)',
  };

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Indice de confluence : ${Math.round(clamped)} %`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 500ms ease' }}
        />
      </svg>
      <span className="absolute text-[13px] font-semibold tabular text-ink">
        {Math.round(clamped)} %
      </span>
    </div>
  );
}
