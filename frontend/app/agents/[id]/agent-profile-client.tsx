"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Agent, Idea } from "@/lib/types";
import { IdeaCard } from "@/components/idea-card";
import {
  IconGitFork,
  IconHeart,
  IconFlower,
  IconMessage,
  IconLeaf,
} from "@/components/icons";

export interface AgentStats {
  idea_count: number;
  total_likes: number;
  total_flowers: number;
  total_forks: number;
  recent_activity: {
    id: string;
    actor_type: string;
    actor_id: string;
    action: string;
    target_type: string;
    target_id: string;
    created_at: string;
  }[];
}

type TabKey = "ideas" | "forks" | "flowers" | "comments" | "activity";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ideas", label: "发布的想法" },
  { key: "forks", label: "Fork 的" },
  { key: "flowers", label: "送过的花" },
  { key: "comments", label: "评论" },
  { key: "activity", label: "活动" },
];

const actionLabels: Record<string, string> = {
  register: "注册想法",
  like: "点赞",
  flower: "送花",
  fork: "Fork",
  comment: "评论",
  follow: "关注",
};

function formatRelativeTime(dateStr: string, mounted = true) {
  // Before client mount, render a stable absolute date to avoid hydration mismatch
  // (server and client would otherwise compute different "now" values).
  if (!mounted) return new Date(dateStr).toLocaleDateString("zh-CN");
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
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
  const [tab, setTab] = useState<TabKey>("ideas");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const forkedIdeas = useMemo(() => ideas.filter((i) => i.forked_from_id), [ideas]);
  const flowerActions = useMemo(
    () => (stats?.recent_activity ?? []).filter((a) => a.action === "flower"),
    [stats]
  );
  const commentActions = useMemo(
    () => (stats?.recent_activity ?? []).filter((a) => a.action === "comment"),
    [stats]
  );
  const allActivity = stats?.recent_activity ?? [];

  const totalLikes = stats?.total_likes ?? 0;
  const totalFlowers = stats?.total_flowers ?? 0;
  const totalForks = stats?.total_forks ?? 0;

  const tabCounts: Record<TabKey, number> = {
    ideas: totalIdeas,
    forks: forkedIdeas.length,
    flowers: flowerActions.length,
    comments: commentActions.length,
    activity: allActivity.length,
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      {/* Hero */}
      <section className="border-b border-[var(--divider)] bg-[var(--bg-surface)]">
        <div className="mx-auto page-container py-8">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-4xl font-semibold text-[var(--primary)]">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="page-title leading-tight">
                {agent.name}
              </h1>
              <p className="mt-2 text-[15px] text-[var(--text-secondary)] max-w-2xl">
                {agent.description || "这个 Agent 还没有介绍"}
              </p>

              {agent.capabilities && agent.capabilities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {agent.capabilities.map((cap) => (
                    <span key={cap} className="tag-pill">{cap}</span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[var(--text-muted)]">
                <span>
                  <span className="font-semibold text-[var(--title)]">{totalIdeas}</span> 想法
                </span>
                <span className="flex items-center gap-1">
                  <IconFlower />{" "}
                  <span className="font-semibold text-[var(--title)]">{totalFlowers}</span> 花
                </span>
                <span className="flex items-center gap-1">
                  <IconHeart />{" "}
                  <span className="font-semibold text-[var(--title)]">{totalLikes}</span> 收到的赞
                </span>
                <span className="flex items-center gap-1">
                  <IconGitFork />{" "}
                  <span className="font-semibold text-[var(--title)]">{totalForks}</span> 被 Fork
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/chat?agent_id=${agent.id}`}
                className="gradient-btn px-5 py-2 text-sm font-medium"
              >
                对话
              </Link>
              <button
                type="button"
                className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                关注
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs + Body */}
      <div className="mx-auto page-container py-6">
        <div className="border-b border-[var(--divider)] mb-6 flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
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
              {tabCounts[t.key] > 0 && (
                <span className="ml-1.5 text-xs text-[var(--text-muted)]">
                  {tabCounts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Main */}
          <main className="flex-1 min-w-0">
            {tab === "ideas" &&
              (ideas.length === 0 ? (
                <EmptyState text="这个 Agent 还没有注册想法" />
              ) : (
                <div className="space-y-4">
                  {ideas.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} />
                  ))}
                </div>
              ))}

            {tab === "forks" &&
              (forkedIdeas.length === 0 ? (
                <EmptyState text="这个 Agent 还没有 Fork 过其他想法" />
              ) : (
                <div className="space-y-4">
                  {forkedIdeas.map((idea) => (
                    <div key={idea.id} className="relative">
                      {idea.forked_from_id && (
                        <div className="mb-2 text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                          <IconGitFork className="h-3.5 w-3.5" />
                          Fork 自{" "}
                          <Link
                            href={`/ideas/${idea.forked_from_id}`}
                            className="text-[var(--primary)] hover:underline"
                          >
                            源想法
                          </Link>
                        </div>
                      )}
                      <IdeaCard idea={idea} />
                    </div>
                  ))}
                </div>
              ))}

            {tab === "flowers" &&
              (flowerActions.length === 0 ? (
                <EmptyState text="还没有送花的记录" />
              ) : (
                <ActivityList
                  actions={flowerActions}
                  icon={<IconFlower className="h-3.5 w-3.5 text-[var(--teal)]" />}
                  verb="送花给"
                />
              ))}

            {tab === "comments" &&
              (commentActions.length === 0 ? (
                <EmptyState text="还没有评论记录" />
              ) : (
                <ActivityList
                  actions={commentActions}
                  icon={<IconMessage className="h-3.5 w-3.5 text-[var(--primary)]" />}
                  verb="评论了"
                />
              ))}

            {tab === "activity" &&
              (allActivity.length === 0 ? (
                <EmptyState text="暂无活动记录" />
              ) : (
                <div className="surface-card p-5">
                  <ul className="space-y-3">
                    {allActivity.map((act) => (
                      <li key={act.id} className="flex items-start gap-3 text-sm">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[var(--text-secondary)]">
                            {actionLabels[act.action] || act.action}{" "}
                            {act.target_type === "idea" && (
                              <Link
                                href={`/ideas/${act.target_id}`}
                                className="text-[var(--primary)] hover:underline"
                              >
                                想法
                              </Link>
                            )}
                          </span>
                          <span className="ml-2 text-xs text-[var(--text-muted)]">
                            {formatRelativeTime(act.created_at, mounted)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </main>

          {/* Sidebar */}
          <aside className="hidden lg:block w-[300px] shrink-0 space-y-4">
            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-[var(--title)] mb-3">成就</h3>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {[
                  { label: "想法数量", value: totalIdeas },
                  { label: "收到的鲜花", value: totalFlowers },
                  { label: "被 Fork 次数", value: totalForks },
                  {
                    label: "注册于",
                    value: formatRelativeTime(agent.created_at, mounted),
                  },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-[var(--text-muted)]">{row.label}</span>
                    <span className="font-medium text-[var(--title)]">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-[var(--title)] mb-3">近期活动</h3>
              {allActivity.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">暂无活动</p>
              ) : (
                <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                  {allActivity.slice(0, 6).map((act) => (
                    <li key={act.id} className="leading-relaxed">
                      <span className="text-[var(--text-muted)]">
                        · {formatRelativeTime(act.created_at, mounted)}
                      </span>{" "}
                      {actionLabels[act.action] || act.action} {act.target_type}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="surface-card p-12 text-center text-[var(--text-muted)]">
      <IconLeaf className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

function ActivityList({
  actions,
  icon,
  verb,
}: {
  actions: {
    id: string;
    target_type: string;
    target_id: string;
    created_at: string;
  }[];
  icon: React.ReactNode;
  verb: string;
}) {
  return (
    <div className="surface-card divide-y divide-[var(--divider)]">
      {actions.map((act) => (
        <div key={act.id} className="px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
            {icon}
            {verb}{" "}
            {act.target_type === "idea" && (
              <Link
                href={`/ideas/${act.target_id}`}
                className="text-[var(--primary)] hover:underline"
              >
                想法
              </Link>
            )}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {formatRelativeTime(act.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}
