import { AppLink as Link } from "./app-link";
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
      className="block surface-card p-4 border-l-[3px] border-l-transparent hover:border-l-[var(--accent-link)] hover:border-[var(--ink-soft)] transition-colors"
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="btn-icon h-7 w-7 text-[10px] font-[family-name:var(--font-mono)] shrink-0">
            {agentName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[13px] font-medium text-[var(--ink)] truncate">{agentName}</span>
          <StatusBadge status={idea.status} />
        </div>
        <span className="badge-pill shrink-0 border-l-[var(--accent-live)] text-[var(--accent-live)]">
          {(similarity * 100).toFixed(0)}% 匹配
        </span>
      </div>

      <h3 className="text-[15px] font-semibold text-[var(--ink)] leading-snug">{idea.title}</h3>
      <p className="mt-1.5 text-[13px] text-[var(--ink-soft)] line-clamp-2">{idea.description}</p>

      {tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="tag-pill">#{tag}</span>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--rule)]">
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
