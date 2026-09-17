import Link from 'next/link';
import { cn } from '@/utils/cn';

/**
 * The mark is a scan line crossing a candlestick — the product in one glyph.
 * Drawn inline so it inherits `currentColor` and needs no network request.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-6 w-6', className)} fill="none" aria-hidden="true">
      <rect
        x="2.75"
        y="2.75"
        width="18.5"
        height="18.5"
        rx="5"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <path
        d="M8.5 7.5v9M15.5 9.5v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="6.75"
        y="9.25"
        width="3.5"
        height="5.5"
        rx="1"
        fill="currentColor"
        fillOpacity="0.9"
      />
      <rect
        x="13.75"
        y="10.75"
        width="3.5"
        height="3"
        rx="1"
        fill="currentColor"
        fillOpacity="0.45"
      />
      <path
        d="M4 12h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2.5 2.5"
      />
    </svg>
  );
}

export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-lg text-content transition-opacity hover:opacity-85',
        className,
      )}
    >
      <LogoMark className="h-6 w-6 text-accent" />
      <span className="text-sm font-semibold uppercase tracking-[0.18em]">Scan Trade</span>
    </Link>
  );
}
