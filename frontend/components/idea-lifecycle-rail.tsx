"use client";

import { useI18n } from "@/lib/i18n/provider";
import { DeimosIcon } from "@/components/deimos-icon";
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

export function IdeaLifecycleRail({ idea }: { idea: Idea }) {
  const { t, locale } = useI18n();
  const active = resolveStepIndex(idea);
  const isPaused = idea.impl_status === "paused";

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--panel-inverse)] bg-[var(--panel-inverse)] text-white">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-stretch sm:justify-between sm:gap-8 sm:p-6">
        {/* Lifecycle track */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium tracking-wide text-white/55">
              {t("idea.lifecycle")}
            </p>
            {isPaused && (
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
                {t("idea.paused")}
              </span>
            )}
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
                      className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition-colors ${
                        current
                          ? "bg-[var(--panel-inverse-accent)] text-[var(--panel-inverse)] shadow-[0_0_0_4px_rgba(155,255,0,0.18)]"
                          : done
                            ? "bg-white text-[var(--panel-inverse)]"
                            : "border border-white/25 bg-white/5 text-white/45"
                      }`}
                    >
                      {done ? <DeimosIcon name="check" className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    {index < STEPS.length - 1 && (
                      <span
                        className={`mx-2 h-[2px] min-w-[1.5rem] flex-1 rounded-full sm:mx-3 ${
                          index < active
                            ? "bg-[var(--panel-inverse-accent)]"
                            : "bg-white/15"
                        }`}
                        aria-hidden
                      />
                    )}
                  </div>
                  <p
                    className={`mt-2.5 text-[13px] font-semibold leading-5 sm:text-[14px] ${
                      current
                        ? "text-[var(--panel-inverse-accent)]"
                        : done
                          ? "text-white"
                          : "text-white/40"
                    }`}
                  >
                    {t(step.labelKey)}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-white/40 sm:text-[12px]">
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
        </div>

        {/* Time chips */}
        <div className="flex shrink-0 flex-col gap-2 sm:w-[220px]">
          <TimeChip
            label={t("idea.registered")}
            relative={relativeTime(idea.created_at, t)}
            absolute={absoluteDate(idea.created_at, locale)}
            dateTime={idea.created_at}
          />
          <TimeChip
            label={t("idea.updated")}
            relative={relativeTime(idea.updated_at, t)}
            absolute={absoluteDate(idea.updated_at, locale)}
            dateTime={idea.updated_at}
            accent
          />
        </div>
      </div>
    </div>
  );
}

function TimeChip({
  label,
  relative,
  absolute,
  dateTime,
  accent = false,
}: {
  label: string;
  relative: string;
  absolute: string;
  dateTime: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border px-3.5 py-2.5 ${
        accent
          ? "border-[var(--panel-inverse-accent)]/35 bg-[var(--panel-inverse-accent)]/10"
          : "border-white/12 bg-white/5"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/45">
        {label}
      </p>
      <time dateTime={dateTime} className="mt-1 block">
        <span
          className={`text-[15px] font-semibold leading-5 ${
            accent ? "text-[var(--panel-inverse-accent)]" : "text-white"
          }`}
        >
          {relative}
        </span>
        <span className="mt-0.5 block text-[12px] leading-4 text-white/45">
          {absolute}
        </span>
      </time>
    </div>
  );
}
