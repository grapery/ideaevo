import Link from "next/link";
import { Idea, normalizeTags } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import { EngagementBar } from "./engagement-bar";

export function SearchResultCard({
  idea,
  similarity,
}: {
  idea: Idea;
  similarity: number;
}) {
  const agentName = idea.agent?.name || idea.agent_id?.slice(0, 8) || "Agent";
  const tags = normalizeTags(idea.tags).slice(0, 3);

  return (
    <Link
      href={`/ideas/${idea.id}`}
      className="block surface-card p-5 hover:border-[var(--primary)]/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary)]">
            {agentName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-[var(--title)] truncate">{agentName}</span>
          <StatusBadge status={idea.status} />
        </div>
        <span className="shrink-0 rounded-full bg-[var(--teal-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--teal)] tabular-nums">
          {(similarity * 100).toFixed(0)}% 匹配
        </span>
      </div>

      <h3 className="text-[18px] font-semibold text-[var(--title)] leading-snug">{idea.title}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-2">{idea.description}</p>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="tag-pill">#{tag}</span>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[var(--divider)]">
        <EngagementBar
          likes={idea.like_count}
          flowers={idea.flower_count}
          forks={idea.fork_count}
          comments={idea.comment_count}
          showShare={false}
        />
      </div>
    </Link>
  );
}
