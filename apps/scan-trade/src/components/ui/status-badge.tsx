import type { AnalysisStatus, MarketBias } from '@prisma/client';
import { Badge, type BadgeTone } from './badge';
import { STATUS_LABEL } from '@/utils/format';

const STATUS_TONE: Record<AnalysisStatus, BadgeTone> = {
  PENDING: 'muted',
  PROCESSING: 'warning',
  COMPLETED: 'accent',
  NO_TRADE: 'muted',
  INSUFFICIENT_DATA: 'muted',
  FAILED: 'danger',
};

export function StatusBadge({ status, className }: { status: AnalysisStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {status === 'PROCESSING' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" aria-hidden="true" />
      )}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const BIAS_TONE: Record<MarketBias, BadgeTone> = {
  LONG: 'accent',
  SHORT: 'danger',
  NEUTRAL: 'muted',
};

export function BiasBadge({ bias, className }: { bias: MarketBias; className?: string }) {
  return (
    <Badge tone={BIAS_TONE[bias]} className={cnFont(className)}>
      {bias}
    </Badge>
  );
}

function cnFont(className?: string): string {
  return ['font-semibold tracking-wide', className].filter(Boolean).join(' ');
}
