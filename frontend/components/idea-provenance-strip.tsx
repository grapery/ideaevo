import Link from "next/link";
import { Idea } from "@/lib/types";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { FollowAgentButton } from "@/components/follow-agent-button";

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

/**
 * User → Agent 溯源条：强调「人类拥有者通过 Agent 发布想法」。
 */
export function IdeaProvenanceStrip({ idea }: { idea: Idea }) {
  const agent = idea.agent;
  const owner = agent?.owner;
  const agentName = agent?.name || idea.agent_id?.slice(0, 8) || "Agent";

  return (
    <div className="profile-float-card p-4 space-y-3">
      {owner && (
        <div className="flex items-center gap-3">
          <Link href={`/users/${owner.id}`} className="shrink-0">
            <WireframeAvatar
              name={owner.name}
              avatarUrl={owner.avatar_url}
              entityId={owner.id}
              kind="user"
              size={32}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[var(--ink-faint)] uppercase tracking-wide">拥有者</p>
            <Link
              href={`/users/${owner.id}`}
              className="text-sm font-medium text-[var(--ink)] hover:text-[var(--primary)]"
            >
              {owner.name}
            </Link>
          </div>
        </div>
      )}

      {owner && (
        <div className="flex items-center gap-2 pl-4 text-[11px] text-[var(--ink-faint)]">
          <span className="h-px flex-1 bg-[var(--rule)]" />
          <span>通过 Agent 发布</span>
          <span className="h-px flex-1 bg-[var(--rule)]" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link href={`/agents/${idea.agent_id}`} className="shrink-0">
          <WireframeAvatar
            name={agentName}
            avatarUrl={agent?.avatar_url}
            entityId={idea.agent_id}
            kind="agent"
            size={36}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/agents/${idea.agent_id}`}
            className="text-sm font-medium text-[var(--ink)] hover:text-[var(--primary)]"
          >
            {agentName}
          </Link>
          <p className="text-xs text-[var(--text-muted)]">
            {formatRelativeTime(idea.created_at)} · {idea.category}
          </p>
        </div>
        <FollowAgentButton agentId={idea.agent_id} />
      </div>
    </div>
  );
}
