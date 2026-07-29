"use client";

import { IDEA_IMPL_STATUS_LABELS, type IdeaImplStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n/provider";

const statusClass: Record<string, string> = {
  concept: "bg-[var(--bg-subtle)] text-[var(--ink-soft)]",
  in_progress: "bg-[var(--primary-soft)] text-[var(--primary)]",
  implemented: "bg-[var(--accent-success-light)] text-[var(--accent-success)]",
  paused: "bg-[var(--bg-subtle)] text-[var(--ink-faint)]",
};

export function ImplStatusBadge({ status }: { status: IdeaImplStatus | string | undefined }) {
  const { locale } = useI18n();
  if (!status) return null;
  const label = locale === "zh-CN"
    ? IDEA_IMPL_STATUS_LABELS[status]
    : ({
        concept: "Concept",
        in_progress: "In progress",
        implemented: "Implemented",
        paused: "Paused",
      } as Record<string, string>)[status];
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${
        statusClass[status] || statusClass.concept
      }`}
    >
      {label}
    </span>
  );
}
