import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        {/* 页面标题 */}
        <div className="mb-4 border-b border-[var(--rule)] pb-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-3 w-64" />
        </div>

        {/* 指标行 */}
        <div className="dashboard-metrics mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="dashboard-metric">
              <Skeleton className="h-7 w-7 rounded" />
              <div className="dashboard-metric__body">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-1 h-5 w-12" />
              </div>
            </div>
          ))}
        </div>

        {/* 活动流骨架 */}
        <div className="app-grid-2">
          <div className="surface-card divide-y divide-[var(--rule-light)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-4">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-12 shrink-0" />
              </div>
            ))}
          </div>

          {/* 侧栏 */}
          <aside className="hidden space-y-4 lg:block">
            <div className="surface-card p-4">
              <Skeleton className="h-4 w-24" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 shrink-0" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-3 w-8 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
