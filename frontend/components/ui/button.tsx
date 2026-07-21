import { ReactNode } from "react";
import Link from "next/link";

/**
 * Button —— 统一的三档按钮组件。
 *
 * variant：
 *   - primary：中等主按钮（ink 描边，图标+文字），核心操作。映射 .btn-outline
 *   - ghost：  小次按钮（rule 描边 + 灰度），次要操作。映射 .btn-default .btn-sm
 *   - danger： 危险描边按钮。映射 .btn-danger
 *
 * size 默认：primary → md（中等偏大），ghost → sm（小）。可显式覆盖。
 * href：提供时渲染 next/link <Link>（覆盖项目中大量 <Link className="btn-*"> 场景），
 *       否则渲染原生 <button>。
 * icon / iconRight：左/右图标（建议传 <DeimosIcon name="...">，与 Ardot Ic 设计对齐）。
 */
type Variant = "primary" | "ghost" | "danger";
type Size = "md" | "sm";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn-outline",
  ghost: "btn-default",
  danger: "btn-danger",
};

export interface ButtonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  href?: string;
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  type?: "button" | "submit" | "reset";
  title?: string;
  ariaLabel?: string;
  target?: string;
  rel?: string;
}

export function Button({
  variant = "primary",
  size,
  icon,
  iconRight,
  href,
  className = "",
  children,
  disabled,
  onClick,
  type = "button",
  title,
  ariaLabel,
  target,
  rel,
}: ButtonProps) {
  // size 默认：primary 用 md（中等），ghost 用 sm（小）
  const resolvedSize = size ?? (variant === "ghost" ? "sm" : "md");
  const classes = [
    VARIANT_CLASS[variant],
    resolvedSize === "sm" ? "btn-sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      {icon}
      {children}
      {iconRight}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        target={target}
        rel={rel}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      {inner}
    </button>
  );
}
