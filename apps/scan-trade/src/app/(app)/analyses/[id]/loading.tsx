import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function AnalysisLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de l&apos;analyse…</span>
      <Skeleton className="h-4 w-32" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="order-2 space-y-5 lg:order-1">
          <SkeletonCard rows={6} />
          <SkeletonCard rows={4} />
        </div>
        <div className="order-1 space-y-5 lg:order-2">
          <SkeletonCard rows={3} />
          <SkeletonCard rows={6} />
        </div>
      </div>
    </div>
  );
}
