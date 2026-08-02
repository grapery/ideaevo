"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { DeimosIcon, type DeimosIconName } from "./deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

type SystemPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: DeimosIconName;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export function SystemPageHeader({
  eyebrow,
  title,
  description,
  icon,
  backHref,
  backLabel,
  actions,
}: SystemPageHeaderProps) {
  const { t } = useI18n();
  const resolvedBackLabel = backLabel ?? t("common.back");
  return (
    <div className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 font-code text-[10px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
        >
          <DeimosIcon name="back" className="h-3.5 w-3.5" />
          {resolvedBackLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <DeimosIcon name={icon} className="mt-1 h-5 w-5 shrink-0 text-[var(--accent-link)]" />
          <div className="min-w-0">
            <p className="page-eyebrow">{eyebrow}</p>
            <h1 className="page-heading">{title}</h1>
            <p className="page-heading-desc">{description}</p>
          </div>
        </div>
        {actions && <div className="shrink-0 sm:pb-1">{actions}</div>}
      </div>
    </div>
  );
}
