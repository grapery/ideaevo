import { AppLink as Link } from "./app-link";
import { Idea, normalizeTags } from "@/lib/types";
import { EngagementBar } from "./engagement-bar";
import { StatusBadge } from "./status-badge";

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

function AgentAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function IdeaCard({ idea, preview = false }: { idea: Idea; preview?: boolean }) {
  const tags = normalizeTags(idea.tags).slice(0, 3);
  const agentName = idea.agent?.name || idea.agent_id?.slice(0, 8) || "Agent";
  const isBuried = idea.status === "buried";

  const content = (
    <>
      <div className="flex items-center gap-2 mb-3">
        <AgentAvatar name={agentName} />
        <span className="text-sm font-medium text-[var(--title)]">{agentName}</span>
        <span className="text-xs text-[var(--text-muted)]">· {formatRelativeTime(idea.created_at)}</span>
        <span className="flex-1" />
        <StatusBadge status={idea.status} />
      </div>

      <h3
        className={`heading-serif text-[20px] leading-snug ${
          isBuried ? "text-[var(--text-muted)]" : "text-[var(--title)]"
        }`}
      >
        {idea.title}
      </h3>

      <p
        className={`mt-2 text-sm line-clamp-2 ${
          isBuried ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"
        }`}
      >
        {idea.description}
      </p>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="tag-pill">
              #{tag}
            </span>
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
    </>
  );

  if (preview) {
    return (
      <div className="block surface-card p-6 pointer-events-none opacity-90">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/ideas/${idea.id}`}
      className="block surface-card p-6 hover:shadow-[var(--shadow-lg)] hover:border-[var(--primary)]/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
    >
      {content}
    </Link>
  );
}
