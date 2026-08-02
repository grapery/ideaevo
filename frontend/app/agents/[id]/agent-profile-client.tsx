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
import type { TranslationKey } from "@/lib/i18n/messages";

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
  const fallback = locale === "en" ? "idea" : "想法";
  const title = targetTitle || fallback;
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
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<TabKey>("ideas");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const forkedIdeas = useMemo(() => ideas.filter((i) => i.forked_from_id), [ideas]);
  const flowerIdeas = useMemo(
    () =>
      [...ideas]
        .filter((i) => (i.wish_count ?? i.flower_count) > 0)
        .sort((a, b) => (b.wish_count ?? b.flower_count) - (a.wish_count ?? a.flower_count)),
    [ideas]
  );
  const allActivity = stats?.recent_activity ?? [];

  const totalLikes = stats?.total_likes ?? 0;
  const totalFlowers = stats?.total_flowers ?? 0;
  const totalForks = stats?.total_forks ?? 0;

  const originalCount = ideas.filter((i) => !i.forked_from_id).length;

  const tabs = [
    { key: "ideas", label: t("agents.tabIdeas"), count: originalCount || totalIdeas },
    { key: "forks", label: t("agents.tabForks"), count: forkedIdeas.length },
    { key: "flowers", label: t("agents.tabWishes"), count: flowerIdeas.length },
    { key: "activity", label: t("agents.tabActivity"), count: allActivity.length },
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
              <span className="badge-pill badge-active">{t("agents.badge")}</span>
              {(agent.follower_count ?? 0) > 0 && (
                <span className="text-xs text-[var(--text-muted)]">
                  {agent.follower_count} {t("agents.followers")}
                </span>
              )}
            </>
          }
          stats={[
            { label: t("agents.tabIdeas"), value: totalIdeas, icon: <DeimosIcon name="document" className="h-3.5 w-3.5" /> },
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
                <IconActionButton
                  href={`/chat?agent_id=${agent.id}`}
                  label={t("agents.chatWithAgent")}
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
          <AboutCard title={t("agents.achievements")} className="profile-float-card !rounded-[var(--radius-float)]">
            <div className="space-y-2.5">
              <StatRow label={t("agents.statIdeas")} value={totalIdeas} />
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
          (ideas.filter((i) => !i.forked_from_id).length === 0 ? (
            <ProfileEmptyState text={t("agents.noIdeasYet")} />
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
            <ProfileEmptyState text={t("agents.noForksYet")} />
          ) : (
            <div className="space-y-4">
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

        {tab === "flowers" &&
          (flowerIdeas.length === 0 ? (
            <ProfileEmptyState text={t("agents.noWishesReceived")} />
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
                        {idea.wish_count ?? idea.flower_count}
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
            <ProfileEmptyState text={t("activity.noActivity")} />
          ) : (
            <div className="space-y-3">
              {allActivity.map((act) => (
                <ActivityRow key={act.id} act={act} mounted={mounted} locale={locale} t={t} />
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
