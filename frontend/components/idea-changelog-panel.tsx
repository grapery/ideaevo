import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";
import type { ChangelogEntry } from "@/lib/types";
import type { Locale } from "@/lib/i18n/messages";
import { getServerI18n } from "@/lib/i18n/server";

const typeIcon: Record<string, DeimosIconName> = {
  version: "publish",
  status: "lifecycle",
  suggestion_selected: "decision",
  job_progress: "pulse",
  job_done: "check",
  job_failed: "close",
  note: "document",
};

const typeTone: Record<string, string> = {
  version: "text-[var(--accent-link)]",
  status: "text-[var(--accent-warning)]",
  suggestion_selected: "text-[var(--accent-link)]",
  job_progress: "text-[var(--ink-faint)]",
  job_done: "text-[var(--accent-success)]",
  job_failed: "text-[var(--accent-warning)]",
  note: "text-[var(--primary)]",
};

function formatAt(at: string, locale: Locale) {
  const d = new Date(at);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) {
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return locale === "en" ? "just now" : "刚刚";
    return locale === "en" ? `${hours}h ago` : `${hours} 小时前`;
  }
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
  });
}

/**
 * idea 公开演进时间线：版本 / 状态 / 采纳建议 / 实现进展与结果。
 * job_progress 默认折叠（Agent 的阶段性汇报较密），其余类型平铺。
 */
export async function IdeaChangelogPanel({
  entries,
  locale,
}: {
  entries: ChangelogEntry[];
  locale: Locale;
}) {
  const { t } = await getServerI18n();

  if (!entries || entries.length === 0) return null;

  const progress = entries.filter((e) => e.type === "job_progress");
  const rest = entries.filter((e) => e.type !== "job_progress");
  const renderItems = [...rest, ...progress.slice(0, 2)]; // 最新 2 条进展平铺，其余折叠

  const row = (e: ChangelogEntry) => (
    <li key={e.id} className="relative pl-6">
      <span
        className={`absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-subtle)] ${typeTone[e.type] || "text-[var(--ink-faint)]"}`}
      >
        <DeimosIcon name={typeIcon[e.type] || "document"} className="h-2.5 w-2.5" />
      </span>
      <p className="text-[13px] leading-6">
        <span className="font-medium text-[var(--ink)]">{e.title}</span>
        {e.detail && (
          <span className="ml-2 break-all text-[12px] text-[var(--ink-faint)]">{e.detail}</span>
        )}
      </p>
      <p className="text-[11px] text-[var(--ink-faint)]">
        {formatAt(e.created_at, locale)}
        {e.actor_name ? ` · ${e.actor_name}` : ""}
      </p>
    </li>
  );

  return (
    <section className="surface-card p-5 sm:p-6" id="changelog">
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-[var(--ink)]">
        <DeimosIcon name="pulse" className="h-4 w-4 text-[var(--primary)]" />
        {t("changelog.title")}
      </h2>
      <ul className="space-y-4 border-l border-[var(--rule)]">
        {renderItems.map(row)}
      </ul>
      {progress.length > 2 && (
        <details className="mt-3">
          <summary className="cursor-pointer list-none text-[12px] font-medium text-[var(--ink-faint)] hover:text-[var(--ink-soft)]">
            {t("changelog.moreProgress", { count: progress.length - 2 })}
          </summary>
          <ul className="mt-3 space-y-3 border-l border-[var(--rule)]">{progress.slice(2).map(row)}</ul>
        </details>
      )}
    </section>
  );
}
