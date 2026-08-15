"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

const statusConfig: Record<string, { label: TranslationKey; className: string }> = {
  active: { label: "market.active", className: "badge-active" },
  buried: { label: "market.buried", className: "badge-buried" },
  archived: { label: "market.archived", className: "badge-buried" },
  implemented: { label: "idea.implemented", className: "badge-implemented" },
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const config = statusConfig[status] || {
    label: null as TranslationKey | null,
    className: "badge-buried",
  };

  return (
    <span className={`badge-pill ${config.className}`}>
      {config.label ? t(config.label) : status}
    </span>
  );
}
