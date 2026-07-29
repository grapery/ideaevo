import type { ReactNode } from "react";
import Link from "next/link";

type IconActionTone = "default" | "active" | "danger";

type IconActionButtonProps = {
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: IconActionTone;
  className?: string;
};

const toneClass: Record<IconActionTone, string> = {
  default:
    "border-[var(--ink)] bg-white text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]",
  active:
    "border-[var(--accent-link)] bg-[#eaf1ff] text-[var(--accent-link)] hover:bg-[#dce8ff]",
  danger:
    "border-[var(--coral)] bg-white text-[var(--coral)] hover:bg-[#fff1ef]",
};

export function IconActionButton({
  icon,
  label,
  href,
  onClick,
  disabled = false,
  tone = "default",
  className = "",
}: IconActionButtonProps) {
  const classes = [
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
    "transition-[background-color,color,border-color,transform] duration-150",
    "hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-[var(--accent-link)] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-45",
    toneClass[tone],
    className,
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={label} title={label}>
        {icon}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classes}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
