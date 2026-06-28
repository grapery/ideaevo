"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppLink as AppLinkComponent } from "@/components/app-link";
import { userApi, chatApi } from "@/lib/api-client";
import { getApiBase } from "@/lib/api-base";
import { useAuth } from "@/lib/auth-context";
import { useApiKey } from "@/lib/api-key-context";
import { Idea, User, ChatSession } from "@/lib/types";
import { IdeaCard } from "@/components/idea-card";
import { ActivityList, ActivityLog } from "@/components/activity-list";
import UserCard from "@/components/user-card";
import {
  ProfileLayout,
  AboutCard,
  StatRow,
  ProfileEmptyState,
} from "@/components/profile-layout";

const AppLink = AppLinkComponent as unknown as React.ComponentType<{
  href: string;
  className?: string;
  children: React.ReactNode;
}>;

type Tab = "overview" | "ideas" | "activity" | "followers" | "following" | "sessions" | "api";

interface ProfileStats {
  idea_count?: number;
  follower_count?: number;
  following_count?: number;
  session_count?: number;
}

function formatJoinDate(dateStr: string) {
  const d = new Date(dateStr);
  return `加入于 ${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
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
  const [tab, setTab] = useState<Tab>("overview");

  // 各 tab 数据，按需懒加载。
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [activity, setActivity] = useState<ActivityLog[] | null>(null);
  const [followers, setFollowers] = useState<User[] | null>(null);
  const [following, setFollowing] = useState<User[] | null>(null);
  const [sessions, setSessions] = useState<ChatSession[] | null>(null);
  const [followersTotal, setFollowersTotal] = useState(stats.follower_count ?? 0);
  const [followingTotal, setFollowingTotal] = useState(stats.following_count ?? 0);

  const loadIdeas = useCallback(async () => {
    try {
      const res = await userApi.getUserIdeas(userId, 50);
      setIdeas(res.ideas ?? []);
    } catch {
      setIdeas([]);
    }
  }, [userId]);

  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch(
        `${getApiBase()}/activity?actor_id=${userId}&limit=50`
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

  // tab 切换时按需加载。
  useEffect(() => {
    if (tab === "followers" && followers === null) loadFollowers();
    if (tab === "following" && following === null) loadFollowing();
    if (tab === "sessions" && sessions === null) loadSessions();
  }, [tab, followers, following, sessions, loadFollowers, loadFollowing, loadSessions]);

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
      { key: "overview", label: "概览" },
      { key: "ideas", label: "想法", count: stats.idea_count ?? 0 },
      { key: "activity", label: "动态" },
      { key: "followers", label: "关注者", count: followersTotal },
      { key: "following", label: "关注中", count: followingTotal },
      { key: "sessions", label: "对话", ownOnly: true },
      { key: "api", label: "API 管理", ownOnly: true },
    ] as { key: Tab; label: string; count?: number; ownOnly?: boolean }[]
  )
    .filter((t) => !t.ownOnly || isOwn)
    .map(({ key, label, count }) => ({ key, label, count }));

  const ideaCount = stats.idea_count ?? 0;

  return (
    <ProfileLayout
      tabs={tabs}
      activeTab={tab}
      onTabChange={(k) => setTab(k as Tab)}
      sidebar={
        <>
          <AboutCard title="关于">
            <div className="space-y-2.5 text-sm">
              {user.bio && (
                <p className="text-[var(--text-secondary)] leading-relaxed">{user.bio}</p>
              )}
              {isOwn && user.email && (
                <p className="text-[var(--text-muted)]">{user.email}</p>
              )}
              <p className="text-[var(--text-muted)]">{formatJoinDate(user.created_at)}</p>
              {(user.role === "admin" || user.role === "moderator") && (
                <span className="badge-pill badge-active">{user.role === "admin" ? "管理员" : "版主"}</span>
              )}
            </div>
          </AboutCard>

          <AboutCard title="数据概览">
            <div className="space-y-2.5">
              <StatRow label="想法" value={ideaCount} />
              <StatRow label="关注者" value={followersTotal} />
              <StatRow label="关注中" value={followingTotal} />
              {isOwn && <StatRow label="对话" value={stats.session_count ?? 0} />}
            </div>
          </AboutCard>

          {ideas !== null && ideas.length > 0 && (
            <AboutCard title="最新想法">
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
          <ProfileEmptyState text={isOwn ? "你还没有创建想法" : "这个用户还没有创建想法"} />
        ) : (
          <div className="space-y-4">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        ))}

      {tab === "activity" &&
        (activity === null ? (
          <Loading />
        ) : activity.length === 0 ? (
          <ProfileEmptyState text="暂无动态" />
        ) : (
          <div className="surface-card">
            <ActivityList activities={activity} />
          </div>
        ))}

      {tab === "followers" &&
        (followers === null ? (
          <Loading />
        ) : followers.length === 0 ? (
          <ProfileEmptyState text="还没有关注者" />
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
          <ProfileEmptyState text="还没有关注任何人" />
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
  return (
    <div className="space-y-6">
      {/* 最新想法 */}
      <section className="surface-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--divider)]">
          <h2 className="text-base font-semibold text-[var(--title)]">最新想法</h2>
          {ideas && ideas.length > 3 && (
            <button
              onClick={onSeeAllIdeas}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              查看全部
            </button>
          )}
        </div>
        {ideas === null ? (
          <Loading />
        ) : ideas.length === 0 ? (
          <ProfileEmptyState text="还没有创建想法" />
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
          <h2 className="text-base font-semibold text-[var(--title)]">最近动态</h2>
          {activity && activity.length > 5 && (
            <button
              onClick={onSeeAllActivity}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              查看全部
            </button>
          )}
        </div>
        {activity === null ? (
          <Loading />
        ) : activity.length === 0 ? (
          <ProfileEmptyState text="暂无动态" />
        ) : (
          <ActivityList activities={activity.slice(0, 5)} />
        )}
      </section>
    </div>
  );
}

function SessionsTab({ sessions }: { sessions: ChatSession[] | null }) {
  return (
    <section className="surface-card">
      <div className="px-5 py-4 border-b border-[var(--divider)]">
        <h2 className="text-base font-semibold text-[var(--title)]">最近对话</h2>
      </div>
      {sessions === null ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <ProfileEmptyState text="还没有对话" />
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
                  {s.message_count} 条消息 ·{" "}
                  {new Date(s.updated_at).toLocaleDateString("zh-CN")}
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
        <h2 className="text-base font-semibold text-[var(--title)]">Agent API Key</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          通过 API Key 在本地 AI 工具（MCP）或你的代理 Agent（A2A）中调用系统能力。
        </p>
      </div>

      {isReady ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--divider)] bg-[var(--bg-subtle)]/50 p-4">
            <p className="text-sm text-[var(--text-muted)]">当前绑定的 Agent</p>
            <p className="text-base font-medium text-[var(--title)] mt-1">{agentName || "Agent"}</p>
            {agentId && (
              <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">{agentId}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--title)] mb-1.5">API Key</label>
            <div className="flex gap-2">
              <input
                type={revealed ? "text" : "password"}
                readOnly
                value={apiKey || ""}
                className="flex-1 rounded-lg border border-[var(--divider)] bg-white px-3 py-2 text-sm font-mono text-[var(--text-secondary)]"
              />
              <button
                onClick={() => setRevealed(!revealed)}
                className="btn-default btn-sm"
              >
                {revealed ? "隐藏" : "显示"}
              </button>
            </div>
          </div>
          <button
            onClick={() => setApiKey("")}
            className="btn-danger btn-sm"
          >
            解除绑定
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[var(--title)]">输入 Agent API Key</label>
          <div className="max-w-md flex gap-2">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSet()}
              placeholder="wanye_xxxxxxxx"
              className="flex-1 rounded-lg border border-[var(--divider)] bg-white px-3 py-2 text-sm"
            />
            <button onClick={handleSet} className="gradient-btn px-5 py-2 text-sm font-medium">
              确认
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            还没有 API Key？
            <Link href="/register" className="text-[var(--primary)] hover:underline ml-1">
              注册 Agent
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
