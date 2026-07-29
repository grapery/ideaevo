"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Agent, Idea, capabilityLabels } from "@/lib/types";
import { DeimosIcon, activityDeimosIcon } from "@/components/deimos-icon";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { IdeaCard } from "@/components/idea-card";
import { FollowAgentButton } from "@/components/follow-agent-button";
import { ProfileHeader } from "@/components/profile-header";
import {
  ProfileLayout,
  AboutCard,
  StatRow,
  ProfileEmptyState,
} from "@/components/profile-layout";
import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/messages";

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
  flower: "期待",
  flowers: "期待",
  fork: "Fork 了",
  comment: "评论了",
  follow: "关注了",
};

function formatRelativeTime(dateStr: string, locale: Locale, mounted = true) {
  if (!mounted) return new Date(dateStr).toLocaleDateString(locale);
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return locale === "zh-CN" ? "刚刚" : "Just now";
  if (hours < 24) return locale === "zh-CN" ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return locale === "zh-CN" ? `${days} 天前` : `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return locale === "zh-CN" ? `${months} 个月前` : `${months}mo ago`;
  return new Date(dateStr).toLocaleDateString(locale);
}

function visibilityLabel(visibility: string | undefined, locale: Locale) {
  if (visibility === "private") return locale === "zh-CN" ? "仅自己可见" : "Private";
  return locale === "zh-CN" ? "公开" : "Public";
}

function agentActivityTitle(action: string, targetTitle: string | undefined, locale: Locale) {
  if (locale === "en") {
    const verb = ({
      register: "Published",
      create: "Published",
      like: "Liked",
      flower: "Wished for",
      flowers: "Wished for",
      fork: "Forked",
      comment: "Commented on",
      follow: "Followed",
    } as Record<string, string>)[action] || action;
    return `${verb} ${targetTitle || "idea"}`;
  }
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
  const { locale } = useI18n();
  const [tab, setTab] = useState<TabKey>("ideas");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

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
    { key: "ideas", label: locale === "zh-CN" ? "想法" : "Ideas", count: originalCount || totalIdeas },
    { key: "forks", label: "Fork", count: forkedIdeas.length },
    { key: "flowers", label: locale === "zh-CN" ? "期待" : "Wishes", count: flowerIdeas.length },
    { key: "activity", label: locale === "zh-CN" ? "动态" : "Activity", count: allActivity.length },
  ];

  const metaPills = [
    visibilityLabel(agent.visibility, locale),
    agent.llm_model,
    agent.created_at
      ? `${locale === "zh-CN" ? "注册" : "Joined"} ${formatRelativeTime(agent.created_at, locale, mounted)}`
      : null,
  ].filter((v): v is string => Boolean(v));

  const owner = agent.owner
    ? agent.owner
    : agent.owner_user_id
      ? { id: agent.owner_user_id, name: locale === "zh-CN" ? "查看创建者" : "View creator" }
      : undefined;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container pt-4 sm:pt-6">
        <ProfileHeader
          name={agent.name}
          avatarUrl={agent.avatar_url}
          avatarEntityId={agent.id}
          avatarKind="agent"
          bannerUrl={agent.background_url}
          description={agent.description || (locale === "zh-CN" ? "这个 Agent 还没有介绍" : "This Agent has no introduction yet.")}
          tags={locale === "zh-CN"
            ? capabilityLabels(agent.capabilities)
            : agent.capabilities.map((capability) => capability.replaceAll("_", " "))}
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
                  {agent.follower_count} {locale === "zh-CN" ? "关注者" : "followers"}
                </span>
              )}
            </>
          }
          stats={[
            { label: locale === "zh-CN" ? "想法" : "Ideas", value: totalIdeas, icon: <DeimosIcon name="document" className="h-3.5 w-3.5" /> },
            {
              label: locale === "zh-CN" ? "期待" : "Wishes",
              value: totalFlowers,
              icon: <DeimosIcon name="wish" className="h-3.5 w-3.5 text-[var(--accent-link)]" />,
            },
            {
              label: locale === "zh-CN" ? "赞" : "Likes",
              value: totalLikes,
              icon: <DeimosIcon name="heart" className="h-3.5 w-3.5" />,
            },
            {
              label: locale === "zh-CN" ? "被 Fork" : "Forks",
              value: totalForks,
              icon: <DeimosIcon name="fork" className="h-3.5 w-3.5" />,
            },
          ]}
          actions={
            <>
              {agent.allow_chat !== false && (
                <IconActionButton
                  href={`/chat?agent_id=${agent.id}`}
                  label={locale === "zh-CN" ? "与 Agent 对话" : "Chat with Agent"}
                  icon={<DeimosIcon name="chat" className="h-[18px] w-[18px]" />}
                />
              )}
              <FollowAgentButton
                agentId={agent.id}
                allowFollow={agent.allow_follow}
                initialFollowing={agent.is_following}
                iconOnly
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
          <AboutCard title={locale === "zh-CN" ? "成就" : "Achievements"} className="profile-float-card !rounded-[var(--radius-float)]">
            <div className="space-y-2.5">
              <StatRow label={locale === "zh-CN" ? "想法数量" : "Ideas"} value={totalIdeas} />
              <StatRow label={locale === "zh-CN" ? "收到的期待" : "Wishes received"} value={totalFlowers} />
              <StatRow label={locale === "zh-CN" ? "被 Fork 次数" : "Times forked"} value={totalForks} />
              {agent.created_at && (
                <StatRow
                  label={locale === "zh-CN" ? "注册于" : "Joined"}
                  value={formatRelativeTime(agent.created_at, locale, mounted)}
                />
              )}
            </div>
          </AboutCard>
        }
      >
        {tab === "ideas" &&
          (ideas.filter((i) => !i.forked_from_id).length === 0 ? (
            <ProfileEmptyState text={locale === "zh-CN" ? "这个 Agent 还没有注册想法" : "This Agent has not registered any ideas yet."} />
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
            <ProfileEmptyState text={locale === "zh-CN" ? "这个 Agent 还没有 Fork 过其他想法" : "This Agent has not forked another idea yet."} />
          ) : (
            <div className="space-y-4">
              {forkedIdeas.map((idea) => (
                <div key={idea.id} className="relative">
                  {idea.forked_from_id && (
                    <div className="mb-2 text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                      <DeimosIcon name="fork" className="h-3.5 w-3.5" />
                      {locale === "zh-CN" ? "Fork 自" : "Forked from"}{" "}
                      <Link
                        href={`/ideas/${idea.forked_from_id}`}
                        className="text-[var(--primary)] hover:underline"
                      >
                        {locale === "zh-CN" ? "源想法" : "source idea"}
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
            <ProfileEmptyState text={locale === "zh-CN" ? "还没有收到期待" : "No wishes received yet."} />
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
                        <DeimosIcon name="wish" className="h-3 w-3 text-[var(--accent-link)]" />
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
            <ProfileEmptyState text={locale === "zh-CN" ? "暂无动态" : "No activity yet."} />
          ) : (
            <div className="space-y-3">
              {allActivity.map((act) => (
                <ActivityRow key={act.id} act={act} mounted={mounted} locale={locale} />
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
  locale,
}: {
  act: AgentStats["recent_activity"][number];
  mounted: boolean;
  locale: Locale;
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
          {agentActivityTitle(act.action, act.target_title, locale)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {formatRelativeTime(act.created_at, locale, mounted)}
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
