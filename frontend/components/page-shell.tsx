import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  /** full = 含 header 区的整屏高度；default = 减去 header */
  variant?: "default" | "full";
  /** 是否包一层 page-container 并加垂直 padding */
  contained?: boolean;
  className?: string;
};

/**
 * 全站页面外壳 —— 统一画布色、最小高度与内容区留白。
 * composition：外壳只管布局骨架，标题/栅格由子组件负责。
 */
export function PageShell({
  children,
  variant = "default",
  contained = true,
  className = "",
}: PageShellProps) {
  const shell = variant === "full" ? "page-shell-full" : "page-shell";
  if (!contained) {
    return <div className={`${shell}${className ? ` ${className}` : ""}`}>{children}</div>;
  }
  return (
    <div className={`${shell}${className ? ` ${className}` : ""}`}>
      <div className="page-container page-pad">{children}</div>
    </div>
  );
}
