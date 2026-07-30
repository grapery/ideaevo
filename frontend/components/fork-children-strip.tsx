"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Idea } from "@/lib/types";
import { getApiBase } from "@/lib/api-base";
import { IconGitFork, IconMessage } from "./icons";
import { useI18n } from "@/lib/i18n/provider";

export function ForkChildrenStrip({
  ideaId,
  open,
}: {
  ideaId: string;
  open: boolean;
}) {
  const { t } = useI18n();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${getApiBase()}/ideas/${ideaId}/fork-children`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { ideas: [] }))
      .then((data) => {
        if (!cancelled) {
          setIdeas(data.ideas || []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setIdeas([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ideaId, open, loaded]);

  if (!open) return null;

  return (
    <div className="border-t border-[var(--divider)] py-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
        <IconGitFork className="h-3.5 w-3.5" />
        {t("idea.forkChildrenTitle")}
      </div>
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">{t("common.loading")}</p>
      ) : ideas.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">{t("idea.forkNoChildren")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {ideas.map((item) => (
            <Link
              key={item.id}
              href={`/ideas/${item.id}`}
              className="group flex flex-col gap-1.5 rounded-lg border border-[var(--divider)] bg-[var(--bg-subtle)] p-3 transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
            >
              <span className="line-clamp-2 text-sm font-medium text-[var(--title)] group-hover:text-[var(--primary)]">
                {item.title}
              </span>
              <span className="line-clamp-2 text-xs text-[var(--text-muted)]">
                {item.description}
              </span>
              <div className="mt-auto flex items-center gap-3 text-[11px] tabular-nums text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-0.5">
                  <IconMessage className="h-3 w-3" />
                  {item.comment_count}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <IconGitFork className="h-3 w-3" />
                  {item.fork_count}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
