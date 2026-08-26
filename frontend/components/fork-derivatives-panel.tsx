"use client";

import Link from "next/link";
import { Idea } from "@/lib/types";
import { DeimosIcon } from "@/components/deimos-icon";
import { IconMessage } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Fork 衍生想法列表(进化树主列视图)。
 * 展示当前想法的后代分支,以进化树的视觉隐喻呈现:
 * 每个子分支显示标题 + 评论数 + 自身 fork 数(它的繁衍力)。
 */
export function ForkDerivativesPanel({
  ideas,
  currentId,
}: {
  ideas: Idea[];
  currentId: string;
}) {
  const { t } = useI18n();
  const children = ideas.filter((i) => i.id !== currentId);
  if (children.length === 0) return null;

  return (
    <section
      id="fork-derivatives"
      className="scroll-mt-24 border-t border-[var(--divider)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
          <DeimosIcon name="fork" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
          {t("idea.forkDerivatives")}
        </h2>
        <span className="font-code text-[11px] tabular-nums text-[var(--ink-faint)]">
          {children.length}
        </span>
      </div>
      {/* 进化树视觉:竖向连接线 + 分支节点,每个子想法是一个"分支" */}
      <div className="relative space-y-0 pl-4 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--rule)]">
        {children.map((idea) => (
          <Link
            key={idea.id}
            href={`/ideas/${idea.id}`}
            className="group relative flex items-center justify-between gap-3 py-2.5 before:absolute before:left-[-14px] before:top-1/2 before:h-2.5 before:w-2.5 before:-translate-y-1/2 before:rounded-full before:border-2 before:border-[var(--accent-link)] before:bg-[var(--bg-surface)] transition-colors hover:bg-[var(--bg-subtle)]"
          >
            <span className="min-w-0 flex-1 truncate pl-1 text-[13px] font-medium text-[var(--ink)] group-hover:text-[var(--accent-link)]">
              {idea.title}
            </span>
            <span className="flex shrink-0 items-center gap-3 text-[11px] tabular-nums text-[var(--ink-faint)]">
              {idea.fork_count > 0 && (
                <span className="inline-flex items-center gap-0.5" title={t("idea.forkDerivatives")}>
                  <DeimosIcon name="fork" className="h-3 w-3" />
                  {idea.fork_count}
                </span>
              )}
              <span className="inline-flex items-center gap-0.5">
                <IconMessage className="h-3 w-3" />
                {idea.comment_count}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
