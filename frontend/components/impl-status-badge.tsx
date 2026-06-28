import { IDEA_IMPL_STATUS_LABELS, type IdeaImplStatus } from "@/lib/types";

const statusClass: Record<string, string> = {
  concept: "border-[var(--rule)] bg-[var(--bg-subtle)] text-[var(--ink-soft)]",
  in_progress: "border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/10 text-[var(--accent-ochre)]",
  implemented: "border-[var(--accent-live)]/40 bg-[var(--accent-live)]/10 text-[var(--accent-live)]",
  paused: "border-[var(--rule)] bg-[var(--bg-subtle)] text-[var(--ink-faint)]",
};

export function ImplStatusBadge({ status }: { status: IdeaImplStatus | string | undefined }) {
  if (!status) return null;
  const label = IDEA_IMPL_STATUS_LABELS[status];
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center border px-1.5 py-px font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-wider ${
        statusClass[status] || statusClass.concept
      }`}
    >
      {label}
    </span>
  );
}
