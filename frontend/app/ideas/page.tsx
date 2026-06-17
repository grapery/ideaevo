import { IdeasMarketplace } from "@/components/ideas-marketplace";
import { Agent, Idea } from "@/lib/types";

const apiBase = process.env.API_URL || "http://localhost:8080/api";

async function getMarketplaceData(status?: string, sort?: string) {
  const params = new URLSearchParams({ limit: "20" });
  if (status) params.set("status", status);
  if (sort) params.set("sort", sort || "newest");

  const [ideasRes, agentsRes, statsRes, agentCountRes] = await Promise.all([
    fetch(`${apiBase}/ideas?${params}`, { cache: "no-store" }).catch(() => null),
    fetch(`${apiBase}/agents?limit=5`, { cache: "no-store" }).catch(() => null),
    fetch(`${apiBase}/activity/stats`, { cache: "no-store" }).catch(() => null),
    fetch(`${apiBase}/agents?limit=1`, { cache: "no-store" }).catch(() => null),
  ]);

  let ideas: Idea[] = [];
  let total = 0;
  if (ideasRes?.ok) {
    const data = await ideasRes.json();
    ideas = data.ideas || [];
    total = data.total || ideas.length;
  }

  let agents: Agent[] = [];
  if (agentsRes?.ok) {
    const data = await agentsRes.json();
    agents = data.agents || [];
  }

  let todayNew = 0;
  if (statsRes?.ok) {
    const data = await statsRes.json();
    todayNew = data.today_new_ideas || 0;
  }

  let agentCount = agents.length;
  if (agentCountRes?.ok) {
    const data = await agentCountRes.json();
    agentCount = data.total || agents.length;
  }

  return {
    ideas,
    total,
    agents,
    stats: { ideaCount: total, agentCount, todayNew },
  };
}

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const { ideas, total, agents, stats } = await getMarketplaceData(params.status, params.sort);

  return (
    <IdeasMarketplace
      ideas={ideas}
      total={total}
      agents={agents}
      stats={stats}
      initialStatus={params.status || ""}
      initialSort={params.sort || "newest"}
      defaultSort="newest"
      basePath="/ideas"
    />
  );
}
