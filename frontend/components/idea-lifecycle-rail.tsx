"use client";

import { useI18n } from "@/lib/i18n/provider";
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";
import type { Locale, TranslationKey } from "@/lib/i18n/messages";
import type { Idea, IdeaImplStatus } from "@/lib/types";

function relativeTime(
  dateStr: string,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff) || diff < 0) return t("common.justNow");
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return t("common.justNow");
  if (minutes < 60) return t("common.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("common.daysAgo", { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t("common.monthsAgo", { count: months });
  return t("common.monthsAgo", { count: months });
}

function absoluteDate(dateStr: string, locale: Locale) {
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return new Date(dateStr).toLocaleDateString();
  }
}

function resolveStepIndex(idea: Idea): number {
  if (idea.status === "implemented" || idea.impl_status === "implemented") return 2;
  if (idea.impl_status === "in_progress" || idea.impl_status === "paused") return 1;
  return 0;
}

const STEPS: { id: IdeaImplStatus; labelKey: TranslationKey }[] = [
  { id: "concept", labelKey: "idea.concept" },
  { id: "in_progress", labelKey: "idea.inProgress" },
  { id: "implemented", labelKey: "idea.implemented" },
];

/**
 * 生命周期进度轨 —— 浅色紧凑卡片, 与全站 zinc 基线一致:
 * 已完成 = 墨黑实心, 当前步 = 品牌橙, 待推进 = 描边灰。
 * 创建/更新时间压缩为右上角元信息, 不再占独立面板。
 */
export function IdeaLifecycleRail({ idea }: { idea: Idea }) {
  const { t, locale } = useI18n();
  const active = resolveStepIndex(idea);
  const isPaused = idea.impl_status === "paused";

  // 进化健康度:与进度轨同卡展示,避免页面出现无容器孤立行
  const score = idea.weighted_score ?? 0;
  const forks = idea.fork_count ?? 0;
  const health = forks * 2 + score;
  const healthLevel: "thriving" | "stable" | "seedling" =
    health >= 20 || forks >= 5 ? "thriving" : health >= 5 || forks >= 1 ? "stable" : "seedling";
  const healthLabel = {
    thriving: t("idea.healthThriving"),
    stable: t("idea.healthStable"),
    seedling: t("idea.healthSeedling"),
  }[healthLevel];
  const healthIcon = ({
    thriving: "flower",
    stable: "pulse",
    seedling: "leaf",
  } as const)[healthLevel];
  const healthTone = {
    thriving: "text-[var(--primary)]",
    stable: "text-[var(--accent-link)]",
    seedling: "text-[var(--ink-soft)]",
  }[healthLevel];

  return (
    <section className="surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
            <DeimosIcon name="lifecycle" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
            {t("idea.lifecycle")}
          </h2>
          {isPaused && (
            <span className="badge-pill badge-outline">{t("idea.paused")}</span>
          )}
        </div>
        <p className="text-[11px] leading-4 text-[var(--ink-faint)]">
          {t("idea.registered")}{" "}
          <span className="font-medium text-[var(--ink-soft)]">{relativeTime(idea.created_at, t)}</span>
          <span className="folio-sep">·</span>
          {t("idea.updated")}{" "}
          <span className="font-medium text-[var(--ink-soft)]">{relativeTime(idea.updated_at, t)}</span>
          <span className="folio-sep">·</span>
          {absoluteDate(idea.updated_at, locale)}
        </p>
      </div>

      <ol className="mt-4 flex items-start">
        {STEPS.map((step, index) => {
          const done = index < active;
          const current = index === active;
          return (
            <li
              key={step.id}
              className={`relative flex min-w-0 flex-1 flex-col ${
                index < STEPS.length - 1 ? "pr-2 sm:pr-4" : ""
              }`}
            >
              <div className="flex items-center">
                <span
                  className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                    current
                      ? "bg-[var(--primary)] text-white shadow-[0_0_0_4px_var(--primary-soft)]"
                      : done
                        ? "bg-[var(--action)] text-[var(--action-foreground)]"
                        : "border border-[var(--rule-strong)] bg-[var(--bg-surface)] text-[var(--ink-faint)]"
                  }`}
                >
                  {done ? <DeimosIcon name="check" className="h-3 w-3" /> : index + 1}
                </span>
                {index < STEPS.length - 1 && (
                  <span
                    className={`mx-2 h-[2px] min-w-[1.5rem] flex-1 rounded-full sm:mx-3 ${
                      index < active ? "bg-[var(--action)]" : "bg-[var(--rule)]"
                    }`}
                    aria-hidden
                  />
                )}
              </div>
              <p
                className={`mt-2 text-[13px] font-semibold leading-5 ${
                  current ? "text-[var(--ink)]" : done ? "text-[var(--ink-soft)]" : "text-[var(--ink-faint)]"
                }`}
              >
                {t(step.labelKey)}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-[var(--ink-faint)]">
                {current
                  ? t("idea.lifecycleCurrent")
                  : done
                    ? t("idea.lifecycleDone")
                    : t("idea.lifecycleNext")}
              </p>
            </li>
          );
        })}
      </ol>

      {/* 进化健康度:与进度轨同卡展示,避免页面出现无容器孤立行 */}
      <div className="mt-4 flex items-center gap-2 border-t border-[var(--rule-light)] pt-3 text-[12px]">
        <DeimosIcon name={healthIcon} className={`h-3.5 w-3.5 shrink-0 ${healthTone}`} />
        <span className={`font-semibold ${healthTone}`}>{healthLabel}</span>
        <span className="tabular-nums text-[var(--ink-faint)]">
          {t("idea.healthDesc", { score: score.toFixed(1), forks })}
        </span>
      </div>
    </section>
  );
}
