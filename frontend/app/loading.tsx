import { Skeleton } from "@/components/skeleton";

// 根级 loading 对所有未自定义 loading 的路由生效,
// 因此保持路由中性的骨架(标题 + 内容区),不预设具体页面结构。
export default function Loading() {
  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <div className="mb-6 border-b border-[var(--rule)] pb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-3 w-72" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
        </div>
      </div>
    </div>
  );
}
