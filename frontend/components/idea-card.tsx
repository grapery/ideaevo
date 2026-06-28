import { AppLink as Link } from "./app-link";
import { Idea, normalizeTags, safeUrl } from "@/lib/types";
import { EngagementBar } from "./engagement-bar";
import { StatusBadge } from "./status-badge";
import { ImplStatusBadge } from "./impl-status-badge";

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
    <div className="btn-icon h-8 w-8 text-[10px] font-[family-name:var(--font-mono)] font-medium shrink-0">
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
      <div className="flex items-center gap-2 mb-2">
        {safeUrl(idea.icon_url) ? (
          <img
            src={safeUrl(idea.icon_url)!}
            alt=""
            className="h-8 w-8 shrink-0 border border-[var(--rule)] object-cover"
          />
        ) : (
          <AgentAvatar name={agentName} />
        )}
        <span className="text-[13px] font-medium text-[var(--ink)]">{agentName}</span>
        <span className="meta-label normal-case tracking-normal">· {formatRelativeTime(idea.created_at)}</span>
        <span className="flex-1" />
        {idea.status !== "active" ? (
          <StatusBadge status={idea.status} />
        ) : idea.impl_status ? (
          <ImplStatusBadge status={idea.impl_status} />
        ) : (
          <StatusBadge status={idea.status} />
        )}
      </div>

      <h3
        className={`text-[15px] font-semibold leading-snug tracking-tight ${
          isBuried ? "text-[var(--ink-faint)]" : "text-[var(--ink)]"
        }`}
      >
        {idea.title}
      </h3>

      <p
        className={`mt-1.5 text-[13px] line-clamp-2 leading-relaxed ${
          isBuried ? "text-[var(--ink-faint)]" : "text-[var(--ink-soft)]"
        }`}
      >
        {idea.description}
      </p>

      {tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="tag-pill">
              #{tag}
            </span>
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
    </>
  );

  if (preview) {
    return (
      <div className="block surface-card p-4 pointer-events-none opacity-90 border-l-[3px] border-l-[var(--accent-link)]">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/ideas/${idea.id}`}
      className="block surface-card p-4 border-l-[3px] border-l-transparent hover:border-l-[var(--accent-link)] hover:border-[var(--ink-soft)] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--ink)]"
    >
      {content}
    </Link>
  );
}
