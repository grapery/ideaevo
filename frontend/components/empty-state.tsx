import type { ReactNode } from "react";
import { DeimosIcon, type DeimosIconName } from "./deimos-icon";

/**
 * EmptyState —— 全站统一的空状态组件。
 *
 * 收敛此前散落的 6+ 种 dashed/inline/card 空状态写法:
 *   - 统一文本色 --ink-faint
 *   - 统一圆角 --radius-card
 *   - 统一图标系统 DeimosIcon(默认 leaf)
 *   - 可选 action(CTA 按钮)
 *
 * variant:
 *   - card:   surface-card 包裹,用于页面级空状态(列表无数据、404、error)
 *   - dashed: dashed 边框 + bg-subtle,用于区块级空状态(无描述、无评论、无证据)
 *   - inline: 无额外容器,直接渲染(嵌入已有卡片内部时用)
 */
type EmptyStateVariant = "card" | "dashed" | "inline";

export interface EmptyStateProps {
  /** DeimosIcon 名称,默认 leaf(品牌延续)。 */
  icon?: DeimosIconName;
  /** 主标题/单行文案。 */
  title: string;
  /** 可选副标题(更淡)。 */
  hint?: string;
  /** 可选 CTA(按钮等)。 */
  action?: ReactNode;
  /** 视觉变体,默认 card。 */
  variant?: EmptyStateVariant;
  /** 图标大小,默认 h-10 w-10(card/dashed) / h-6 w-6(inline)。 */
  iconClassName?: string;
  className?: string;
}

const VARIANT_WRAPPER: Record<EmptyStateVariant, string> = {
  card: "surface-card px-6 py-16 text-center",
  dashed:
    "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--rule)] bg-[var(--bg-subtle)] px-4 py-10 text-center",
  inline: "flex flex-col items-center justify-center px-4 py-8 text-center",
};

export function EmptyState({
  icon = "leaf",
  title,
  hint,
  action,
  variant = "card",
  iconClassName,
  className,
}: EmptyStateProps) {
  const defaultIcon =
    variant === "inline" ? "h-6 w-6" : "h-10 w-10";
  const wrapper = VARIANT_WRAPPER[variant];
  return (
    <div className={`${wrapper} ${className || ""}`.trim()}>
      <DeimosIcon
        name={icon}
        className={`${iconClassName || defaultIcon} mb-3 text-[var(--ink-faint)]`}
        aria-hidden="true"
      />
      <p className="text-[13px] font-medium text-[var(--ink-soft)]">{title}</p>
      {hint && (
        <p className="mt-1 text-[12px] leading-5 text-[var(--ink-faint)]">
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
