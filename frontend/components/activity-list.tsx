"use client";

import { AppLink as Link } from "@/components/app-link";
import { StatusBadge } from "@/components/status-badge";
import { ImplStatusBadge } from "@/components/impl-status-badge";
import { ReactionBar } from "@/components/reaction-bar";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { DeimosIcon } from "@/components/deimos-icon";
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
import { normalizeTags, type IdeaImplStatus } from "@/lib/types";

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
  bury: { labelKey: "idea.buriedVerb", icon: IconLeaf, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
  archive: { labelKey: "idea.archivedVerb", icon: IconLeaf, bg: "bg-[var(--bg-subtle)]", color: "text-[var(--text-muted)]" },
  implement: { labelKey: "idea.implementedVerb", icon: IconFlame, bg: "bg-[var(--accent-success-soft,#e8f9ed)]", color: "text-[var(--accent-success)]" },
  reactivate: { labelKey: "idea.reactivatedVerb", icon: IconFlame, bg: "bg-[var(--primary-soft)]", color: "text-[var(--primary)]" },
  update_impl: { labelKey: "idea.updatedImplVerb", icon: IconFlame, bg: "bg-[var(--accent-link-soft)]", color: "text-[var(--accent-link)]" },
};

function resolveActionConfig(
  action: string,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
): { icon: React.ComponentType<{ className?: string }>; bg: string; color: string; label: string } {
  const base = actionConfig[action];
  if (base) {
    return { icon: base.icon, bg: base.bg, color: base.color, label: t(base.labelKey) };
  }
  if (action.startsWith("tool:")) {
    return {
      label: t("idea.calledTool", { name: action.slice(5) }),
      icon: IconShare,
      bg: "bg-[var(--bg-subtle)]",
      color: "text-[var(--text-muted)]",
    };
  }
  return {
    label: t("idea.didAction"),
    icon: IconMessage,
    bg: "bg-[var(--bg-subtle)]",
    color: "text-[var(--text-muted)]",
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

function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--ink-faint)]" title={label}>
      {icon}
      <span className="font-medium tabular-nums text-[var(--ink-soft)]">{value}</span>
    </span>
  );
}

function IdeaPreviewCard({ act }: { act: ActivityLog }) {
  const { t, locale } = useI18n();
  const href = `/ideas/${act.target_id}`;
  const tags = normalizeTags(act.target_tags).slice(0, 4);
  const cover = act.target_cover_url;

  return (
    <Link
      href={href}
      className="group mt-3 block overflow-hidden rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--primary)]"
    >
      {cover && (
        <div className="h-28 w-full overflow-hidden border-b border-[var(--rule-light)] bg-[var(--bg-subtle)] sm:h-32">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      )}

      <div className="flex gap-3 p-3.5 sm:p-4">
        <WireframeAvatar
          name={act.target_title || t("idea.ideas")}
          avatarUrl={act.target_icon_url}
          entityId={act.target_id}
          kind="idea"
          size={44}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-[15px] font-semibold leading-snug text-[var(--ink)] group-hover:text-[var(--primary)]">
              {act.target_title}
            </h3>
            <span className="shrink-0 text-[12px] font-medium text-[var(--primary)] opacity-0 transition-opacity group-hover:opacity-100">
              {t("activity.viewIdea")} →
            </span>
          </div>

          {act.target_desc && (
            <p className="mt-1.5 text-[13px] leading-6 text-[var(--ink-soft)] line-clamp-2">
              {act.target_desc}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {act.target_status && <StatusBadge status={act.target_status} />}
            {act.target_impl_status && (
              <ImplStatusBadge status={act.target_impl_status as IdeaImplStatus} />
            )}
            {act.target_category && (
              <span className="rounded-full border border-[var(--rule)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
                {act.target_category}
              </span>
            )}
            {tags.map((tag) => (
              <span key={tag} className="tag-pill text-[11px]">
                #{tag}
              </span>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t border-[var(--rule-light)] pt-2.5">
            <Metric
              icon={<DeimosIcon name="heart" className="h-3.5 w-3.5" />}
              value={act.target_like_count ?? 0}
              label={t("idea.statLikes")}
            />
            <Metric
              icon={<DeimosIcon name="wish" className="h-3.5 w-3.5" />}
              value={act.target_wish_count ?? act.target_flower_count ?? 0}
              label={t("idea.statWishes")}
            />
            <Metric
              icon={<DeimosIcon name="fork" className="h-3.5 w-3.5" />}
              value={act.target_fork_count ?? 0}
              label={t("agents.tabForks")}
            />
            <Metric
              icon={<DeimosIcon name="comment" className="h-3.5 w-3.5" />}
              value={act.target_comment_count ?? 0}
              label={t("idea.statComments")}
            />
            <time
              dateTime={act.created_at}
              className="ml-auto text-[11px] text-[var(--ink-faint)]"
              title={new Date(act.created_at).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}
            >
              {new Date(act.created_at).toLocaleDateString(
                locale === "en" ? "en-US" : "zh-CN",
                { month: "short", day: "numeric" },
              )}
            </time>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ActivityList({ activities }: { activities: ActivityLog[] }) {
  const { t, locale } = useI18n();
  const visible = activities.filter((a) => !hiddenActions.has(a.action));

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
      {visible.map((act) => {
        const cfg = resolveActionConfig(act.action, t);
        const Icon = cfg.icon;
        const isAgent = act.actor_type === "agent";
        const actorName =
          act.actor_name ||
          (isAgent
            ? `${t("activity.agent")} ${act.actor_id.slice(0, 6)}`
            : `${t("activity.user")} ${act.actor_id.slice(0, 6)}`);
        const actorHref = isAgent ? `/agents/${act.actor_id}` : `/users/${act.actor_id}`;
        const isIdeaTarget = act.target_type === "idea";
        const showIdeaCard = isIdeaTarget && !!act.target_title;
        let reasonNote = "";
        if (act.metadata) {
          try {
            const meta = JSON.parse(act.metadata) as {
              reason?: string;
              from?: string;
              to?: string;
            };
            if (meta.reason?.trim()) {
              reasonNote = meta.reason.trim();
            } else if (act.action === "update_impl" && (meta.from || meta.to)) {
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
          <li key={act.id} className="px-4 py-5 sm:px-5">
            <div className="flex items-start gap-3">
              <WireframeAvatar
                name={actorName}
                avatarUrl={act.actor_avatar}
                entityId={act.actor_id}
                kind={isAgent ? "agent" : "user"}
                size={40}
                href={actorHref}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${cfg.bg}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                  </span>
                  <Link
                    href={actorHref}
                    className="text-[14px] font-semibold text-[var(--ink)] hover:text-[var(--primary)]"
                  >
                    {actorName}
                  </Link>
                  {isAgent && (
                    <span className="rounded-full bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-faint)]">
                      Agent
                    </span>
                  )}
                  <span className="text-[13px] text-[var(--ink-soft)]">{cfg.label}</span>
                  {!showIdeaCard && act.target_title && (
                    isIdeaTarget ? (
                      <Link
                        href={`/ideas/${act.target_id}`}
                        className="max-w-full truncate text-[13px] font-medium text-[var(--primary)] hover:underline"
                      >
                        {act.target_title}
                      </Link>
                    ) : (
                      <span className="max-w-full truncate text-[13px] font-medium text-[var(--ink-soft)]">
                        {act.target_title}
                      </span>
                    )
                  )}
                  <time
                    dateTime={act.created_at}
                    className="ml-auto inline-flex items-center rounded-full border border-[var(--rule)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-faint)]"
                    title={new Date(act.created_at).toLocaleString(
                      locale === "en" ? "en-US" : "zh-CN",
                    )}
                  >
                    {formatRelativeTime(act.created_at, t)}
                  </time>
                </div>

                {reasonNote && (
                  <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--ink-soft)]">
                    {t("idea.conclusionReason")}: {reasonNote}
                  </p>
                )}

                {showIdeaCard && <IdeaPreviewCard act={act} />}

                {showIdeaCard && (
                  <div className="mt-2">
                    <ReactionBar
                      ideaId={act.target_id}
                      initialCounts={act.reactions}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
