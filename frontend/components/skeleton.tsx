export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[var(--bg-subtle)] ${className || ""}`}
    />
  );
}

/** 紧凑卡片骨架(对应 idea-card default 变体) */
export function IdeaCardSkeleton() {
  return (
    <div className="surface-card p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-2/3" />
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="mt-4 flex gap-4 border-t border-[var(--rule)] pt-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

/** 市场列表卡片骨架(对应 idea-card market 变体,更高的横向布局) */
export function MarketCardSkeleton() {
  return (
    <div className="surface-card px-5 py-4">
      {/* 头部元信息行 */}
      <Skeleton className="h-3 w-40" />
      {/* 标题行:图标 + 标题 */}
      <div className="mt-3 flex items-start gap-3">
        <Skeleton className="h-[42px] w-[42px] shrink-0 rounded" />
        <Skeleton className="mt-1 h-6 flex-1" />
      </div>
      {/* 描述 */}
      <Skeleton className="mt-1.5 h-4 w-full" />
      <Skeleton className="mt-1 h-4 w-4/5" />
      {/* 标签 */}
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      {/* 底部统计行 */}
      <div className="mt-4 flex gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="ml-auto h-4 w-12" />
      </div>
    </div>
  );
}

/**
 * IdeaDetailSkeleton —— 匹配真实详情页布局:
 * 面包屑 → header 卡片(徽章行 + 图标/标题/操作栏) → tab 栏 → 2 列网格(主列 + 侧栏)
 */
export function IdeaDetailSkeleton() {
  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        {/* 面包屑 */}
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-32" />
        </div>

        {/* Header 卡片 */}
        <div className="surface-card p-5 sm:p-6">
          {/* 徽章行 */}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          {/* 标题行:图标 + 标题/溯源 + 操作栏 */}
          <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-start gap-4">
              <Skeleton className="h-[52px] w-[52px] shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="mt-3 h-4 w-1/2" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9 rounded" />
              <Skeleton className="h-9 w-9 rounded" />
            </div>
          </div>
        </div>

        {/* Tab 栏 */}
        <div className="mt-4 flex gap-6 border-b border-[var(--rule)] pb-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* 2 列网格:主列 + 侧栏 */}
        <div className="app-grid-2 mt-4">
          {/* 主列 */}
          <div className="space-y-5">
            {/* 生命周期轨道(暗色) */}
            <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
            {/* 健康度指示器 */}
            <Skeleton className="h-12 w-full rounded-[var(--radius-card)]" />
            {/* 描述区 */}
            <Skeleton className="h-32 w-full" />
            {/* 元信息 */}
            <Skeleton className="h-20 w-full" />
            {/* 标签 */}
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
          {/* 侧栏 */}
          <div className="space-y-3">
            <Skeleton className="h-40 w-full surface-card p-4" />
            <Skeleton className="h-32 w-full surface-card p-4" />
            <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
