"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppLink as AppLinkComponent } from "@/components/app-link";
import { userApi, chatApi, billingApi } from "@/lib/api-client";
import { getApiBase } from "@/lib/api-base";
import { useAuth } from "@/lib/auth-context";
import { useApiKey } from "@/lib/api-key-context";
import { Idea, User, ChatSession, Agent, MembershipView } from "@/lib/types";
import { IdeaCard } from "@/components/idea-card";
import { ActivityList, ActivityLog } from "@/components/activity-list";
import UserCard from "@/components/user-card";
import {
  ProfileLayout,
  AboutCard,
  StatRow,
  ProfileEmptyState,
} from "@/components/profile-layout";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

const AppLink = AppLinkComponent as unknown as React.ComponentType<{
  href: string;
  className?: string;
  children: React.ReactNode;
}>;

type Tab = "overview" | "ideas" | "agents" | "activity" | "followers" | "following" | "sessions" | "api";

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
  const { user: currentUser } = useAuth();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");

  // 各 tab 数据，按需懒加载。
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [activity, setActivity] = useState<ActivityLog[] | null>(null);
  const [followers, setFollowers] = useState<User[] | null>(null);
  const [following, setFollowing] = useState<User[] | null>(null);
  const [sessions, setSessions] = useState<ChatSession[] | null>(null);
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
    } catch {
      setFollowers([]);
    }
  }, [userId]);

  const loadFollowing = useCallback(async () => {
    try {
      const res = await userApi.getFollowing(userId, 50);
      setFollowing(res.users ?? []);
      setFollowingTotal(res.total ?? 0);
    } catch {
      setFollowing([]);
    }
  }, [userId]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await chatApi.listSessions(20, 0);
      setSessions(res.sessions ?? []);
    } catch {
      setSessions([]);
    }
  }, []);

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
    if (tab === "sessions" && sessions === null) loadSessions();
  }, [tab, agents, followers, following, sessions, loadAgents, loadFollowers, loadFollowing, loadSessions]);

  // 允许 header 统计点击通过自定义事件跳转 tab。
  useEffect(() => {
    function onTabChange(e: Event) {
      const key = (e as CustomEvent<string>).detail;
      if (key) setTab(key as Tab);
    }
    window.addEventListener("profile-tab-change", onTabChange as EventListener);
    return () => window.removeEventListener("profile-tab-change", onTabChange as EventListener);
  }, []);

  const tabs: { key: Tab; label: string; count?: number }[] = (
    [
      { key: "overview", label: t("profile.overview") },
      { key: "ideas", label: t("idea.ideas"), count: stats.idea_count ?? 0 },
      { key: "agents", label: t("header.agents"), count: stats.agent_count ?? 0 },
      { key: "activity", label: t("header.activity") },
      { key: "followers", label: t("agents.followers"), count: followersTotal },
      { key: "following", label: t("activity.followFeed"), count: followingTotal },
      { key: "sessions", label: t("idea.chat"), ownOnly: true },
      { key: "api", label: t("settings.apiKeyTitle"), ownOnly: true },
    ] as { key: Tab; label: string; count?: number; ownOnly?: boolean }[]
  )
    .filter((tab) => !tab.ownOnly || isOwn)
    .map(({ key, label, count }) => ({ key, label, count }));

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
                <Link href="/user/agents" className="inline-block text-sm text-[var(--primary)] hover:underline">
                  {t("settings.myAgents")} →
                </Link>
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
              <StatRow label={t("agents.followers")} value={followersTotal} />
              <StatRow label={t("activity.followFeed")} value={followingTotal} />
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
                      <span className="badge-pill badge-muted">{t("billing.freeUser")}</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="surface-card p-4 hover:border-[var(--ink-faint)] transition-colors"
              >
                <p className="font-medium text-[var(--ink)]">{agent.name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                  {agent.description || t("agents.noDesc")}
                </p>
                <p className="meta-label mt-2">
                  {agent.visibility === "private" ? t("common.private") : t("common.public")}
                  {agent.follower_count != null ? ` · ${agent.follower_count} ${t("agents.followers")}` : ""}
                </p>
              </Link>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {followers.map((u) => (
              <div key={u.id} className="surface-card p-4">
                <UserCard user={u} />
              </div>
            ))}
          </div>
        ))}

      {tab === "following" &&
        (following === null ? (
          <Loading />
        ) : following.length === 0 ? (
          <ProfileEmptyState text={t("profile.notFollowing")} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {following.map((u) => (
              <div key={u.id} className="surface-card p-4">
                <UserCard user={u} />
              </div>
            ))}
          </div>
        ))}

      {tab === "sessions" && isOwn && <SessionsTab sessions={sessions} />}

      {tab === "api" && isOwn && <ApiKeyTab />}
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
          <h2 className="text-base font-semibold text-[var(--title)]">{t("profile.latestIdeas")}</h2>
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
          <h2 className="text-base font-semibold text-[var(--title)]">{t("profile.recentActivity")}</h2>
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

function SessionsTab({ sessions }: { sessions: ChatSession[] | null }) {
  const { t, locale } = useI18n();
  return (
    <section className="surface-card">
      <div className="px-5 py-4 border-b border-[var(--divider)]">
        <h2 className="text-base font-semibold text-[var(--title)]">{t("profile.recentConversations")}</h2>
      </div>
      {sessions === null ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <ProfileEmptyState text={t("profile.noConversations")} />
      ) : (
        <ul className="divide-y divide-[var(--divider)]">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/chat/${s.id}`}
                className="block px-5 py-4 hover:bg-[var(--bg-subtle)] transition-colors"
              >
                <div className="text-sm font-medium text-[var(--title)]">{s.title}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  {t("chat.messageCount", { count: s.message_count })} ·{" "}
                  {new Date(s.updated_at).toLocaleDateString(locale)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
    </div>
  );
}

// ApiKeyTab —— Agent API Key 管理（原 dashboard 的 Agent-centric 功能合并到主页）。
// 用户可以通过 API Key 在本地 AI 工具中调用 MCP 工具创建想法、操作 idea。
function ApiKeyTab() {
  const { apiKey, setApiKey, agentId, agentName, isReady } = useApiKey();
  const { t } = useI18n();
  const [inputKey, setInputKey] = useState("");
  const [revealed, setRevealed] = useState(false);

  const handleSet = () => {
    if (inputKey.trim()) {
      setApiKey(inputKey.trim());
      setInputKey("");
    }
  };

  return (
    <section className="surface-card p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--title)]">{t("settings.apiKeyTitle")}</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {t("settings.apiKeyHint")}
        </p>
      </div>

      {isReady ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--divider)] bg-[var(--bg-subtle)]/50 p-4">
            <p className="text-sm text-[var(--text-muted)]">{t("settings.boundAgent")}</p>
            <p className="text-base font-medium text-[var(--title)] mt-1">{agentName || t("activity.agent")}</p>
            {agentId && (
              <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">{agentId}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--title)] mb-1.5">{t("agentKey.title")}</label>
            <div className="flex gap-2">
              <input
                type={revealed ? "text" : "password"}
                readOnly
                value={apiKey || ""}
                className="flex-1 rounded-lg border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-mono text-[var(--text-secondary)]"
              />
              <button
                onClick={() => setRevealed(!revealed)}
                className="btn-default btn-sm"
              >
                {revealed ? t("settings.hide") : t("settings.show")}
              </button>
            </div>
          </div>
          <button
            onClick={() => setApiKey("")}
            className="btn-danger btn-sm"
          >
            {t("settings.unbind")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[var(--title)]">{t("settings.inputApiKey")}</label>
          <div className="max-w-md flex gap-2">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSet()}
              placeholder="wanye_xxxxxxxx"
              className="flex-1 rounded-lg border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
            <button onClick={handleSet} className="btn-outline px-5 py-2 text-sm font-medium">
              {t("common.confirm")}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {t("settings.noKeyYet")}
            <Link href="/register" className="text-[var(--primary)] hover:underline ml-1">
              {t("settings.registerNew")}
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
