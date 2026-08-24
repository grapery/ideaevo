"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { DeimosIcon, type DeimosIconName } from "./deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

type SystemPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: DeimosIconName;
  /** 自定义头像(如用户/agent 实际头像图片),提供时取代 icon 占位框。 */
  avatar?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
};

/**
 * Operational page header — dense identity row aligned with /dashboard.
 * Eyebrow is optional (marketing pages); app pages should prefer title + short desc.
 */
export function SystemPageHeader({
  eyebrow,
  title,
  description,
  icon,
  avatar,
  backHref,
  backLabel,
  actions,
}: SystemPageHeaderProps) {
  const { t } = useI18n();
  const resolvedBackLabel = backLabel ?? t("common.back");
  return (
    <header className="mb-4 border-b border-[var(--rule)] pb-4">
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
        >
          <DeimosIcon name="back" className="h-3.5 w-3.5" />
          {resolvedBackLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {avatar ? (
            <span className="shrink-0">{avatar}</span>
          ) : icon ? (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] text-[var(--ink-soft)]">
              <DeimosIcon name={icon} className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-0.5 text-[11px] font-medium tracking-[0.01em] text-[var(--ink-faint)]">
                {eyebrow}
              </p>
            )}
            <h1 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[var(--ink)] sm:text-[20px]">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-[12px] leading-5 text-[var(--ink-faint)]">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
