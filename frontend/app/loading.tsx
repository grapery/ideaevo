import { MarketCardSkeleton, Skeleton } from "@/components/skeleton";

// 根级 loading 主要服务 `/` 与 `/ideas`(市场页):
// 骨架与真实页面同构(标题区 + 指标条 + 侧栏 + 筛选 tab 行 + 市场卡列表),
// 切换筛选/排序时页面高度不再"塌缩再撑开"。
export default function Loading() {
  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        {/* 标题 + 操作区 */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-7 w-52" />
            <Skeleton className="mt-2 h-3.5 w-80 max-w-full" />
          </div>
          <div className="hidden shrink-0 gap-2 sm:flex">
            <Skeleton className="h-8 w-24 rounded-[var(--radius-btn)]" />
            <Skeleton className="h-8 w-24 rounded-[var(--radius-btn)]" />
          </div>
        </div>

        {/* 信号指标条(复用真实布局类, 尺寸与加载后一致) */}
        <section className="dashboard-metrics mt-6" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="dashboard-metric">
              <Skeleton className="h-7 w-7 rounded-[10px]" />
              <div className="dashboard-metric__body">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          ))}
        </section>

        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          {/* 左侧分类栏 */}
          <div className="surface-card hidden p-2 lg:block" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="mt-1 h-8 w-full rounded-[var(--radius-btn)] first:mt-0"
              />
            ))}
          </div>

          {/* 主列: 筛选 tab 行 + 市场卡列表 */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 border-b border-[var(--rule)] pb-2 sm:h-10 sm:pb-0">
              <Skeleton className="h-6 w-16 rounded-[var(--radius-pill)]" />
              <Skeleton className="h-6 w-16 rounded-[var(--radius-pill)]" />
              <Skeleton className="h-6 w-20 rounded-[var(--radius-pill)]" />
              <Skeleton className="ml-auto h-6 w-28 rounded-[var(--radius-pill)]" />
            </div>
            <div className="mt-3 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <MarketCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
