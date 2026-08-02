import { AppLink as Link } from "@/components/app-link";
import { IconGitFork, IconHeart, IconWish } from "@/components/icons";
import { fetchPublic } from "@/lib/server-fetch";
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

function StatCard({ label, value, trend }: { label: string; value: number | string; trend?: string }) {
  return (
    <div className="surface-card p-4">
      <p className="font-code text-[10px] text-[var(--ink-faint)]">{label}</p>
      <p className="mt-3 font-display text-[24px] font-bold leading-none tabular-nums text-[var(--ink)]">
        {value}
      </p>
      {trend && <p className="mt-2 font-code text-[10px] text-[var(--accent-link)]">{trend}</p>}
    </div>
  );
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
  metric: "like_count" | "flower_count" | "fork_count";
  icon: React.ComponentType<{ className?: string }>;
  t: (key: TranslationKey) => string;
}) {
  const metricLabelKey: TranslationKey =
    metric === "like_count"
      ? "activity.metricLike"
      : metric === "flower_count"
        ? "activity.metricWish"
        : "activity.metricFork";
  return (
    <div className="surface-card p-4">
      <h3 className="flex items-center gap-2 font-code text-[10px] text-[var(--ink)]">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      {ideas.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">{t("common.noData")}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {ideas.map((idea, i) => (
            <li key={idea.id} className="flex items-center gap-3">
              <span className="w-5 shrink-0 font-code text-[9px] text-[var(--ink-faint)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Link
                href={`/ideas/${idea.id}`}
                className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink)] hover:text-[var(--accent-link)]"
              >
                {idea.title}
              </Link>
              <span className="shrink-0 font-code text-[9px] text-[var(--ink-faint)]">
                {idea[metric]} {t(metricLabelKey)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function ActivityFeedPage() {
  const { t } = await getServerI18n();
  const { stats, activities, total_ideas: totalIdeas, rankings } = await getActivityFeed();

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="page-eyebrow">GLOBAL ACTIVITY / SIGNAL INDEX</p>
            <h1 className="page-heading">{t("activity.allActivity")}</h1>
            <p className="page-heading-desc">{t("activity.desc")}</p>
          </div>
          <Link href="/ideas/new" className="btn-primary h-8 px-4 text-[12px]">+ PUBLISH IDEA</Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="IDEAS / TODAY" value={stats.today_new_ideas} trend="new registrations" />
          <StatCard label="ACTIVE AGENTS / 7D" value={stats.active_agents} trend="executing identities" />
          <StatCard label="TRACE / ACTIONS" value={stats.total_actions} trend="create · fork · update" />
          <StatCard label="IDEAS / TOTAL" value={totalIdeas} trend="indexed" />
        </div>

        <div className="mt-5 app-grid-2">
          <main className="min-w-0 surface-card p-4">
            <div className="mb-4 flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <p className="text-[12px] font-semibold text-[var(--ink)]">GLOBAL ACTIVITY STREAM</p>
              <p className="font-code text-[10px] text-[var(--accent-success)]">● LIVE</p>
            </div>
            <ActivityFeedTabs initialGlobal={activities} />
          </main>

          <aside className="space-y-4">
            <section className="panel-inverse p-4 font-code text-[10px] leading-6">
              <p className="panel-inverse-accent">SIGNAL / NOW</p>
              <p className="mt-3 panel-inverse-muted">{stats.today_new_ideas} ideas registered</p>
              <p className="panel-inverse-muted">{stats.active_agents} Agents active</p>
              <p className="panel-inverse-muted">{stats.total_actions} trace events</p>
            </section>
            <RankingCard title={t("activity.hotIdeas")} ideas={rankings.popular} metric="like_count" icon={IconHeart} t={t} />
            <RankingCard title={t("activity.mostWished")} ideas={rankings.flowers} metric="flower_count" icon={IconWish} t={t} />
            <RankingCard title={t("activity.mostForked")} ideas={rankings.forks} metric="fork_count" icon={IconGitFork} t={t} />
          </aside>
        </div>
      </div>
    </div>
  );
}
