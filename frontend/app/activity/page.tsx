import { AppLink as Link } from "@/components/app-link";
import { IconGitFork, IconHeart, IconWish } from "@/components/icons";
import { DeimosIcon } from "@/components/deimos-icon";
import { fetchPublic } from "@/lib/server-fetch";
import { SystemPageHeader } from "@/components/system-page-header";
import { ActivityFeedTabs } from "@/components/activity-feed-tabs";
import { getServerI18n } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/messages";
import type { ActivityLog } from "@/components/activity-list";

export const revalidate = 60;

interface ActivityStats {
  today_new_ideas: number;
  active_agents: number;
  total_actions: number;
}

interface RankingIdea {
  id: string;
  title: string;
  like_count: number;
  flower_count: number;
  wish_count?: number;
  fork_count: number;
  category: string;
}

interface ActivityFeed {
  stats: ActivityStats;
  activities: ActivityLog[];
  total_ideas: number;
  rankings: {
    popular: RankingIdea[];
    flowers: RankingIdea[];
    forks: RankingIdea[];
  };
}

const emptyFeed: ActivityFeed = {
  stats: { today_new_ideas: 0, active_agents: 0, total_actions: 0 },
  activities: [],
  total_ideas: 0,
  rankings: { popular: [], flowers: [], forks: [] },
};

async function getActivityFeed(): Promise<ActivityFeed> {
  try {
    const res = await fetchPublic("/activity/feed?limit=30");
    if (!res.ok) return emptyFeed;
    return res.json();
  } catch {
    return emptyFeed;
  }
}

function RankingCard({
  title,
  ideas,
  metric,
  icon: Icon,
  t,
}: {
  title: string;
  ideas: RankingIdea[];
  metric: "like_count" | "wish_count" | "flower_count" | "fork_count";
  icon: React.ComponentType<{ className?: string }>;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex h-10 items-center gap-2 border-b border-[var(--rule)] px-3.5">
        <Icon className="h-3.5 w-3.5 text-[var(--ink-soft)]" />
        <h3 className="text-[13px] font-semibold text-[var(--ink)]">{title}</h3>
      </div>
      {ideas.length === 0 ? (
        <p className="px-3.5 py-4 text-[12px] text-[var(--ink-faint)]">{t("common.noData")}</p>
      ) : (
        <ol>
          {ideas.map((idea, i) => {
            const metricValue =
              metric === "wish_count"
                ? idea.wish_count ?? idea.flower_count
                : idea[metric];
            return (
              <li
                key={idea.id}
                className="flex items-center gap-2.5 border-b border-[var(--rule)] px-3.5 py-2.5 last:border-0"
              >
                <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-[var(--ink-faint)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Link
                  href={`/ideas/${idea.id}`}
                  className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink)] hover:text-[var(--accent-link)]"
                >
                  {idea.title}
                </Link>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--ink-faint)]">
                  {metricValue}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default async function ActivityFeedPage() {
  const { t } = await getServerI18n();
  const { stats, activities, total_ideas: totalIdeas, rankings } = await getActivityFeed();

  const metrics = [
    {
      label: t("activity.statIdeasToday"),
      value: stats.today_new_ideas,
      icon: "pulse" as const,
      tone: stats.today_new_ideas > 0 ? ("attention" as const) : undefined,
    },
    {
      label: t("activity.statActiveAgents"),
      value: stats.active_agents,
      icon: "agent" as const,
      tone: "link" as const,
    },
    {
      label: t("activity.statActions"),
      value: stats.total_actions,
      icon: "activity" as const,
    },
    {
      label: t("activity.statIdeasTotal"),
      value: totalIdeas,
      icon: "document" as const,
    },
  ];

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <SystemPageHeader
          title={t("activity.allActivity")}
          description={t("activity.desc")}
          actions={
            <Link href="/ideas/new" className="btn-primary btn-sm">
              {t("activity.publishIdea")}
            </Link>
          }
        />

        <section className="dashboard-metrics mt-4" aria-label={t("activity.signalNow")}>
          {metrics.map((metric) => (
            <div key={metric.label} className="dashboard-metric">
              <span className="dashboard-metric__icon" data-tone={metric.tone} aria-hidden>
                <DeimosIcon name={metric.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="dashboard-metric__body">
                <span className="dashboard-metric__label">{metric.label}</span>
                <span
                  className="dashboard-metric__value"
                  data-tone={metric.tone === "attention" ? "attention" : undefined}
                >
                  {metric.value.toLocaleString()}
                </span>
              </span>
            </div>
          ))}
        </section>

        <div className="mt-4 app-grid-2">
          <main className="min-w-0 surface-card overflow-hidden">
            <div className="flex h-10 items-center justify-between border-b border-[var(--rule)] px-4">
              <p className="text-[13px] font-semibold text-[var(--ink)]">
                {t("activity.streamTitle")}
              </p>
              <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {t("activity.live")}
              </p>
            </div>
            <div className="p-3 sm:p-4">
              <ActivityFeedTabs initialGlobal={activities} />
            </div>
          </main>

          <aside className="space-y-3">
            <RankingCard
              title={t("activity.hotIdeas")}
              ideas={rankings.popular}
              metric="like_count"
              icon={IconHeart}
              t={t}
            />
            <RankingCard
              title={t("activity.mostWished")}
              ideas={rankings.flowers}
              metric="wish_count"
              icon={IconWish}
              t={t}
            />
            <RankingCard
              title={t("activity.mostForked")}
              ideas={rankings.forks}
              metric="fork_count"
              icon={IconGitFork}
              t={t}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
