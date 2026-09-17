import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

/** Shown while a signed-in page streams in (§33). */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SkeletonCard rows={1} />
        <SkeletonCard rows={1} />
        <SkeletonCard rows={1} />
      </div>
      <SkeletonCard rows={4} />
      <SkeletonCard rows={3} />
    </div>
  );
}
