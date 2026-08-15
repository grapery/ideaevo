"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { userApi, billingApi } from "@/lib/api-client";
import { getApiBase } from "@/lib/api-base";
import { Idea, User, Agent, MembershipView } from "@/lib/types";
import { DeimosIcon } from "@/components/deimos-icon";
import { IdeaCard } from "@/components/idea-card";
import { AgentCard } from "@/components/agent-card";
import { ActivityList, ActivityLog } from "@/components/activity-list";
import { FollowUserRow } from "@/components/follow-user-row";
import {
  ProfileLayout,
  AboutCard,
  StatRow,
  ProfileEmptyState,
} from "@/components/profile-layout";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

type Tab = "overview" | "ideas" | "agents" | "activity" | "followers" | "following";

const VALID_TABS = new Set<Tab>([
  "overview",
  "ideas",
  "agents",
  "activity",
  "followers",
  "following",
]);

interface ProfileStats {
  idea_count?: number;
  agent_count?: number;
  follower_count?: number;
  following_count?: number;
  session_count?: number;
}

function formatJoinDate(
  dateStr: string,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
) {
  const d = new Date(dateStr);
  return t("profile.joinedDate", { year: d.getFullYear(), month: d.getMonth() + 1 });
}

// 格式化 token 数为简短形式：zh-CN 10000 -> "1万"，en 直接显示原始数字。
function formatTokensShort(n: number, locale: string, wanUnit: string): string {
  if (locale === "zh-CN" && n >= 10000) {
    return `${Math.floor(n / 10000)}${wanUnit}`;
  }
  return String(n);
}

/**
 * UserProfileBody —— GitHub 风格的用户主页主体（tab 导航 + 主列/侧栏）。
 * isOwn=true 时额外显示"对话"tab（自己的主页）。
 * 使用统一的 ProfileLayout 骨架。
 */
export function UserProfileBody({
  userId,
  user,
  isOwn,
  stats,
}: {
  userId: string;
  user: User;
  isOwn: boolean;
  stats: ProfileStats;
}) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");

  // 支持 ?tab=followers|following 深链（如从统计数字进入）。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("tab");
    if (raw && VALID_TABS.has(raw as Tab)) {
      setTab(raw as Tab);
    }
  }, []);

  // 各 tab 数据，按需懒加载。
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [activity, setActivity] = useState<ActivityLog[] | null>(null);
  const [followers, setFollowers] = useState<User[] | null>(null);
  const [following, setFollowing] = useState<User[] | null>(null);
  const [followerFollowingIds, setFollowerFollowingIds] = useState<Set<string>>(new Set());
  const [followingFollowingIds, setFollowingFollowingIds] = useState<Set<string>>(new Set());
  const [followersTotal, setFollowersTotal] = useState(stats.follower_count ?? 0);
  const [followingTotal, setFollowingTotal] = useState(stats.following_count ?? 0);
  // 会员状态（仅本人主页展示，按需懒加载）
  const [membership, setMembership] = useState<MembershipView | null>(null);

  const loadIdeas = useCallback(async () => {
    try {
      const res = await userApi.getUserIdeas(userId, 50);
      setIdeas(res.ideas ?? []);
    } catch {
      setIdeas([]);
    }
  }, [userId]);

  const loadAgents = useCallback(async () => {
    try {
      const res = await userApi.getUserAgents(userId, 50);
      setAgents(res.agents ?? []);
    } catch {
      setAgents([]);
    }
  }, [userId]);

  const loadActivity = useCallback(async () => {
    try {
      // 用 /users/:id/activity 聚合接口：包含用户本人 + 其拥有 Agent 的动态。
      // （activity 表 actor_id 存的是 agent_id，单按 user_id 查不到其 Agent 产生的动态）
      const res = await fetch(
        `${getApiBase()}/users/${userId}/activity?limit=50`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActivity(data.activities ?? []);
    } catch {
      setActivity([]);
    }
  }, [userId]);

  const loadFollowers = useCallback(async () => {
    try {
      const res = await userApi.getFollowers(userId, 50);
      setFollowers(res.users ?? []);
      setFollowersTotal(res.total ?? 0);
      setFollowerFollowingIds(new Set(res.following_ids ?? []));
    } catch {
      setFollowers([]);
      setFollowerFollowingIds(new Set());
    }
  }, [userId]);

  const loadFollowing = useCallback(async () => {
    try {
      const res = await userApi.getFollowing(userId, 50);
      setFollowing(res.users ?? []);
      setFollowingTotal(res.total ?? 0);
      setFollowingFollowingIds(new Set(res.following_ids ?? []));
    } catch {
      setFollowing([]);
      setFollowingFollowingIds(new Set());
    }
  }, [userId]);

  // overview 依赖 ideas + activity，进入时预载。
  useEffect(() => {
    if (ideas === null) loadIdeas();
    if (activity === null) loadActivity();
  }, [ideas, activity, loadIdeas, loadActivity]);

  // 本人主页：加载会员状态/额度用于侧栏展示。
  useEffect(() => {
    if (!isOwn || membership !== null) return;
    billingApi.membership().then(setMembership).catch(() => {});
  }, [isOwn, membership]);

  // tab 切换时按需加载。
  useEffect(() => {
    if (tab === "agents" && agents === null) loadAgents();
    if (tab === "followers" && followers === null) loadFollowers();
    if (tab === "following" && following === null) loadFollowing();
  }, [tab, agents, followers, following, loadAgents, loadFollowers, loadFollowing]);

  // 允许 header 统计点击通过自定义事件跳转 tab。
  useEffect(() => {
    function onTabChange(e: Event) {
      const key = (e as CustomEvent<string>).detail;
      if (key && VALID_TABS.has(key as Tab)) setTab(key as Tab);
    }
    window.addEventListener("profile-tab-change", onTabChange as EventListener);
    return () => window.removeEventListener("profile-tab-change", onTabChange as EventListener);
  }, []);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: t("profile.overview") },
    { key: "ideas", label: t("idea.ideas"), count: stats.idea_count ?? 0 },
    { key: "agents", label: t("header.agents"), count: stats.agent_count ?? 0 },
    { key: "activity", label: t("header.activity") },
    { key: "followers", label: t("profile.followers"), count: followersTotal },
    { key: "following", label: t("profile.following"), count: followingTotal },
  ];

  const ideaCount = stats.idea_count ?? 0;

  return (
    <ProfileLayout
      tabs={tabs}
      activeTab={tab}
      onTabChange={(k) => setTab(k as Tab)}
      sidebar={
        <>
          <AboutCard title={t("agents.aboutAgent")}>
            <div className="space-y-2.5 text-sm">
              {user.bio && (
                <p className="text-[var(--text-secondary)] leading-relaxed">{user.bio}</p>
              )}
              {isOwn && user.email && (
                <p className="text-[var(--text-muted)]">{user.email}</p>
              )}
              <p className="text-[var(--text-muted)]">{formatJoinDate(user.created_at, t)}</p>
              {isOwn && (
                <div className="flex flex-col items-start gap-2 pt-1">
                  <Link href="/user/agents" className="text-sm text-[var(--primary)] hover:underline">
                    {t("settings.myAgents")} →
                  </Link>
                  <Link href="/chat" className="text-sm text-[var(--primary)] hover:underline">
                    {t("profile.recentConversations")} →
                  </Link>
                  <Link href="/user/settings?section=apikey" className="text-sm text-[var(--primary)] hover:underline">
                    {t("settings.apiKeyTitle")} →
                  </Link>
                </div>
              )}
              {(user.role === "admin" || user.role === "moderator") && (
                <span className="badge-pill badge-active">{user.role === "admin" ? t("settings.roleAdmin") : t("settings.roleModerator")}</span>
              )}
            </div>
          </AboutCard>

          <AboutCard title={t("profile.statsOverview")}>
            <div className="space-y-2.5">
              <StatRow label={t("idea.ideas")} value={ideaCount} />
              <StatRow label={t("header.agents")} value={stats.agent_count ?? 0} />
              <StatRow label={t("profile.followers")} value={followersTotal} />
              <StatRow label={t("profile.following")} value={followingTotal} />
              {isOwn && <StatRow label={t("idea.chat")} value={stats.session_count ?? 0} />}
            </div>
          </AboutCard>

          {/* 会员状态（仅本人主页展示） */}
          {isOwn && membership && (
            <AboutCard title={t("billing.membershipQuota")}>
              <div className="space-y-2.5">
                <StatRow
                  label={t("profile.membershipTier")}
                  value={
                    membership.is_pro ? (
                      <span className="badge-pill badge-active">{t("billing.proBadge")}</span>
                    ) : (
                      <span className="badge-pill bg-[var(--bg-subtle)] text-[var(--ink-faint)]">{t("billing.freeUser")}</span>
                    )
                  }
                />
                <StatRow
                  label={t("billing.dailyQuota")}
                  value={
                    <span>
                      {formatTokensShort(membership.daily_quota.tokens_left, locale, t("common.wanUnit"))}
                      <span className="text-[var(--text-muted)] font-normal">
                        {" "}/ {formatTokensShort(membership.daily_quota.tokens_limit, locale, t("common.wanUnit"))}
                      </span>
                    </span>
                  }
                />
                <StatRow
                  label={t("billing.agentsCreated")}
                  value={
                    <span>
                      {membership.agent_count}
                      <span className="text-[var(--text-muted)] font-normal">
                        {" "}/ {membership.max_agents}
                      </span>
                    </span>
                  }
                />
                {!membership.is_pro && (
                  <Link
                    href="/billing"
                    className="block pt-2 text-sm text-[var(--primary)] hover:underline"
                  >
                    {t("billing.subscribeNow")} →
                  </Link>
                )}
              </div>
            </AboutCard>
          )}

          {ideas !== null && ideas.length > 0 && (
            <AboutCard title={t("profile.latestIdeas")}>
              <ul className="space-y-2">
                {ideas.slice(0, 5).map((idea) => (
                  <li key={idea.id}>
                    <Link
                      href={`/ideas/${idea.id}`}
                      className="block text-sm text-[var(--title)] hover:text-[var(--primary)] truncate"
                    >
                      {idea.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </AboutCard>
          )}
        </>
      }
    >
      {tab === "overview" && (
        <OverviewTab
          ideas={ideas}
          activity={activity}
          onSeeAllIdeas={() => setTab("ideas")}
          onSeeAllActivity={() => setTab("activity")}
        />
      )}

      {tab === "ideas" &&
        (ideas === null ? (
          <Loading />
        ) : ideas.length === 0 ? (
          <ProfileEmptyState text={isOwn ? t("profile.noIdeasOwn") : t("profile.noIdeasOther")} />
        ) : (
          <div className="space-y-4">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        ))}

      {tab === "agents" &&
        (agents === null ? (
          <Loading />
        ) : agents.length === 0 ? (
          <ProfileEmptyState text={isOwn ? t("profile.noAgentsOwn") : t("profile.noAgentsOther")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} t={t} showOwner={false} />
            ))}
          </div>
        ))}

      {tab === "activity" &&
        (activity === null ? (
          <Loading />
        ) : activity.length === 0 ? (
          <ProfileEmptyState text={t("activity.noActivity")} />
        ) : (
          <div className="surface-card">
            <ActivityList activities={activity} />
          </div>
        ))}

      {tab === "followers" &&
        (followers === null ? (
          <Loading />
        ) : followers.length === 0 ? (
          <ProfileEmptyState text={t("profile.noFollowers")} />
        ) : (
          <div className="surface-card overflow-hidden">
            {followers.map((u) => (
              <FollowUserRow
                key={u.id}
                user={u}
                initialFollowing={followerFollowingIds.has(u.id)}
                onFollowingChange={(next) => {
                  setFollowerFollowingIds((prev) => {
                    const s = new Set(prev);
                    if (next) s.add(u.id);
                    else s.delete(u.id);
                    return s;
                  });
                }}
              />
            ))}
          </div>
        ))}

      {tab === "following" &&
        (following === null ? (
          <Loading />
        ) : following.length === 0 ? (
          <div className="space-y-3">
            <ProfileEmptyState text={t("profile.notFollowing")} />
            {isOwn && (
              <div className="text-center">
                <Link
                  href="/agents"
                  className="inline-block text-sm text-[var(--primary)] hover:underline"
                >
                  {t("profile.discoverCreators")} →
                </Link>
              </div>
            )}
          </div>
        ) : (          <div className="surface-card overflow-hidden">
            {following.map((u) => (
              <FollowUserRow
                key={u.id}
                user={u}
                initialFollowing={followingFollowingIds.has(u.id)}
                onFollowingChange={(next) => {
                  setFollowingFollowingIds((prev) => {
                    const s = new Set(prev);
                    if (next) s.add(u.id);
                    else s.delete(u.id);
                    return s;
                  });
                  // 自己的「关注」列表取消关注后直接移除该行。
                  if (isOwn && !next) {
                    setFollowing((list) => list?.filter((x) => x.id !== u.id) ?? []);
                    setFollowingTotal((n) => Math.max(0, n - 1));
                  }
                }}
              />
            ))}
          </div>
        ))}
    </ProfileLayout>
  );
}

function OverviewTab({
  ideas,
  activity,
  onSeeAllIdeas,
  onSeeAllActivity,
}: {
  ideas: Idea[] | null;
  activity: ActivityLog[] | null;
  onSeeAllIdeas: () => void;
  onSeeAllActivity: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* 最新想法 */}
      <section className="surface-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--divider)]">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-[var(--title)]">
            <DeimosIcon name="document" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
            {t("profile.latestIdeas")}
          </h2>
          {ideas && ideas.length > 3 && (
            <button
              onClick={onSeeAllIdeas}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              {t("common.viewAll")}
            </button>
          )}
        </div>
        {ideas === null ? (
          <Loading />
        ) : ideas.length === 0 ? (
          <ProfileEmptyState text={t("profile.noIdeasShort")} />
        ) : (
          <div className="p-4 space-y-4">
            {ideas.slice(0, 3).map((idea) => (
              <IdeaCard key={idea.id} idea={idea} preview />
            ))}
          </div>
        )}
      </section>

      {/* 最近动态 */}
      <section className="surface-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--divider)]">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-[var(--title)]">
            <DeimosIcon name="pulse" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
            {t("profile.recentActivity")}
          </h2>
          {activity && activity.length > 5 && (
            <button
              onClick={onSeeAllActivity}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              {t("common.viewAll")}
            </button>
          )}
        </div>
        {activity === null ? (
          <Loading />
        ) : activity.length === 0 ? (
          <ProfileEmptyState text={t("activity.noActivity")} />
        ) : (
          <ActivityList activities={activity.slice(0, 5)} />
        )}
      </section>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
    </div>
  );
}
