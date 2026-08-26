"use client";

import { AppLink as Link } from "@/components/app-link";
import { WireframeAvatar } from "@/components/wireframe-avatar";
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
  actor_name?: string;
  actor_avatar?: string;
  target_title?: string;
  target_desc?: string;
  target_status?: string;
  target_category?: string;
  target_impl_status?: string;
  target_tags?: string[] | string;
  target_icon_url?: string;
  target_cover_url?: string;
  target_like_count?: number;
  target_flower_count?: number;
  target_wish_count?: number;
  target_fork_count?: number;
  target_comment_count?: number;
  reactions?: Record<string, number>;
}

interface ActionConfig {
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

// 动作词与后端 FeedActions 白名单对齐(internal/service/activity.go);
// 未知 action 一律回退为通用动词, 绝不向用户展示原始键名。
const actionConfig: Record<string, ActionConfig> = {
  register: { labelKey: "idea.published", icon: IconFlame, color: "text-[var(--accent-warning)]" },
  fork: { labelKey: "idea.forkedVerb", icon: IconGitFork, color: "text-[var(--primary)]" },
  share: { labelKey: "idea.shared", icon: IconShare, color: "text-[var(--primary)]" },
  like: { labelKey: "idea.liked", icon: IconHeart, color: "text-[var(--coral)]" },
  flower: { labelKey: "idea.wished", icon: IconWish, color: "text-[var(--accent-link)]" },
  flowers: { labelKey: "idea.wished", icon: IconWish, color: "text-[var(--accent-link)]" },
  comment: { labelKey: "idea.commented", icon: IconMessage, color: "text-[var(--ink-soft)]" },
  follow: { labelKey: "idea.followed", icon: IconUser, color: "text-[var(--ink-soft)]" },
  unfollow: { labelKey: "idea.unfollowed", icon: IconUser, color: "text-[var(--ink-soft)]" },
  bury: { labelKey: "idea.buriedVerb", icon: IconLeaf, color: "text-[var(--ink-soft)]" },
  archive: { labelKey: "idea.archivedVerb", icon: IconLeaf, color: "text-[var(--ink-soft)]" },
  implement: { labelKey: "idea.implementedVerb", icon: IconFlame, color: "text-[var(--accent-success)]" },
  reactivate: { labelKey: "idea.reactivatedVerb", icon: IconFlame, color: "text-[var(--primary)]" },
  update_impl: { labelKey: "idea.updatedImplVerb", icon: IconFlame, color: "text-[var(--accent-link)]" },
  suggest: { labelKey: "activity.actionSuggest", icon: IconMessage, color: "text-[var(--accent-link)]" },
  suggestion_selected: { labelKey: "activity.actionSuggestionSelected", icon: IconMessage, color: "text-[var(--accent-link)]" },
  suggestion_implemented: { labelKey: "activity.actionSuggestionImplemented", icon: IconFlame, color: "text-[var(--accent-success)]" },
};

function resolveActionConfig(
  action: string,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
): { icon: React.ComponentType<{ className?: string }>; color: string; label: string } {
  const base = actionConfig[action];
  if (base) {
    return { icon: base.icon, color: base.color, label: t(base.labelKey) };
  }
  if (action.startsWith("tool:")) {
    return {
      label: t("idea.calledTool", { name: action.slice(5) }),
      icon: IconShare,
      color: "text-[var(--ink-faint)]",
    };
  }
  return {
    label: t("idea.didAction"),
    icon: IconMessage,
    color: "text-[var(--ink-faint)]",
  };
}

const hiddenActions = new Set(["create_session", "send_message", "fork_session"]);

function formatRelativeTime(
  dateStr: string,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff) || diff < 0) return t("common.justNow");
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return t("common.justNow");
  if (minutes < 60) return t("common.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("common.daysAgo", { count: days });
  return t("common.monthsAgo", { count: Math.floor(days / 30) });
}

interface ActivityGroup {
  key: string;
  /** 组内按时间倒序: acts[0] 为最新 */
  acts: ActivityLog[];
}

/** 连续的同 actor + 同 target 动作合并为一行, 避免对同一个想法
 *  的连续操作(更新进度×3 之类)在 feed 里刷屏。 */
function groupActivities(activities: ActivityLog[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const act of activities) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.acts[0].actor_id === act.actor_id &&
      last.acts[0].target_type === act.target_type &&
      last.acts[0].target_id === act.target_id
    ) {
      last.acts.push(act);
    } else {
      groups.push({ key: act.id, acts: [act] });
    }
  }
  return groups;
}

/** 单行动态流(GitHub activity 式): 头像 + 谁 + 动作词 + 想法链接 + 时间。
 *  不再为每条动作挂完整想法预览卡 —— 预览卡体积远大于动作信号本身,
 *  且连续操作会重复挂载几乎相同的卡片, 把 feed 淹没。 */
export function ActivityList({ activities }: { activities: ActivityLog[] }) {
  const { t, locale } = useI18n();
  const visible = activities.filter((a) => !hiddenActions.has(a.action));
  const groups = groupActivities(visible);

  if (visible.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-[var(--ink-faint)]">
        <IconLeaf className="mx-auto mb-3 h-10 w-10" aria-hidden="true" />
        <p className="text-[14px]">{t("activity.noActivity")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--rule-light)]">
      {groups.map(({ key, acts }) => {
        const head = acts[0];
        const cfg = resolveActionConfig(head.action, t);
        const Icon = cfg.icon;
        const isAgent = head.actor_type === "agent";
        const actorName =
          head.actor_name ||
          (isAgent
            ? `${t("activity.agent")} ${head.actor_id.slice(0, 6)}`
            : `${t("activity.user")} ${head.actor_id.slice(0, 6)}`);
        const actorHref = isAgent ? `/agents/${head.actor_id}` : `/users/${head.actor_id}`;
        const isIdeaTarget = head.target_type === "idea";

        let reasonNote = "";
        if (head.metadata) {
          try {
            const meta = JSON.parse(head.metadata) as {
              reason?: string;
              from?: string;
              to?: string;
              progress?: string;
            };
            if (meta.reason?.trim()) {
              reasonNote = meta.reason.trim();
            } else if (meta.progress?.trim()) {
              reasonNote = meta.progress.trim();
            } else if (head.action === "update_impl" && (meta.from || meta.to)) {
              reasonNote = t("idea.implProgressNote", {
                from: meta.from || "—",
                to: meta.to || "—",
              });
            }
          } catch {
            // ignore
          }
        }

        return (
          <li key={key} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <WireframeAvatar
              name={actorName}
              avatarUrl={head.actor_avatar}
              entityId={head.actor_id}
              kind={isAgent ? "agent" : "user"}
              size={28}
              href={actorHref}
              className="shrink-0"
            />
            <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-[13px] leading-6 text-[var(--ink-soft)]">
              <Link
                href={actorHref}
                className="font-semibold text-[var(--ink)] hover:text-[var(--primary)]"
              >
                {actorName}
              </Link>
              {isAgent && (
                <span className="ml-1.5 rounded-full bg-[var(--bg-subtle)] px-1.5 py-0.5 align-[1px] text-[10px] font-medium text-[var(--ink-faint)]">
                  Agent
                </span>
              )}
              <span className="ml-1.5">{cfg.label}</span>
              {isIdeaTarget && head.target_title && (
                <Link
                  href={`/ideas/${head.target_id}`}
                  className="ml-1 font-medium text-[var(--ink)] hover:text-[var(--primary)] hover:underline"
                >
                  《{head.target_title}》
                </Link>
              )}
              {acts.length > 1 && (
                <span
                  className="ml-1.5 whitespace-nowrap rounded-full border border-[var(--rule)] bg-[var(--bg-subtle)] px-1.5 py-0.5 align-[1px] text-[11px] tabular-nums text-[var(--ink-faint)]"
                  title={acts
                    .map((a) => resolveActionConfig(a.action, t).label)
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .join(" · ")}
                >
                  {t("activity.andMoreActions", { count: acts.length - 1 })}
                </span>
              )}
              {reasonNote && (
                <span className="ml-1.5 text-[var(--ink-faint)]" title={reasonNote}>
                  — {reasonNote}
                </span>
              )}
            </p>
            <time
              dateTime={head.created_at}
              className="shrink-0 text-[11px] tabular-nums text-[var(--ink-faint)]"
              title={new Date(head.created_at).toLocaleString(
                locale === "en" ? "en-US" : "zh-CN",
              )}
            >
              {formatRelativeTime(head.created_at, t)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
