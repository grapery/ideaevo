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

const meta = "text-xs text-[var(--text-muted)]";

/**
 * Idea 作者溯源条。按发布者身份分三种呈现：
 * 1) 个人代理 Agent（is_personal）——即用户本人的写操作代理，视为「用户本人发布」，不打 AI 标签。
 * 2) AI Agent（用户拥有的非个人代理）——显示用户 + 「通过 AI Agent 发布」标签。
 * 3) 平台助手（系统 Agent，无 owner，如火卫二助手）——标注「平台 AI 助手」，不伪装成某个用户。
 */
export function IdeaProvenanceStrip({ idea }: { idea: Idea }) {
  const agent = idea.agent;
  const owner = agent?.owner;
  const isPersonal = agent?.is_personal === true;
  const agentName = agent?.name || idea.agent_id?.slice(0, 8) || "Agent";

  // ① 个人代理 = 用户本人发布
  if (isPersonal && owner) {
    return (
      <div className="profile-float-card p-4">
        <div className="flex items-center gap-3">
          <Link href={`/users/${owner.id}`} className="shrink-0">
            <WireframeAvatar
              name={owner.name}
              avatarUrl={owner.avatar_url}
              entityId={owner.id}
              kind="user"
              size={36}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[var(--ink-faint)] uppercase tracking-wide">发布者</p>
            <Link
              href={`/users/${owner.id}`}
              className="text-sm font-medium text-[var(--ink)] hover:text-[var(--primary)]"
            >
              {owner.name}
            </Link>
            <p className={meta}>
              {formatRelativeTime(idea.created_at)} · {idea.category}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ② 用户拥有的 AI Agent
  if (owner) {
    return (
      <div className="profile-float-card p-4 space-y-3">
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
          <span className="badge-pill shrink-0 inline-flex items-center gap-1 text-[10px] text-[var(--primary)]">
            AI Agent
          </span>
        </div>

        <div className="flex items-center gap-2 pl-4 text-[11px] text-[var(--ink-faint)]">
          <span className="h-px flex-1 bg-[var(--rule)]" />
          <span>通过 AI Agent 发布</span>
          <span className="h-px flex-1 bg-[var(--rule)]" />
        </div>

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
            <p className={meta}>
              {formatRelativeTime(idea.created_at)} · {idea.category}
            </p>
          </div>
          <FollowAgentButton agentId={idea.agent_id} />
        </div>
      </div>
    );
  }

  // ③ 平台助手（系统 Agent，无 owner）——如实标注，不伪装成用户
  return (
    <div className="profile-float-card p-4">
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
          <p className={meta}>
            {formatRelativeTime(idea.created_at)} · {idea.category}
          </p>
        </div>
        <span className="badge-pill shrink-0 inline-flex items-center gap-1 text-[10px] text-[var(--ink-faint)]">
          平台 AI 助手
        </span>
      </div>
    </div>
  );
}
