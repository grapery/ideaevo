"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppLink as AppLinkComponent } from "@/components/app-link";
import { userApi, chatApi } from "@/lib/api-client";
import { getApiBase } from "@/lib/api-base";
import { useAuth } from "@/lib/auth-context";
import { Idea, User, ChatSession } from "@/lib/types";
import { IdeaCard } from "@/components/idea-card";
import { ActivityList, ActivityLog } from "@/components/activity-list";
import UserCard from "@/components/user-card";
import { IconLeaf } from "@/components/icons";

const AppLink = AppLinkComponent as unknown as React.ComponentType<{
  href: string;
  className?: string;
  children: React.ReactNode;
}>;

type Tab = "overview" | "ideas" | "activity" | "followers" | "following" | "sessions";

interface ProfileStats {
  idea_count?: number;
  follower_count?: number;
  following_count?: number;
  session_count?: number;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-12 text-center text-[var(--text-muted)]">
      <IconLeaf className="h-10 w-10 mx-auto mb-3" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

/**
 * UserProfileBody —— GitHub 风格的用户主页主体（tab 导航 + 主列/侧栏）。
 * isOwn=true 时额外显示"对话"tab（自己的主页）。
 * 镜像 agent-profile-client 的布局结构。
 */
export function UserProfileBody({
  userId,
  isOwn,
  stats,
}: {
  userId: string;
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

  const tabs: { key: Tab; label: string; count?: number; ownOnly?: boolean }[] = [
    { key: "overview", label: "概览" },
    { key: "ideas", label: "想法", count: stats.idea_count ?? 0 },
    { key: "activity", label: "动态" },
    { key: "followers", label: "关注者", count: followersTotal },
    { key: "following", label: "关注中", count: followingTotal },
    { key: "sessions", label: "对话", ownOnly: true },
  ].filter((t) => !t.ownOnly || isOwn) as { key: Tab; label: string; count?: number; ownOnly?: boolean }[];

  const ideaCount = stats.idea_count ?? 0;

  return (
    <div className="mx-auto page-container py-6">
      {/* Tabs */}
      <div className="border-b border-[var(--divider)] mb-6 flex gap-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.key
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--title)]"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 text-xs text-[var(--text-muted)]">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Main column */}
        <main className="flex-1 min-w-0">
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
              <EmptyState text={isOwn ? "你还没有创建想法" : "这个用户还没有创建想法"} />
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
              <EmptyState text="暂无动态" />
            ) : (
              <div className="surface-card">
                <ActivityList activities={activity} />
              </div>
            ))}

          {tab === "followers" &&
            (followers === null ? (
              <Loading />
            ) : followers.length === 0 ? (
              <EmptyState text="还没有关注者" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <EmptyState text="还没有关注任何人" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {following.map((u) => (
                  <div key={u.id} className="surface-card p-4">
                    <UserCard user={u} />
                  </div>
                ))}
              </div>
            ))}

          {tab === "sessions" && isOwn && (
            <SessionsTab sessions={sessions} />
          )}
        </main>

        {/* Sidebar */}
        <aside className="hidden lg:block w-[300px] shrink-0 space-y-4">
          <div className="panel-card">
            <h3 className="text-base font-semibold text-[var(--title)] mb-4">数据概览</h3>
            <div className="space-y-3">
              <StatRow label="想法" value={ideaCount} />
              <StatRow label="关注者" value={followersTotal} />
              <StatRow label="关注中" value={followingTotal} />
              {isOwn && <StatRow label="对话" value={stats.session_count ?? 0} />}
            </div>
          </div>

          {ideas !== null && ideas.length > 0 && (
            <div className="panel-card">
              <h3 className="text-base font-semibold text-[var(--title)] mb-3">最新想法</h3>
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
            </div>
          )}
        </aside>
      </div>
    </div>
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
          <EmptyState text="还没有创建想法" />
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
          <EmptyState text="暂无动态" />
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
        <EmptyState text="还没有对话" />
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

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-semibold text-[var(--title)] tabular-nums">{value}</span>
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
