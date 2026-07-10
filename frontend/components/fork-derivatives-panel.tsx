"use client";

import Link from "next/link";
import { Idea } from "@/lib/types";

/** Fork 衍生想法列表（非「相关想法」） */
export function ForkDerivativesPanel({
  ideas,
  currentId,
}: {
  ideas: Idea[];
  currentId: string;
}) {
  const children = ideas.filter((i) => i.id !== currentId);
  if (children.length === 0) return null;

  return (
    <section className="mt-6 border-t border-[var(--divider)] pt-5">
      <h2 className="heading-sans text-base mb-3">Fork 衍生</h2>
      <ul className="space-y-2">
        {children.map((idea) => (
          <li key={idea.id}>
            <Link
              href={`/ideas/${idea.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2.5 hover:border-[var(--ink-faint)]"
            >
              <span className="text-sm text-[var(--ink)] truncate">{idea.title}</span>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">
                💬 {idea.comment_count} · 🔱 {idea.fork_count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
