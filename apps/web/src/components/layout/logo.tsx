import { ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {/* `text-canvas` keeps the glyph readable when the ink colour flips in dark mode. */}
      <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-ink text-canvas">
        <ScanLine className="h-4 w-4" aria-hidden />
      </span>
      {compact ? null : (
        <span className="text-[15px] font-bold tracking-[-0.02em] text-ink">
          SCAN <span className="text-brand">TRADE</span>
        </span>
      )}
    </span>
  );
}
