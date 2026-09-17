import { cn } from '@/utils/cn';

/** Placeholder block used while server data is in flight (§33). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden="true" />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-5" aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={index === rows - 1 ? 'h-4 w-2/3' : 'h-4 w-full'} />
      ))}
    </div>
  );
}
