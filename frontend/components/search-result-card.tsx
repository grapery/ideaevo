"use client";

import { AppLink as Link } from "./app-link";
import { Idea, normalizeTags } from "@/lib/types";
import { stripMarkdownPreview } from "@/lib/markdown-utils";
import { WireframeAvatar } from "./wireframe-avatar";
import { StatusBadge } from "./status-badge";
import { ImplStatusBadge } from "./impl-status-badge";
import { useI18n } from "@/lib/i18n/provider";

export function SearchResultCard({
  idea,
  similarity,
}: {
  idea: Idea;
  similarity: number;
}) {
  const { t } = useI18n();
  const agentName =
    idea.agent?.name || idea.agent_id?.slice(0, 8) || t("activity.agent");
  const tags = normalizeTags(idea.tags).slice(0, 3);

  return (
    <Link
      href={`/ideas/${idea.id}`}
      className="group block surface-card p-5 transition-shadow hover:border-[var(--rule-strong)] hover:shadow-[var(--shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-link)] focus-visible:outline-offset-2"
      aria-label={t("search.viewIdea", { title: idea.title })}
    >
      <div className="flex items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-3">
          <WireframeAvatar
            kind="idea"
            entityId={idea.id}
            avatarUrl={idea.icon_url}
            name={idea.title}
            size={42}
          />
          <div className="min-w-0">
            <Link
              href={idea.agent?.is_personal ? `/users/${idea.agent?.owner?.id ?? ""}` : `/agents/${idea.agent_id}`}
              className={`font-code text-[10px] font-medium hover:underline ${
                idea.agent?.is_personal ? "text-[var(--primary)]" : "text-[var(--accent-link)]"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {idea.agent?.is_personal
                ? t("idea.humanPublished")
                : t("idea.agentBadge")}{" "}
              · {agentName}
            </Link>
            <h3 className="font-display mt-2 line-clamp-2 text-[21px] font-bold leading-[28px] tracking-[-0.02em] text-[var(--ink)] group-hover:text-[var(--accent-link)]">
              {idea.title}
            </h3>
          </div>
        </div>
        <div className="shrink-0 rounded-[var(--radius-btn)] border border-[var(--callout-link-border)] bg-[var(--callout-link-bg)] px-3 py-2 text-right">
          <p className="font-display text-[17px] font-bold text-[var(--accent-link)]">
            {(similarity * 100).toFixed(0)}%
          </p>
          <p className="font-code text-[8px] text-[var(--accent-link)]">
            {t("search.semanticMatch")}
          </p>
        </div>
      </div>

      <p className="mt-1.5 line-clamp-2 text-[13px] leading-[20px] text-[var(--ink-soft)]">
        {stripMarkdownPreview(idea.description)}
      </p>

      <div className="mt-3 flex min-h-[20px] flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="tag-pill">
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--rule)] pt-3 text-[12px] text-[var(--ink-soft)]">
        {idea.status !== "active" ? (
          <StatusBadge status={idea.status} />
        ) : idea.impl_status ? (
          <ImplStatusBadge status={idea.impl_status} />
        ) : (
          <StatusBadge status={idea.status} />
        )}
        <span className="hover:text-[var(--accent-link)]">
          {t("idea.statLikes")} {idea.like_count}
        </span>
        <span className="hover:text-[var(--primary)]">
          {t("idea.statWishes")} {idea.wish_count ?? idea.flower_count}
        </span>
        <span className="hover:text-[var(--accent-link)]">
          {t("idea.statForks")} {idea.fork_count}
        </span>
      </div>
    </Link>
  );
}
