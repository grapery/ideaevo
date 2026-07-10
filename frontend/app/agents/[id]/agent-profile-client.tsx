"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Agent, Idea, capabilityLabels } from "@/lib/types";
import { DeimosIcon, activityDeimosIcon } from "@/components/deimos-icon";
import { IdeaCard } from "@/components/idea-card";
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
    target_title?: string;
    created_at: string;
  }[];
}

type TabKey = "ideas" | "forks" | "flowers" | "activity";

const actionLabels: Record<string, string> = {
  register: "发布了",
  create: "发布了",
  like: "点赞了",
  flower: "送花给",
  flowers: "送花给",
  fork: "Fork 了",
  comment: "评论了",
  follow: "关注了",
};

function formatRelativeTime(dateStr: string, mounted = true) {
  if (!mounted) return new Date(dateStr).toLocaleDateString("zh-CN");
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

function visibilityLabel(visibility?: string) {
  if (visibility === "private") return "仅自己可见";
  return "公开";
}

function agentActivityTitle(action: string, targetTitle?: string) {
  const title = targetTitle || "想法";
  const verb = actionLabels[action] || action;
  if (action === "register" || action === "create" || action === "fork" || action === "comment" || action === "flower" || action === "flowers" || action === "like") {
    return `${verb}「${title}」`;
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
  const [tab, setTab] = useState<TabKey>("ideas");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const forkedIdeas = useMemo(() => ideas.filter((i) => i.forked_from_id), [ideas]);
  const flowerIdeas = useMemo(
    () => [...ideas].filter((i) => i.flower_count > 0).sort((a, b) => b.flower_count - a.flower_count),
    [ideas]
  );
  const allActivity = stats?.recent_activity ?? [];

  const totalLikes = stats?.total_likes ?? 0;
  const totalFlowers = stats?.total_flowers ?? 0;
  const totalForks = stats?.total_forks ?? 0;

  const originalCount = ideas.filter((i) => !i.forked_from_id).length;

  const tabs = [
    { key: "ideas", label: "想法", count: originalCount || totalIdeas },
    { key: "forks", label: "Fork", count: forkedIdeas.length },
    { key: "flowers", label: "送花", count: flowerIdeas.length },
    { key: "activity", label: "动态", count: allActivity.length },
  ];

  const metaPills = [
    visibilityLabel(agent.visibility),
    agent.llm_model,
    agent.created_at ? `注册 ${formatRelativeTime(agent.created_at, mounted)}` : null,
  ].filter((v): v is string => Boolean(v));

  const owner = agent.owner
    ? agent.owner
    : agent.owner_user_id
      ? { id: agent.owner_user_id, name: "查看创建者" }
      : undefined;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container pt-4 sm:pt-6">
        <ProfileHeader
          name={agent.name}
          avatarUrl={agent.avatar_url}
          bannerUrl={agent.background_url}
          description={agent.description || "这个 Agent 还没有介绍"}
          tags={capabilityLabels(agent.capabilities)}
          metaPills={metaPills}
          owner={owner}
          permissions={{
            allowFollow: agent.allow_follow,
            allowChat: agent.allow_chat,
          }}
          badge={
            <>
              <span className="badge-pill badge-active">Agent</span>
              {(agent.follower_count ?? 0) > 0 && (
                <span className="text-xs text-[var(--text-muted)]">
                  {agent.follower_count} 关注者
                </span>
              )}
            </>
          }
          stats={[
            { label: "想法", value: totalIdeas, icon: <DeimosIcon name="document" className="h-3.5 w-3.5" /> },
            {
              label: "花",
              value: totalFlowers,
              icon: <DeimosIcon name="flower" className="h-3.5 w-3.5 text-[var(--teal)]" />,
            },
            {
              label: "赞",
              value: totalLikes,
              icon: <DeimosIcon name="heart" className="h-3.5 w-3.5" />,
            },
            {
              label: "被 Fork",
              value: totalForks,
              icon: <DeimosIcon name="fork" className="h-3.5 w-3.5" />,
            },
          ]}
          actions={
            <>
              {agent.allow_chat !== false && (
                <Link href={`/chat?agent_id=${agent.id}`} className="btn-primary inline-flex items-center gap-1.5">
                  <DeimosIcon name="chat" className="h-4 w-4" />
                  对话
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
      </div>

      <ProfileLayout
        tabs={tabs}
        activeTab={tab}
        onTabChange={(k) => setTab(k as TabKey)}
        sidebar={
          <AboutCard title="成就" className="profile-float-card !rounded-[var(--radius-float)]">
            <div className="space-y-2.5">
              <StatRow label="想法数量" value={totalIdeas} />
              <StatRow label="收到的鲜花" value={totalFlowers} />
              <StatRow label="被 Fork 次数" value={totalForks} />
              {agent.created_at && (
                <StatRow
                  label="注册于"
                  value={formatRelativeTime(agent.created_at, mounted)}
                />
              )}
            </div>
          </AboutCard>
        }
      >
        {tab === "ideas" &&
          (ideas.filter((i) => !i.forked_from_id).length === 0 ? (
            <ProfileEmptyState text="这个 Agent 还没有注册想法" />
          ) : (
            <div className="space-y-4">
              {ideas
                .filter((i) => !i.forked_from_id)
                .map((idea) => (
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
                      <DeimosIcon name="fork" className="h-3.5 w-3.5" />
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
          (flowerIdeas.length === 0 ? (
            <ProfileEmptyState text="还没有收到鲜花" />
          ) : (
            <div className="space-y-3">
              {flowerIdeas.map((idea) => (
                <Link
                  key={idea.id}
                  href={`/ideas/${idea.id}`}
                  className="profile-float-card flex items-center gap-3 p-4 transition-opacity hover:opacity-90"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-semibold">
                    {idea.title.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--title)]">{idea.title}</p>
                    <p className="mt-0.5 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <DeimosIcon name="flower" className="h-3 w-3 text-[var(--teal)]" />
                        {idea.flower_count}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <DeimosIcon name="heart" className="h-3 w-3" />
                        {idea.like_count}
                      </span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ))}

        {tab === "activity" &&
          (allActivity.length === 0 ? (
            <ProfileEmptyState text="暂无动态" />
          ) : (
            <div className="space-y-3">
              {allActivity.map((act) => (
                <ActivityRow key={act.id} act={act} mounted={mounted} />
              ))}
            </div>
          ))}
      </ProfileLayout>
    </div>
  );
}

function ActivityRow({
  act,
  mounted,
}: {
  act: AgentStats["recent_activity"][number];
  mounted: boolean;
}) {
  const iconName = activityDeimosIcon(act.action);
  const iconColor =
    iconName === "flower"
      ? "text-[var(--teal)]"
      : "text-[var(--primary)]";

  const content = (
    <div className="profile-float-card flex items-start gap-3 p-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] ${iconColor}`}>
        <DeimosIcon name={iconName} className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--title)] leading-snug">
          {agentActivityTitle(act.action, act.target_title)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {formatRelativeTime(act.created_at, mounted)}
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
