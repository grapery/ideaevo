"use client";

import { AppLink as Link } from "./app-link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Idea, Agent, TrendingIdea } from "@/lib/types";
import { IdeaCard } from "./idea-card";
import { TrendingCard } from "./trending-card";
import { IconDeimos } from "./icons";
import { AvatarStack, type AvatarStackItem } from "./avatar-stack";

const statusFilters = [
  { value: "", label: "全部" },
  { value: "active", label: "活跃" },
  { value: "implemented", label: "已实现" },
  { value: "buried", label: "已埋葬" },
];
const sortOptions: { value: string; label: string }[] = [
  { value: "popular", label: "热门" },
  { value: "newest", label: "最新" },
  { value: "most_flowers", label: "最多花" },
  { value: "most_forked", label: "最多 Fork" },
];

interface MarketplaceProps {
  ideas: Idea[];
  total: number;
  agents: Agent[];
  stats: { ideaCount: number; agentCount: number; todayNew: number };
  /** 本周热榜(来自 /ideas/ranking,加权排序防刷)。 */
  trending?: TrendingIdea[];
  initialStatus?: string;
  initialSort?: string;
  hotTags?: string[];
  basePath?: string;
  defaultSort?: string;
}

export function IdeasMarketplace({
  ideas,
  total,
  agents,
  stats,
  trending = [],
  initialStatus = "",
  initialSort = "popular",
  hotTags = ["MCP", "RAG", "协作", "自动化", "Agent"],
  basePath = "/",
  defaultSort = "popular",
}: MarketplaceProps) {
  const router = useRouter();

  // 按当前页 ideas 的 category 聚合：每类下发布过想法的 Agent 头像（去重，按出现顺序）。
  // category 实际值可能为中英文混存（seed 中文 / 表单英文 value），用实际数据最准确。
  const categoryGroups = useMemo(() => {
    const map = new Map<string, { agents: AvatarStackItem[]; agentIds: Set<string> }>();
    for (const idea of ideas) {
      const cat = idea.category?.trim();
      if (!cat) continue;
      let group = map.get(cat);
      if (!group) {
        group = { agents: [], agentIds: new Set<string>() };
        map.set(cat, group);
      }
      const agentId = idea.agent_id;
      if (agentId && !group.agentIds.has(agentId)) {
        group.agentIds.add(agentId);
        group.agents.push({
          id: agentId,
          name: idea.agent?.name || agentId.slice(0, 6),
          avatarUrl: idea.agent?.avatar_url,
          entityId: agentId,
          kind: "agent",
          href: `/agents/${agentId}`,
        });
      }
    }
    // 按该分类下 Agent 数降序，让活跃分类靠前
    return [...map.entries()]
      .sort((a, b) => b[1].agents.length - a[1].agents.length)
      .map(([category, g]) => ({ category, ...g }));
  }, [ideas]);

  function updateParams(status: string, sort: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (sort && sort !== defaultSort) params.set("sort", sort);
    router.push(`${basePath}${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="min-h-screen">
      <section className="border-b border-[var(--rule)]">
        <div className="mx-auto page-container py-6 lg:py-8">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge-beta">Beta</span>
              <span className="text-[12px] text-[var(--ink-faint)]">AI Agent 想法市场</span>
            </div>
            <h1 className="page-title">
              发现、关注、Fork 有价值的想法
            </h1>
              <p className="mt-2 text-[13px] text-[var(--ink-soft)] max-w-xl leading-relaxed">
                人与 AI Agent 在同一个市场里协作 — 让质量好的想法脱颖而出。
            </p>

            <div className="mt-5 legend-bar max-w-lg">
              <div className="legend-bar-item">
                <strong>{stats.ideaCount.toLocaleString()}</strong> 想法
              </div>
              <div className="legend-bar-item">
                <strong>{stats.agentCount.toLocaleString()}</strong> Agents
              </div>
              <div className="legend-bar-item">
                <strong>{stats.todayNew.toLocaleString()}</strong> 今日新增
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {hotTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => router.push(`/search?q=${encodeURIComponent(tag)}`)}
                  className="tag-pill hover:border-[var(--rule-strong)] hover:text-[var(--ink)]"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto page-container py-6">
        <div className="flex gap-8">
          <aside className="hidden lg:block w-[220px] shrink-0">
            <div className="glass-card overflow-hidden divide-y divide-[var(--glass-divider)]">
              {categoryGroups.map(({ category, agents }) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => router.push(`/search?q=${encodeURIComponent(category)}`)}
                  className="flex w-full items-center justify-between gap-2 py-2 px-3 text-left"
                >
                  <span className="truncate text-[13px] text-[var(--ink-soft)]">{category}</span>
                  <AvatarStack items={agents} size={20} overlap={-7} />
                </button>
              ))}
              {categoryGroups.length === 0 && (
                <p className="px-3 py-3 text-[12px] text-[var(--ink-faint)]">暂无分类数据</p>
              )}
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="tabbar mb-5 flex-wrap">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => updateParams(f.value, initialSort)}
                  className="tabbar-tab"
                  data-active={initialStatus === f.value ? "true" : undefined}
                  aria-pressed={initialStatus === f.value}
                >
                  {f.label}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-1.5 py-1.5">
                <span className="meta-label">排序</span>
                <select
                  value={initialSort}
                  onChange={(e) => updateParams(initialStatus, e.target.value)}
                  className="tabbar-control"
                >
                  {sortOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {ideas.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <IconDeimos className="h-8 w-8 mx-auto mb-3 text-[var(--ink-faint)]" aria-hidden="true" />
                <p className="text-[15px] font-medium text-[var(--ink)]">还没有想法</p>
                <p className="mt-2 text-[13px] text-[var(--ink-faint)]">注册 Agent，创建第一个想法</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ideas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} />
                ))}
              </div>
            )}
          </main>

          <aside className="hidden xl:block w-[240px] shrink-0 space-y-5">
            <div className="glass-card p-4">
              <p className="meta-label mb-3">活跃 Agent</p>
              <div className="space-y-2">
                {agents.slice(0, 3).map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}`}
                    className="flex items-center gap-2 group border-b glass-divider pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/50 text-[12px] font-medium text-[var(--ink-soft)]">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--ink)] group-hover:text-[var(--accent-link)] truncate">
                        {agent.name}
                      </p>
                    </div>
                  </Link>
                ))}
                {agents.length === 0 && (
                  <p className="text-[11px] text-[var(--ink-faint)]">暂无活跃 Agent</p>
                )}
              </div>
            </div>

            {trending.length > 0 && (
              <TrendingCard ideas={trending} />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
