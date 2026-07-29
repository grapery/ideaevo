"use client";

import { AppLink as Link } from "@/components/app-link";
import { StatusBadge } from "@/components/status-badge";
import { ReactionBar } from "@/components/reaction-bar";
import {
  IconGitFork,
  IconHeart,
  IconWish,
  IconMessage,
  IconFlame,
  IconLeaf,
  IconShare,
  IconUser,
} from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

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
  reactions?: Record<string, number>;
}

interface ActionConfig {
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  // icon circle background color
  bg: string;
  color: string;
}

const actionConfig: Record<string, ActionConfig> = {
  register: { labelKey: "idea.published", icon: IconFlame, bg: "bg-[var(--coral-soft)]", color: "text-[var(--coral)]" },
  fork: { labelKey: "idea.forkedVerb", icon: IconGitFork, bg: "bg-[var(--primary-soft)]", color: "text-[var(--primary)]" },
  share: { labelKey: "idea.shared", icon: IconShare, bg: "bg-[var(--primary-soft)]", color: "text-[var(--primary)]" },
  like: { labelKey: "idea.liked", icon: IconHeart, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
  flower: { labelKey: "idea.wished", icon: IconWish, bg: "bg-[var(--accent-link-soft)]", color: "text-[var(--accent-link)]" },
  flowers: { labelKey: "idea.wished", icon: IconWish, bg: "bg-[var(--accent-link-soft)]", color: "text-[var(--accent-link)]" },
  comment: { labelKey: "idea.commented", icon: IconMessage, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
  follow: { labelKey: "idea.followed", icon: IconUser, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
  unfollow: { labelKey: "idea.unfollowed", icon: IconUser, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
  create_session: { labelKey: "idea.startedChat", icon: IconMessage, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
  send_message: { labelKey: "idea.sentMessage", icon: IconMessage, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
  fork_session: { labelKey: "idea.forkedChat", icon: IconGitFork, bg: "bg-[var(--primary-soft)]", color: "text-[var(--primary)]" },
  bury: { labelKey: "idea.buried", icon: IconLeaf, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
};

/** Resolve the action config, handling the `tool:*` prefix and unknown actions gracefully. */
function resolveActionConfig(
  action: string,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
): { icon: React.ComponentType<{ className?: string }>; bg: string; color: string; label: string } {
  const base = actionConfig[action];
  if (base) {
    return { icon: base.icon, bg: base.bg, color: base.color, label: t(base.labelKey) };
  }
  if (action.startsWith("tool:")) {
    const toolName = action.slice(5);
    return {
      label: t("idea.calledTool", { name: toolName }),
      icon: IconShare,
      bg: "bg-[var(--bg-subtle)]",
      color: "text-[var(--text-muted)]",
    };
  }
  // Fallback: never leak the raw key, show a neutral label.
  return {
    label: t("idea.didAction"),
    icon: IconMessage,
    bg: "bg-[var(--bg-subtle)]",
    color: "text-[var(--text-muted)]",
  };
}

// 动作是否为"创作类"（register/fork/share）—— 这类动作下方内联展示 idea 摘要卡片。
const richActions = new Set(["register", "fork", "share"]);

/**
 * Session 类动作黑名单 —— 对话/消息属于私密交互，不在动态流（用户主页、
 * 全站动态）中公开展示。在 ActivityList 渲染前统一过滤掉。
 */
const hiddenActions = new Set(["create_session", "send_message", "fork_session"]);

function formatRelativeTime(
  dateStr: string,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return t("common.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("common.daysAgo", { count: days });
}

export function ActivityList({ activities }: { activities: ActivityLog[] }) {
  const { t } = useI18n();
  // 过滤掉 session 类动作（对话/消息），不在动态流公开展示
  const visible = activities.filter((a) => !hiddenActions.has(a.action));
  if (visible.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--text-muted)]">
        <IconLeaf
          className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <p>{t("activity.noActivity")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--divider)]">
      {visible.map((act) => {
        const cfg = resolveActionConfig(act.action, t);
        const Icon = cfg.icon;
        const isAgent = act.actor_type === "agent";
        const actorName = act.actor_name || (isAgent ? `${t("activity.agent")} ${act.actor_id.slice(0, 6)}` : `${t("activity.user")} ${act.actor_id.slice(0, 6)}`);
        const actorHref = isAgent ? `/agents/${act.actor_id}` : `/users/${act.actor_id}`;
        const isIdeaTarget = act.target_type === "idea";
        const ideaHref = isIdeaTarget ? `/ideas/${act.target_id}` : "#";
        const targetLabel = act.target_title || (isIdeaTarget ? t("idea.ideas") : act.target_type);
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
                  {formatRelativeTime(act.created_at, t)}
                </span>
              </div>

              {/* Rich inline card for create/fork/share actions */}
              {showRichCard && (
                <>
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
                  <ReactionBar
                    ideaId={act.target_id}
                    initialCounts={act.reactions}
                    compact
                  />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
