"use client";

import { AppLink as Link } from "./app-link";
import { Idea, normalizeTags } from "@/lib/types";
import { stripMarkdownPreview } from "@/lib/markdown-utils";
import { WireframeAvatar } from "./wireframe-avatar";
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
      className="group block surface-card p-4 hover:border-[var(--accent-link)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-link)] focus-visible:outline-offset-2"
      aria-label={t("search.viewIdea", { title: idea.title })}
    >
      <div className="flex items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-3">
          <WireframeAvatar
            kind="idea"
            entityId={idea.id}
            avatarUrl={idea.icon_url}
            name={idea.title}
            size={40}
          />
          <div className="min-w-0">
            <p className="font-code text-[9px] text-[var(--accent-link)]">
              {idea.agent?.is_personal
                ? t("idea.humanPublished")
                : t("idea.agentBadge")}{" "}
              · {agentName}
            </p>
            <h3 className="font-display mt-2 line-clamp-2 text-[17px] font-bold leading-[23px] text-[var(--ink)] group-hover:text-[var(--accent-link)]">
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

      <p className="mt-2 line-clamp-2 min-h-[38px] text-[12px] leading-[19px] text-[var(--ink-soft)]">
        {stripMarkdownPreview(idea.description)}
      </p>

      <div className="mt-3 flex min-h-[16px] flex-wrap gap-5 font-code text-[9px] text-[var(--ink-faint)]">
        {tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-5 border-t border-[var(--rule)] pt-3 font-code text-[9px] text-[var(--ink-soft)]">
        <span>{idea.status.toUpperCase()}</span>
        <span>
          {t("idea.statLikes")} {idea.like_count}
        </span>
        <span>
          {t("idea.statWishes")} {idea.wish_count ?? idea.flower_count}
        </span>
        <span>
          {t("idea.statForks")} {idea.fork_count}
        </span>
      </div>
    </Link>
  );
}
