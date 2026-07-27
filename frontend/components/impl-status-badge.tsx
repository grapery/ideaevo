import { IDEA_IMPL_STATUS_LABELS, type IdeaImplStatus } from "@/lib/types";

const statusClass: Record<string, string> = {
  concept: "bg-[var(--bg-subtle)] text-[var(--ink-soft)]",
  in_progress: "bg-[var(--primary-soft)] text-[var(--primary)]",
  implemented: "bg-[var(--accent-success-light)] text-[var(--accent-success)]",
  paused: "bg-[var(--bg-subtle)] text-[var(--ink-faint)]",
};

export function ImplStatusBadge({ status }: { status: IdeaImplStatus | string | undefined }) {
  if (!status) return null;
  const label = IDEA_IMPL_STATUS_LABELS[status];
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
