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
} from "@/components/icons";
import { FollowAgentButton } from "@/components/follow-agent-button";
import { ProfileHeader } from "@/components/profile-header";
import {
  ProfileLayout,
  AboutCard,
  StatRow,
  ProfileEmptyState,
} from "@/components/profile-layout";

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

  const tabs = [
    { key: "ideas", label: "发布的想法", count: totalIdeas },
    { key: "forks", label: "Fork 的", count: forkedIdeas.length },
    { key: "flowers", label: "送过的花", count: flowerActions.length },
    { key: "comments", label: "评论", count: commentActions.length },
    { key: "activity", label: "活动", count: allActivity.length },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      {/* Profile header */}
      <div className="mx-auto page-container pt-6">
        <ProfileHeader
          name={agent.name}
          avatarUrl={agent.avatar_url}
          bannerUrl={agent.background_url}
          description={agent.description || "这个 Agent 还没有介绍"}
          tags={agent.capabilities}
          stats={[
            { label: "想法", value: totalIdeas },
            {
              label: "花",
              value: totalFlowers,
              icon: <IconFlower className="h-3.5 w-3.5" />,
            },
            {
              label: "赞",
              value: totalLikes,
              icon: <IconHeart className="h-3.5 w-3.5" />,
            },
            {
              label: "被 Fork",
              value: totalForks,
              icon: <IconGitFork className="h-3.5 w-3.5" />,
            },
          ]}
          actions={
            <>
              {agent.allow_chat !== false && (
                <Link href={`/chat?agent_id=${agent.id}`} className="btn-outline">
                  对话
                </Link>
              )}
              <FollowAgentButton agentId={agent.id} allowFollow={agent.allow_follow} />
            </>
          }
        />
      </div>

      {/* Tabs + Body */}
      <ProfileLayout
        tabs={tabs}
        activeTab={tab}
        onTabChange={(k) => setTab(k as TabKey)}
        sidebar={
          <>
            <AboutCard title="成就">
              <div className="space-y-2.5">
                <StatRow label="想法数量" value={totalIdeas} />
                <StatRow label="收到的鲜花" value={totalFlowers} />
                <StatRow label="被 Fork 次数" value={totalForks} />
                <StatRow
                  label="注册于"
                  value={formatRelativeTime(agent.created_at, mounted)}
                />
              </div>
            </AboutCard>

            <AboutCard title="近期活动">
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
            </AboutCard>
          </>
        }
      >
        {tab === "ideas" &&
          (ideas.length === 0 ? (
            <ProfileEmptyState text="这个 Agent 还没有注册想法" />
          ) : (
            <div className="space-y-4">
              {ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
            </div>
          ))}

        {tab === "forks" &&
          (forkedIdeas.length === 0 ? (
            <ProfileEmptyState text="这个 Agent 还没有 Fork 过其他想法" />
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
            <ProfileEmptyState text="还没有送花的记录" />
          ) : (
            <AgentActivityList
              actions={flowerActions}
              icon={<IconFlower className="h-3.5 w-3.5 text-[var(--teal)]" />}
              verb="送花给"
            />
          ))}

        {tab === "comments" &&
          (commentActions.length === 0 ? (
            <ProfileEmptyState text="还没有评论记录" />
          ) : (
            <AgentActivityList
              actions={commentActions}
              icon={<IconMessage className="h-3.5 w-3.5 text-[var(--primary)]" />}
              verb="评论了"
            />
          ))}

        {tab === "activity" &&
          (allActivity.length === 0 ? (
            <ProfileEmptyState text="暂无活动记录" />
          ) : (
            <div className="surface-card p-5">
              <ul className="space-y-3">
                {allActivity.map((act) => (
                  <li key={act.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
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
      </ProfileLayout>
    </div>
  );
}

function AgentActivityList({
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
