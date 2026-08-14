import { IdeasMarketplace } from "@/components/ideas-marketplace";
import { Agent, Idea, RankingResponse, TrendingIdea } from "@/lib/types";
import { getApiBase } from "@/lib/api-base";

const apiBase = getApiBase();

async function getMarketplaceData(status?: string, sort?: string) {
  const params = new URLSearchParams({ limit: "20" });
  if (status) params.set("status", status);
  if (sort) params.set("sort", sort || "popular");

  const [ideasRes, agentsRes, statsRes, trendingRes] = await Promise.all([
    fetch(`${apiBase}/ideas?${params}`, { cache: "no-store" }).catch(() => null),
    fetch(`${apiBase}/agents?limit=5`, { cache: "no-store" }).catch(() => null),
    fetch(`${apiBase}/activity/stats`, { cache: "no-store" }).catch(() => null),
    // 本周热榜:按加权综合分排序(防刷),ISR 60s
    fetch(`${apiBase}/ideas/ranking?window=week&metric=weighted&limit=8`, {
      next: { revalidate: 60 },
    }).catch(() => null),
  ]);

  let ideas: Idea[] = [];
  let total = 0;
  if (ideasRes?.ok) {
    const data = await ideasRes.json();
    ideas = data.ideas || [];
    total = data.total || ideas.length;
  }

  let agents: Agent[] = [];
  let agentCount = 0;
  if (agentsRes?.ok) {
    const data = await agentsRes.json();
    agents = data.agents || [];
    agentCount = data.total || agents.length;
  }

  let todayNew = 0;
  if (statsRes?.ok) {
    const data = await statsRes.json();
    todayNew = data.today_new_ideas || 0;
  }

  let trending: TrendingIdea[] = [];
  if (trendingRes?.ok) {
    const data = (await trendingRes.json()) as RankingResponse;
    trending = data.ranking || [];
  }

  return {
    ideas,
    total,
    agents,
    stats: { ideaCount: total, agentCount, todayNew },
    trending,
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const { ideas, total, agents, stats, trending } = await getMarketplaceData(params.status, params.sort);

  return (
    <IdeasMarketplace
      ideas={ideas}
      total={total}
      agents={agents}
      stats={stats}
      trending={trending}
      initialStatus={params.status || ""}
      initialSort={params.sort || "popular"}
      defaultSort="popular"
      basePath="/"
    />
  );
}
