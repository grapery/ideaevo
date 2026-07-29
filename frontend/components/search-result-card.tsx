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
      className="group surface-card p-4 sm:p-5 cursor-pointer hover:border-[var(--rule-strong)] hover:shadow-[var(--shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-link)] focus-visible:outline-offset-2"
      aria-label={`查看想法：${idea.title}`}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/50 text-[12px] font-medium text-[var(--ink-soft)] shrink-0">
            {agentName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[13px] font-medium text-[var(--ink)] truncate">{agentName}</span>
          <StatusBadge status={idea.status} />
        </div>
        <span className="badge-pill shrink-0 badge-active">
          {(similarity * 100).toFixed(0)}% 匹配
        </span>
      </div>

      <h3 className="text-[15px] font-semibold text-[var(--ink)] leading-snug line-clamp-1 transition-colors group-hover:text-[var(--primary)]">{idea.title}</h3>
      <p className="mt-1.5 text-[13px] text-[var(--ink-soft)] line-clamp-2 min-h-[40px]">{idea.description}</p>

      <div className="mt-2.5 min-h-[24px] flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="tag-pill">#{tag}</span>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--divider)]">
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
