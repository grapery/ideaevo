import { Skeleton, MarketCardSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        {/* 页面标题骨架 */}
        <div className="mb-4 border-b border-[var(--rule)] pb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-3 w-72" />
        </div>

        {/* 指标行骨架 */}
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

        {/* 单列市场卡片列表(与实际首页一致) */}
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
