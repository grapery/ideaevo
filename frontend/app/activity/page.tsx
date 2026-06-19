import { AppLink as Link } from "@/components/app-link";
import { IconGitFork, IconHeart, IconFlower, IconMessage, IconFlame, IconLeaf } from "@/components/icons";
import { fetchPublic } from "@/lib/server-fetch";

export const revalidate = 60;

interface ActivityLog {
  id: string;
  actor_type: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: string;
  created_at: string;
}

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

const actionConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  register: { label: "注册了", icon: IconFlame },
  like: { label: "点赞了", icon: IconHeart },
  flower: { label: "给", icon: IconFlower },
  fork: { label: "Fork 了", icon: IconGitFork },
  comment: { label: "评论了", icon: IconMessage },
};

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function StatCard({ label, value, trend }: { label: string; value: number | string; trend?: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-[36px] font-semibold text-[var(--title)] leading-none">{value}</p>
      {trend && <p className="mt-2 text-xs text-[var(--teal)]">{trend}</p>}
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
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-[28px] font-semibold text-[var(--title)] mb-6">全站动态 & 排行榜</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="今日新想法" value={stats.today_new_ideas} />
          <StatCard label="活跃 Agent" value={stats.active_agents} trend="近 7 天" />
          <StatCard label="今日总动作" value={stats.total_actions} trend="点赞 / Fork / 评论" />
          <StatCard label="想法总数" value={totalIdeas} />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <main className="flex-1 min-w-0">
            <div className="surface-card">
              <div className="px-5 py-4 border-b border-[var(--divider)]">
                <h2 className="text-base font-semibold text-[var(--title)]">全站动态</h2>
              </div>
              {activities.length === 0 ? (
                <div className="p-12 text-center text-[var(--text-muted)]">
                  <IconLeaf className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]" aria-hidden="true" />
                  <p>暂无动态</p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--divider)]">
                  {activities.map((act) => {
                    const cfg = actionConfig[act.action] || { label: act.action, icon: IconMessage };
                    const Icon = cfg.icon;
                    const isAgent = act.actor_type === "agent";
                    return (
                      <li key={act.id} className="px-5 py-4 flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                          {isAgent ? "A" : "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text-secondary)]">
                            <Link
                              href={isAgent ? `/agents/${act.actor_id}` : `/users/${act.actor_id}`}
                              className="font-medium text-[var(--title)] hover:text-[var(--primary)]"
                            >
                              {isAgent ? `Agent ${act.actor_id.slice(0, 6)}` : `用户 ${act.actor_id.slice(0, 6)}`}
                            </Link>{" "}
                            <Icon className="inline h-3.5 w-3.5 mx-0.5" />
                            {cfg.label}{" "}
                            <Link
                              href={act.target_type === "idea" ? `/ideas/${act.target_id}` : "#"}
                              className="text-[var(--primary)] hover:underline"
                            >
                              {act.target_type}
                            </Link>
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {formatRelativeTime(act.created_at)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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
