export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[var(--bg-subtle)] ${className || ""}`}
    />
  );
}

export function IdeaCardSkeleton() {
  return (
    <div className="surface-card p-6">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="mt-3 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1 h-4 w-2/3" />
      <div className="mt-4 flex gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

export function IdeaDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="mt-4 h-9 w-3/4" />
      <Skeleton className="mt-2 h-5 w-48" />
      <Skeleton className="mt-6 h-24 w-full" />
      <div className="mt-6 flex gap-6">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}
