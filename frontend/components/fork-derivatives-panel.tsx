"use client";

import Link from "next/link";
import { Idea } from "@/lib/types";
import { IconGitFork, IconMessage } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";

/** Fork 衍生想法列表（非「相关想法」） */
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
    <section className="border-t border-[var(--divider)] pt-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
          <IconGitFork className="h-3.5 w-3.5 text-[var(--ink-faint)]" />
          {t("idea.forkDerivatives")}
        </h2>
        <span className="font-code text-[11px] tabular-nums text-[var(--ink-faint)]">
          {children.length}
        </span>
      </div>
      <ul className="divide-y divide-[var(--rule)] overflow-hidden rounded-md border border-[var(--rule)]">
        {children.map((idea) => (
          <li key={idea.id}>
            <Link
              href={`/ideas/${idea.id}`}
              className="flex items-center justify-between gap-3 bg-[var(--bg-surface)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-subtle)]"
            >
              <span className="min-w-0 truncate text-[13px] font-medium text-[var(--ink)]">
                {idea.title}
              </span>
              <span className="flex shrink-0 items-center gap-3 text-[11px] tabular-nums text-[var(--ink-faint)]">
                <span className="inline-flex items-center gap-0.5">
                  <IconMessage className="h-3 w-3" />
                  {idea.comment_count}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <IconGitFork className="h-3 w-3" />
                  {idea.fork_count}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
