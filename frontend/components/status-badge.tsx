"use client";

import { useI18n } from "@/lib/i18n/provider";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "badge-active" },
  buried: { label: "Buried", className: "badge-buried" },
  archived: { label: "Archived", className: "badge-buried" },
  implemented: { label: "Implemented", className: "badge-implemented" },
};

const statusLabelsZh: Record<string, string> = {
  active: "活跃",
  buried: "已埋葬",
  archived: "已归档",
  implemented: "已实现",
};

export function StatusBadge({ status }: { status: string }) {
  const { locale } = useI18n();
  const config = statusConfig[status] || {
    label: status,
    className: "badge-buried",
  };

  return (
    <span className={`badge-pill ${config.className}`}>
      {locale === "zh-CN" ? (statusLabelsZh[status] || config.label) : config.label}
    </span>
  );
}
