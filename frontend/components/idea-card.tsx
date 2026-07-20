import { AppLink as Link } from "./app-link";
import { Idea, normalizeTags } from "@/lib/types";
import { stripMarkdownPreview } from "@/lib/markdown-utils";
import { EngagementBar } from "./engagement-bar";
import { StatusBadge } from "./status-badge";
import { ImplStatusBadge } from "./impl-status-badge";
import { WireframeAvatar } from "./wireframe-avatar";

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

function AgentBadge({ name, avatarUrl, agentId }: { name: string; avatarUrl?: string; agentId?: string }) {
  return (
    <WireframeAvatar
      name={name}
      avatarUrl={avatarUrl}
      entityId={agentId}
      kind="agent"
      size={20}
      title={name}
    />
  );
}

export function IdeaCard({ idea, preview = false }: { idea: Idea; preview?: boolean }) {
  const tags = normalizeTags(idea.tags).slice(0, 3);
  const agentName = idea.agent?.name || idea.agent_id?.slice(0, 8) || "Agent";
  const isBuried = idea.status === "buried";

  const content = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <WireframeAvatar
          name={idea.title}
          avatarUrl={idea.icon_url}
          entityId={idea.id}
          kind="idea"
          shape="rounded"
          size={32}
          title={idea.title}
        />
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <AgentBadge
            name={agentName}
            avatarUrl={idea.agent?.avatar_url}
            agentId={idea.agent_id}
          />
          <span className="truncate text-[13px] font-medium text-[var(--ink)]">{agentName}</span>
        </div>
        <span className="meta-label normal-case tracking-normal shrink-0">· {formatRelativeTime(idea.created_at)}</span>
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
        className={`text-[15px] font-semibold leading-snug tracking-tight transition-colors ${
          isBuried ? "text-[var(--ink-faint)]" : "text-[var(--ink)] group-hover:text-[var(--primary)]"
        }`}
      >
        {idea.title}
      </h3>

      <p
        className={`mt-1.5 text-[13px] line-clamp-2 leading-relaxed ${
          isBuried ? "text-[var(--ink-faint)]" : "text-[var(--ink-soft)]"
        }`}
      >
        {stripMarkdownPreview(idea.description)}
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
      className="group block surface-card p-4 sm:p-5 border-l-[3px] border-l-transparent rounded-[var(--radius-card)] hover:border-l-[var(--accent-link)] hover:bg-[var(--bg-subtle)] hover:shadow-[var(--shadow-float)] transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)] focus-visible:outline-offset-2"
      aria-label={`查看想法：${idea.title}`}
    >
      {content}
    </Link>
  );
}
