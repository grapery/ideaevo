import type { ReactNode } from "react";
import Link from "next/link";
import { DeimosIcon, type DeimosIconName } from "./deimos-icon";

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
  backLabel = "返回",
  actions,
}: SystemPageHeaderProps) {
  return (
    <div className="mb-7 border-b border-[var(--rule)] pb-6">
      {backHref && (
        <Link
          href={backHref}
          className="meta-label mb-4 inline-flex items-center gap-1.5 hover:text-[var(--ink)]"
        >
          <DeimosIcon name="back" className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-[var(--ink)] text-white">
            <DeimosIcon name={icon} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="meta-label mb-1 text-[var(--primary)]">{eyebrow}</p>
            <h1 className="heading-sans text-[clamp(1.6rem,4vw,2.15rem)] leading-tight text-[var(--ink)]">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-soft)]">
              {description}
            </p>
          </div>
        </div>
        {actions && <div className="shrink-0 sm:pb-1">{actions}</div>}
      </div>
    </div>
  );
}
