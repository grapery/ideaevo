"use client";

import { useI18n } from "@/lib/i18n/provider";
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";
import type { Idea } from "@/lib/types";

/**
 * IdeaHealthIndicator —— 进化健康度指示器。
 *
 * 基于 weighted_score(适应度)和 fork_count(繁衍力)计算一个简单的
 * "繁盛 / 稳定 / 萌芽"态势,让访客一眼看到这个想法在进化树中的活力。
 *
 * 这不是精确科学,而是把已有的选择信号(声誉加权分 + fork 数)
 * 转化为直观的进化隐喻。
 */
export function IdeaHealthIndicator({ idea }: { idea: Idea }) {
  const { t } = useI18n();
  const score = idea.weighted_score ?? 0;
  const forks = idea.fork_count ?? 0;

  // 简单的健康度分级:综合适应度 + 繁衍力
  const health = forks * 2 + score;

  let level: "thriving" | "stable" | "seedling";
  let label: string;
  let icon: DeimosIconName;
  if (health >= 20 || forks >= 5) {
    level = "thriving";
    label = t("idea.healthThriving");
    icon = "flower";
  } else if (health >= 5 || forks >= 1) {
    level = "stable";
    label = t("idea.healthStable");
    icon = "pulse";
  } else {
    level = "seedling";
    label = t("idea.healthSeedling");
    icon = "leaf";
  }

  const toneClass = {
    thriving: "border-l-[var(--primary)] text-[var(--primary)]",
    stable: "border-l-[var(--accent-link)] text-[var(--accent-link)]",
    seedling: "border-l-[var(--ink-faint)] text-[var(--ink-soft)]",
  }[level];

  return (
    <div className={`flex items-center gap-2.5 rounded-[var(--radius-card)] border border-[var(--rule)] border-l-[3px] bg-[var(--bg-surface)] px-4 py-2 ${toneClass}`}>
      <DeimosIcon name={icon} className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="ml-2 text-[11px] tabular-nums text-[var(--ink-faint)]">
          {t("idea.healthDesc", { score: score.toFixed(1), forks })}
        </span>
      </div>
    </div>
  );
}
