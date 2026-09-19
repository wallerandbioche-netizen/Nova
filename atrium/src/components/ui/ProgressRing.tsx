'use client';

import { motion, useReducedMotion } from 'motion/react';

interface ProgressRingProps {
  /** Progression 0 → 1. */
  value: number;
  size?: number;
}

/**
 * Indicateur circulaire minimal. Le trait se remplit, et un point tourne
 * lentement pour signaler que le travail continue même quand le chiffre stagne.
 */
export function ProgressRing({ value, size = 92 }: ProgressRingProps) {
  const reduced = useReducedMotion();
  const stroke = 1.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-line"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="text-ink"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>

      {!reduced && (
        <motion.span
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 9, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          aria-hidden="true"
        >
          <span
            className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full bg-accent"
            style={{ marginTop: stroke / 2 - 2 }}
          />
        </motion.span>
      )}

      <span className="absolute inset-0 grid place-items-center text-[0.8125rem] tabular-nums text-muted">
        {Math.round(clamped * 100)}%
      </span>
    </div>
  );
}
