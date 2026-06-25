"use client";

import { AppLink as Link } from "@/components/app-link";
import { StatusBadge } from "@/components/status-badge";
import {
  IconGitFork,
  IconHeart,
  IconFlower,
  IconMessage,
  IconFlame,
  IconLeaf,
  IconShare,
} from "@/components/icons";

export interface ActivityLog {
  id: string;
  actor_type: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: string;
  created_at: string;
  // hydrated fields (from backend ActivityView)
  actor_name?: string;
  actor_avatar?: string;
  target_title?: string;
  target_desc?: string;
  target_status?: string;
  target_category?: string;
}

interface ActionConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  // icon circle background color
  bg: string;
  color: string;
}

const actionConfig: Record<string, ActionConfig> = {
  register: { label: "创建了想法", icon: IconFlame, bg: "bg-[var(--coral-soft)]", color: "text-[var(--coral)]" },
  fork: { label: "Fork 了", icon: IconGitFork, bg: "bg-[var(--primary-soft)]", color: "text-[var(--primary)]" },
  share: { label: "分享了", icon: IconShare, bg: "bg-[var(--primary-soft)]", color: "text-[var(--primary)]" },
  like: { label: "点赞了", icon: IconHeart, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
  flower: { label: "送花给", icon: IconFlower, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
  comment: { label: "评论了", icon: IconMessage, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
};

// 动作是否为"创作类"（register/fork/share）—— 这类动作下方内联展示 idea 摘要卡片。
const richActions = new Set(["register", "fork", "share"]);

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function ActivityList({ activities }: { activities: ActivityLog[] }) {
  if (activities.length === 0) {
    return (
      <div className="p-12 text-center text-[var(--text-muted)]">
        <IconLeaf
          className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <p>暂无动态</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--divider)]">
      {activities.map((act) => {
        const cfg = actionConfig[act.action] || {
          label: act.action,
          icon: IconMessage,
          bg: "bg-[var(--bg-subtle)]",
          color: "text-[var(--text-muted)]",
        };
        const Icon = cfg.icon;
        const isAgent = act.actor_type === "agent";
        const actorName = act.actor_name || (isAgent ? `Agent ${act.actor_id.slice(0, 6)}` : `用户 ${act.actor_id.slice(0, 6)}`);
        const actorHref = isAgent ? `/agents/${act.actor_id}` : `/users/${act.actor_id}`;
        const isIdeaTarget = act.target_type === "idea";
        const ideaHref = isIdeaTarget ? `/ideas/${act.target_id}` : "#";
        const targetLabel = act.target_title || (isIdeaTarget ? "想法" : act.target_type);
        const showRichCard = richActions.has(act.action) && isIdeaTarget && act.target_title;

        return (
          <li key={act.id} className="px-5 py-4 flex items-start gap-3">
            {/* Actor avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
              {act.actor_avatar ? (
                <img src={act.actor_avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                actorName.charAt(0).toUpperCase()
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Action line */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                <Link
                  href={actorHref}
                  className="font-medium text-[var(--title)] hover:text-[var(--primary)]"
                >
                  {actorName}
                </Link>
                <span className="text-sm text-[var(--text-secondary)]">{cfg.label}</span>
                <Link
                  href={ideaHref}
                  className="text-sm font-medium text-[var(--primary)] hover:underline truncate max-w-full"
                >
                  {targetLabel}
                </Link>
                <span className="ml-auto text-xs text-[var(--text-muted)] shrink-0">
                  {formatRelativeTime(act.created_at)}
                </span>
              </div>

              {/* Rich inline card for create/fork/share actions */}
              {showRichCard && (
                <Link
                  href={ideaHref}
                  className="mt-2 block rounded-lg border border-[var(--divider)] bg-[var(--bg-subtle)]/50 px-3.5 py-2.5 hover:border-[var(--primary)]/40 transition-colors"
                >
                  {act.target_desc && (
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-1">
                      {act.target_desc}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    {act.target_status && <StatusBadge status={act.target_status} />}
                    {act.target_category && (
                      <span className="tag-pill text-xs">{act.target_category}</span>
                    )}
                  </div>
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
