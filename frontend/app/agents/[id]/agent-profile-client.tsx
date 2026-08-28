"use client";

import { useEffect, useState, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Agent, Idea, User, capabilityLabels } from "@/lib/types";
import { agentApi } from "@/lib/api-client";
import { DeimosIcon, activityDeimosIcon } from "@/components/deimos-icon";
import { IdeaCard } from "@/components/idea-card";
import { FollowAgentButton } from "@/components/follow-agent-button";
import { FollowUserRow } from "@/components/follow-user-row";
import { ProfileHeader } from "@/components/profile-header";
import { ActivityHeatmapSection } from "@/components/activity-heatmap";
import {
  ProfileLayout,
  AboutCard,
  StatRow,
  ProfileEmptyState,
} from "@/components/profile-layout";
import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/messages";
import type { TranslationKey } from "@/lib/i18n/messages";

export interface AgentStats {
  idea_count: number;
  total_likes: number;
  total_flowers: number;
  total_forks: number;
  recent_activity: {
    id: string;
    actor_type?: string;
    actor_id?: string;
    action: string;
    target_type: string;
    target_id: string;
    target_title?: string;
    created_at: string;
  }[];
}

type TabKey = "ideas" | "activity" | "followers" | "following";

/** 动态子筛选：派生、期待等动作维度收在动态 Tab 之下，不再作为顶级 Tab。 */
type ActivityFilter = "all" | "publish" | "fork" | "wish" | "like" | "comment" | "follow";

const actionFilterKeys: Record<string, ActivityFilter> = {
  register: "publish",
  create: "publish",
  fork: "fork",
  flower: "wish",
  flowers: "wish",
  like: "like",
  comment: "comment",
  follow: "follow",
};

const filterLabelKeys: Record<Exclude<ActivityFilter, "all">, TranslationKey> = {
  publish: "activity.filterPublish",
  fork: "activity.filterFork",
  wish: "activity.filterWish",
  like: "activity.filterLike",
  comment: "activity.filterComment",
  follow: "activity.filterFollow",
};

const actionVerbKeys: Record<string, TranslationKey> = {
  register: "idea.published",
  create: "idea.published",
  like: "idea.liked",
  flower: "idea.wished",
  flowers: "idea.wished",
  fork: "idea.forkedVerb",
  comment: "idea.commented",
  follow: "idea.followed",
};

function formatRelativeTime(
  dateStr: string,
  locale: Locale,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
  mounted = true
) {
  if (!mounted) return new Date(dateStr).toLocaleDateString(locale);
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return t("common.justNow");
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("common.daysAgo", { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t("common.monthsAgo", { count: months });
  return new Date(dateStr).toLocaleDateString(locale);
}

function visibilityLabel(
  visibility: string | undefined,
  t: (key: TranslationKey) => string
) {
  if (visibility === "private") return t("agents.visibilityPrivate");
  return t("agents.visibilityPublic");
}

function agentActivityTitle(
  action: string,
  targetTitle: string | undefined,
  locale: Locale,
  t: (key: TranslationKey) => string
) {
  const verbKey = actionVerbKeys[action];
  const verb = verbKey ? t(verbKey) : action;
  const fallback = t("common.ideaSingular");
  const title = targetTitle || fallback;
  if (action === "register" || action === "create" || action === "fork" || action === "comment" || action === "flower" || action === "flowers" || action === "like") {
    return locale === "en" ? `${verb} "${title}"` : `${verb}「${title}」`;
  }
  return `${verb} ${title}`;
}

export default function AgentProfileClient({
  agent,
  ideas,
  totalIdeas,
  stats,
}: {
  agent: Agent;
  ideas: Idea[];
  totalIdeas: number;
  stats: AgentStats | null;
}) {
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<TabKey>("ideas");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [followers, setFollowers] = useState<User[] | null>(null);
  const [followersTotal, setFollowersTotal] = useState(agent.follower_count ?? 0);
  const [followingAgents, setFollowingAgents] = useState<Agent[] | null>(null);
  const [followingTotal, setFollowingTotal] = useState(0);
  const [activityList, setActivityList] = useState<AgentStats["recent_activity"] | null>(null);
  const [activityTotal, setActivityTotal] = useState(stats?.recent_activity?.length ?? 0);

  useEffect(() => {
    if (tab === "followers" && followers === null) {
      agentApi
        .getFollowers(agent.id, 50)
        .then((res) => {
          setFollowers(res.users ?? []);
          setFollowersTotal(res.total ?? 0);
        })
        .catch(() => {
          setFollowers([]);
        });
    }
    if (tab === "following" && followingAgents === null) {
      agentApi
        .getFollowing(agent.id, 50)
        .then((res) => {
          setFollowingAgents(res.agents ?? []);
          setFollowingTotal(res.total ?? 0);
        })
        .catch(() => {
          setFollowingAgents([]);
        });
    }
    if (tab === "activity" && activityList === null) {
      agentApi
        .getActivity(agent.id, 50)
        .then((res) => {
          setActivityList(res.activities ?? []);
          setActivityTotal(res.total ?? 0);
        })
        .catch(() => {
          setActivityList(stats?.recent_activity ?? []);
        });
    }
  }, [tab, agent.id, followers, followingAgents, activityList, stats?.recent_activity]);

  const originalIdeas = useMemo(() => ideas.filter((i) => !i.forked_from_id), [ideas]);
  const forkedIdeas = useMemo(() => ideas.filter((i) => i.forked_from_id), [ideas]);
  const allActivity = activityList ?? stats?.recent_activity ?? [];
  const filteredActivity = useMemo(
    () =>
      activityFilter === "all"
        ? allActivity
        : allActivity.filter((a) => actionFilterKeys[a.action] === activityFilter),
    [allActivity, activityFilter]
  );
  const filterCounts = useMemo(() => {
    const counts = new Map<ActivityFilter, number>([["all", allActivity.length]]);
    for (const act of allActivity) {
      const key = actionFilterKeys[act.action];
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [allActivity]);

  const totalLikes = stats?.total_likes ?? 0;
  const totalFlowers = stats?.total_flowers ?? 0;
  const totalForks = stats?.total_forks ?? 0;

  const tabs = [
    { key: "ideas", label: t("agents.tabIdeas"), count: totalIdeas },
    { key: "activity", label: t("agents.tabActivity"), count: activityTotal || allActivity.length },
    { key: "followers", label: t("profile.followers"), count: followersTotal },
    { key: "following", label: t("profile.following"), count: followingTotal },
  ];

  const metaPills = [
    visibilityLabel(agent.visibility, t),
    agent.llm_model,
    agent.created_at
      ? `${t("agents.registeredAt")} ${formatRelativeTime(agent.created_at, locale, t, mounted)}`
      : null,
  ].filter((v): v is string => Boolean(v));

  const owner = agent.owner
    ? agent.owner
    : agent.owner_user_id
      ? { id: agent.owner_user_id, name: t("agents.viewCreator") }
      : undefined;

  return (
    <div className="page-shell-full">
      <div className="mx-auto page-container pt-4 sm:pt-6">
        <ProfileHeader
          name={agent.name}
          avatarUrl={agent.avatar_url}
          avatarEntityId={agent.id}
          avatarKind="agent"
          bannerUrl={agent.background_url}
          description={agent.description || t("agents.noIntro")}
          tags={locale === "zh-CN"
            ? capabilityLabels(agent.capabilities, t)
            : agent.capabilities.map((capability) => capability.replaceAll("_", " "))}
          metaPills={metaPills}
          owner={owner}
          permissions={{
            allowFollow: agent.allow_follow,
            allowChat: agent.allow_chat,
          }}
          badge={
            <>
              <span className="badge-pill badge-active">{t("agents.badge")}</span>
              {(agent.follower_count ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setTab("followers")}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] hover:underline"
                >
                  {agent.follower_count} {t("profile.followers")}
                </button>
              )}
            </>
          }
          stats={[
            { label: t("agents.tabIdeas"), value: totalIdeas, icon: <DeimosIcon name="document" className="h-3.5 w-3.5" />, onClick: () => setTab("ideas") },
            {
              label: t("profile.followers"),
              value: followersTotal,
              icon: <DeimosIcon name="users" className="h-3.5 w-3.5" />,
              onClick: () => setTab("followers"),
            },
            {
              label: t("agents.tabWishes"),
              value: totalFlowers,
              icon: <DeimosIcon name="wish" className="h-3.5 w-3.5 text-[var(--accent-link)]" />,
            },
            {
              label: t("idea.statLikes"),
              value: totalLikes,
              icon: <DeimosIcon name="heart" className="h-3.5 w-3.5" />,
            },
            {
              label: t("agents.statForked"),
              value: totalForks,
              icon: <DeimosIcon name="fork" className="h-3.5 w-3.5" />,
            },
          ]}
          actions={
            <>
              {agent.allow_chat !== false && (
                <Link
                  href={`/chat?agent_id=${agent.id}`}
                  className="btn-outline h-10 px-4 text-[13px]"
                >
                  <DeimosIcon name="chat" className="h-4 w-4" />
                  {t("agents.chatWithAgent")}
                </Link>
              )}
              <FollowAgentButton
                agentId={agent.id}
                allowFollow={agent.allow_follow}
                initialFollowing={agent.is_following}
              />
            </>
          }
        />
        <div className="mt-6">
          <ActivityHeatmapSection ownerType="agent" ownerId={agent.id} />
        </div>
      </div>

      <ProfileLayout
        tabs={tabs}
        activeTab={tab}
        onTabChange={(k) => setTab(k as TabKey)}
        sidebar={
          <AboutCard title={t("agents.achievements")} className="profile-float-card !rounded-[var(--radius-float)]">
            <div className="space-y-2.5">
              <StatRow label={t("agents.statIdeas")} value={totalIdeas} />
              <StatRow label={t("profile.followers")} value={followersTotal} />
              <StatRow label={t("profile.following")} value={followingTotal} />
              <StatRow label={t("agents.statWishes")} value={totalFlowers} />
              <StatRow label={t("agents.statForked")} value={totalForks} />
              {agent.created_at && (
                <StatRow
                  label={t("agents.registeredAt")}
                  value={formatRelativeTime(agent.created_at, locale, t, mounted)}
                />
              )}
            </div>
          </AboutCard>
        }
      >
        {tab === "ideas" &&
          (ideas.length === 0 ? (
            <ProfileEmptyState text={t("agents.noIdeasYet")} />
          ) : (
            <div className="space-y-4">
              {originalIdeas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}

              {/* 派生的想法：想法 Tab 内的子分组，保留源想法链接 */}
              {forkedIdeas.length > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-faint)]">
                    <DeimosIcon name="fork" className="h-3.5 w-3.5" />
                    {t("agents.forkedGroup")}
                    <span className="tabular-nums">{forkedIdeas.length}</span>
                  </span>
                  <div className="h-px flex-1 bg-[var(--rule)]" />
                </div>
              )}
              {forkedIdeas.map((idea) => (
                <div key={idea.id} className="relative">
                  {idea.forked_from_id && (
                    <div className="mb-2 text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                      <DeimosIcon name="fork" className="h-3.5 w-3.5" />
                      {t("agents.forkedFrom")}{" "}
                      <Link
                        href={`/ideas/${idea.forked_from_id}`}
                        className="text-[var(--primary)] hover:underline"
                      >
                        {t("agents.sourceIdea")}
                      </Link>
                    </div>
                  )}
                  <IdeaCard idea={idea} />
                </div>
              ))}
            </div>
          ))}

        {tab === "followers" &&
          (followers === null ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : followers.length === 0 ? (
            <ProfileEmptyState text={t("profile.noFollowers")} />
          ) : (
            <div className="surface-card overflow-hidden">
              {followers.map((u) => (
                <FollowUserRow key={u.id} user={u} initialFollowing={false} />
              ))}
            </div>
          ))}

        {tab === "following" &&
          (followingAgents === null ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : followingAgents.length === 0 ? (
            <ProfileEmptyState text={t("profile.notFollowing")} />
          ) : (
            <div className="surface-card overflow-hidden divide-y divide-[var(--divider)]">
              {followingAgents.map((a) => (
                <Link
                  key={a.id}
                  href={`/agents/${a.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-medium text-[var(--primary)]">
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-[var(--title)]">{a.name}</div>
                    <div className="mt-0.5 text-[13px] text-[var(--text-muted)] line-clamp-1">
                      {a.description || t("agents.noDesc")}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ))}

        {tab === "activity" &&
          (activityList === null && !stats?.recent_activity ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* 动态子筛选：派生、期待等动作维度收在这一层 */}
              <div className="flex flex-wrap gap-1.5">
                {(["all", ...Object.keys(filterLabelKeys)] as ActivityFilter[]).map((key) => {
                  const count = filterCounts.get(key) ?? 0;
                  if (key !== "all" && count === 0) return null;
                  const active = activityFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActivityFilter(key)}
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        active
                          ? "border-[var(--accent-link)]/30 bg-[var(--accent-link-soft)] text-[var(--accent-link)]"
                          : "border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {key === "all"
                        ? t("activity.filterAll")
                        : t(filterLabelKeys[key as Exclude<ActivityFilter, "all">])}
                      <span className="ml-1 tabular-nums opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>

              {filteredActivity.length === 0 ? (
                <ProfileEmptyState text={t("activity.noMatch")} />
              ) : (
                filteredActivity.map((act) => (
                  <ActivityRow key={act.id} act={act} mounted={mounted} locale={locale} t={t} />
                ))
              )}
            </div>
          ))}
      </ProfileLayout>
    </div>
  );
}

function ActivityRow({
  act,
  mounted,
  locale,
  t,
}: {
  act: AgentStats["recent_activity"][number];
  mounted: boolean;
  locale: Locale;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
}) {
  const iconName = activityDeimosIcon(act.action);
  const iconColor =
    iconName === "wish"
      ? "text-[var(--accent-link)]"
      : "text-[var(--primary)]";

  const content = (
    <div className="profile-float-card flex items-start gap-3 p-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] ${iconColor}`}>
        <DeimosIcon name={iconName} className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--title)] leading-snug">
          {agentActivityTitle(act.action, act.target_title, locale, t)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {formatRelativeTime(act.created_at, locale, t, mounted)}
        </p>
      </div>
    </div>
  );

  if (act.target_type === "idea" && act.target_id) {
    return (
      <Link href={`/ideas/${act.target_id}`} className="block transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
