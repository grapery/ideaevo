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
  progress: "check",
  note: "document",
};

const typeTone: Record<string, string> = {
  version: "text-[var(--accent-link)]",
  status: "text-[var(--accent-warning)]",
  suggestion_selected: "text-[var(--accent-link)]",
  job_progress: "text-[var(--ink-faint)]",
  job_done: "text-[var(--accent-success)]",
  job_failed: "text-[var(--accent-warning)]",
  progress: "text-[var(--accent-success)]",
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
  if (days < 30) return locale === "en" ? `${days}d ago` : `${days} 天前`;
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
  });
}

/**
 * idea 公开演进时间线：单行紧凑流（图标内联 + 标题 + 右对齐时间），
 * 不用竖线/圆底装饰——密度优先，十级事件也只占一小块。
 * job_progress 默认只平铺最新 2 条，其余折叠。
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

  const VISIBLE_CAP = 8;
  // 高频流水类事件（任务进展 / done list 完成）只平铺最新 2 条，
  // 避免批量汇报挤掉 version/status 等关键演进事件。
  const flowing = entries.filter((e) => e.type === "job_progress" || e.type === "progress");
  const rest = entries.filter((e) => e.type !== "job_progress" && e.type !== "progress");
  const renderItems = [...rest, ...flowing.slice(0, 2)];
  const visible = renderItems.slice(0, VISIBLE_CAP);
  const hidden = renderItems.slice(VISIBLE_CAP).concat(flowing.slice(2));

  const row = (e: ChangelogEntry) => (
    <li key={e.id} className="flex items-center gap-2 py-0.5 text-[12.5px] leading-5">
      <DeimosIcon
        name={typeIcon[e.type] || "document"}
        className={`h-3.5 w-3.5 shrink-0 ${typeTone[e.type] || "text-[var(--ink-faint)]"}`}
      />
      <span className="min-w-0 shrink truncate font-medium text-[var(--ink)]">{e.title}</span>
      {e.detail && (
        <span className="hidden min-w-0 shrink truncate text-[11px] text-[var(--ink-faint)] sm:inline">
          {e.detail}
        </span>
      )}
      <time className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-[var(--ink-faint)]">
        {formatAt(e.created_at, locale)}
      </time>
    </li>
  );

  return (
    <section className="surface-card px-4 py-3.5 sm:px-5" id="changelog">
      <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
        <DeimosIcon name="pulse" className="h-3.5 w-3.5 text-[var(--primary)]" />
        {t("changelog.title")}
      </h2>
      <ul className="space-y-0.5">{visible.map((e) => row(e))}</ul>
      {hidden.length > 0 && (
        <details className="mt-1.5">
          <summary className="cursor-pointer list-none text-[11px] font-medium text-[var(--ink-faint)] hover:text-[var(--ink-soft)]">
            {t("changelog.moreEntries", { count: hidden.length })}
          </summary>
          <ul className="mt-1 space-y-0.5">{hidden.map((e) => row(e))}</ul>
        </details>
      )}
    </section>
  );
}
