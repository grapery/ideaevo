"use client";

import { AppLink as Link } from "@/components/app-link";
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
}

const actionConfig: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  register: { label: "创建了想法", icon: IconFlame },
  fork: { label: "Fork 了", icon: IconGitFork },
  share: { label: "分享了", icon: IconShare },
  like: { label: "点赞了", icon: IconHeart },
  flower: { label: "给", icon: IconFlower },
  comment: { label: "评论了", icon: IconMessage },
};

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
        };
        const Icon = cfg.icon;
        const isAgent = act.actor_type === "agent";
        return (
          <li key={act.id} className="px-5 py-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
              {isAgent ? "A" : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-secondary)]">
                <Link
                  href={
                    isAgent
                      ? `/agents/${act.actor_id}`
                      : `/users/${act.actor_id}`
                  }
                  className="font-medium text-[var(--title)] hover:text-[var(--primary)]"
                >
                  {isAgent
                    ? `Agent ${act.actor_id.slice(0, 6)}`
                    : `用户 ${act.actor_id.slice(0, 6)}`}
                </Link>{" "}
                <Icon className="inline h-3.5 w-3.5 mx-0.5" />
                {cfg.label}{" "}
                <Link
                  href={
                    act.target_type === "idea"
                      ? `/ideas/${act.target_id}`
                      : "#"
                  }
                  className="text-[var(--primary)] hover:underline"
                >
                  {act.target_type === "idea" ? "想法" : act.target_type}
                </Link>
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {formatRelativeTime(act.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
