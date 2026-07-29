import { ReactNode } from "react";

/**
 * CountButton —— 「图标 + 数字/文字 + 线框」计数按钮。
 *
 * variant：
 *   - standard：标准线框（ink-soft 描边），用于卡片 / 列表底部互动条。映射 .btn-count
 *   - soft：    轻线框（rule 描边 + 灰度），用于详情页大互动区。叠加 .btn-count-soft
 *
 * tone：激活态的语义色（点赞 coral / 期待 link / Fork primary / 默认 ink）。
 *       仅在 active=true 时生效，通过 inline style 覆盖默认配色。
 * icon：左图标（建议 <DeimosIcon name="heart|wish|fork|comment|...">）。可选——纯文字项（如「举报」）可不传。
 * count / label：二选一。count 是数字计数；label 是文字（「收藏」「分享」「举报」）。
 */
type CountVariant = "standard" | "soft";
type Tone = "ink" | "coral" | "teal" | "primary" | "link";

const TONE_COLOR: Record<Tone, string> = {
  ink: "var(--ink)",
  coral: "var(--coral)",
  teal: "var(--teal)",
  primary: "var(--primary)",
  link: "var(--accent-link)",
};

export interface CountButtonProps {
  icon?: ReactNode;
  count?: number;
  label?: ReactNode;
  active?: boolean;
  variant?: CountVariant;
  tone?: Tone;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  className?: string;
}

export function CountButton({
  icon,
  count,
  label,
  active = false,
  variant = "standard",
  tone = "ink",
  onClick,
  disabled,
  ariaLabel,
  title,
  className = "",
}: CountButtonProps) {
  const classes = [
    "btn-count",
    variant === "soft" ? "btn-count-soft" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // 激活态用 tone 色覆盖（inline style 优先级高于 CSS 类）
  const activeStyle = active
    ? { color: TONE_COLOR[tone], borderColor: TONE_COLOR[tone] }
    : undefined;

  const content = label !== undefined ? label : count;

  return (
    <button
      type="button"
      className={classes}
      data-active={active ? "true" : undefined}
      style={activeStyle}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      aria-pressed={active}
    >
      {icon}
      {content !== undefined && <span>{content}</span>}
    </button>
  );
}
