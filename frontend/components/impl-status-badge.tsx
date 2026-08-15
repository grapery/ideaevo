"use client";

import { type IdeaImplStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

const statusClass: Record<string, string> = {
  concept: "bg-[var(--bg-subtle)] text-[var(--ink-soft)]",
  in_progress: "bg-[var(--primary-soft)] text-[var(--primary)]",
  implemented: "bg-[var(--accent-success-light)] text-[var(--accent-success)]",
  paused: "bg-[var(--bg-subtle)] text-[var(--ink-faint)]",
};

const STATUS_KEY: Record<string, TranslationKey> = {
  concept: "idea.concept",
  in_progress: "idea.inProgress",
  implemented: "idea.implemented",
  paused: "idea.paused",
};

export function ImplStatusBadge({ status }: { status: IdeaImplStatus | string | undefined }) {
  const { t } = useI18n();
  if (!status) return null;
  const key = STATUS_KEY[status];
  if (!key) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${
        statusClass[status] || statusClass.concept
      }`}
    >
      {t(key)}
    </span>
  );
}
