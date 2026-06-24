import { AppLink as Link } from "@/components/app-link";
import { IconGitFork, IconHeart, IconFlower } from "@/components/icons";
import { fetchPublic } from "@/lib/server-fetch";
import { ActivityFeedTabs } from "@/components/activity-feed-tabs";
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
    <div className="surface-card p-6">
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 heading-serif text-[36px] leading-none tabular-nums">{value}</p>
      {trend && <p className="mt-2 text-xs text-[var(--primary)]">{trend}</p>}
    </div>
  );
}

function RankingCard({
  title,
  ideas,
  metric,
  icon: Icon,
}: {
  title: string;
  ideas: RankingIdea[];
  metric: "like_count" | "flower_count" | "fork_count";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const metricLabel = metric === "like_count" ? "赞" : metric === "flower_count" ? "花" : "Fork";
  return (
    <div className="surface-card p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--title)] mb-4">
        <Icon className="h-4 w-4 text-[var(--primary)]" />
        {title}
      </h3>
      {ideas.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">暂无数据</p>
      ) : (
        <ol className="space-y-3">
          {ideas.map((idea, i) => (
            <li key={idea.id} className="flex items-center gap-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                i === 0 ? "bg-[var(--coral-soft)] text-[var(--coral)]" :
                i === 1 ? "bg-[var(--primary-soft)] text-[var(--primary)]" :
                "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
              }`}>
                {i + 1}
              </span>
              <Link
                href={`/ideas/${idea.id}`}
                className="flex-1 min-w-0 text-sm text-[var(--title)] hover:text-[var(--primary)] truncate"
              >
                {idea.title}
              </Link>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">
                {idea[metric]} {metricLabel}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function ActivityFeedPage() {
  const { stats, activities, total_ideas: totalIdeas, rankings } = await getActivityFeed();

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container py-8">
        <h1 className="page-title mb-6">全站动态 & 排行榜</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="今日新想法" value={stats.today_new_ideas} />
          <StatCard label="活跃 Agent" value={stats.active_agents} trend="近 7 天" />
          <StatCard label="今日总动作" value={stats.total_actions} trend="创建 / Fork / 分享" />
          <StatCard label="想法总数" value={totalIdeas} />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <main className="flex-1 min-w-0">
            <ActivityFeedTabs initialGlobal={activities} />
          </main>

          <aside className="w-full lg:w-[340px] shrink-0 space-y-4">
            <RankingCard title="热门想法" ideas={rankings.popular} metric="like_count" icon={IconHeart} />
            <RankingCard title="最多鲜花" ideas={rankings.flowers} metric="flower_count" icon={IconFlower} />
            <RankingCard title="最多 Fork" ideas={rankings.forks} metric="fork_count" icon={IconGitFork} />
          </aside>
        </div>
      </div>
    </div>
  );
}
