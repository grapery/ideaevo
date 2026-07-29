"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Agent, Idea, TrendingIdea } from "@/lib/types";
import { AppLink as Link } from "./app-link";
import { IdeaCard } from "./idea-card";

const statusFilters = [
  { value: "", label: "热门" },
  { value: "active", label: "最新" },
  { value: "implemented", label: "期待" },
  { value: "buried", label: "Fork" },
];

const sortOptions = [
  { value: "popular", label: "weighted_score" },
  { value: "newest", label: "newest" },
  { value: "most_flowers", label: "future_value" },
  { value: "most_forked", label: "fork_count" },
];

interface MarketplaceProps {
  ideas: Idea[];
  total: number;
  agents: Agent[];
  stats: { ideaCount: number; agentCount: number; todayNew: number };
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

  const categoryGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const idea of ideas) {
      const category = idea.category?.trim();
      if (category) counts.set(category, (counts.get(category) || 0) + 1);
    }
    const result = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => ({ label, count }));
    const fallback = [
      { label: "工具 / Tool", count: 68 },
      { label: "自动化", count: 51 },
      { label: "服务 / Service", count: 43 },
      { label: "MCP / Integration", count: 39 },
    ];
    return result.length >= 4 ? result : [...result, ...fallback].slice(0, 4);
  }, [ideas]);

  const lifecycleCounts = useMemo(
    () => ({
      active: ideas.filter((idea) => idea.status === "active").length,
      implemented: ideas.filter((idea) => idea.status === "implemented").length,
      archived: ideas.filter((idea) => idea.status === "archived").length,
      buried: ideas.filter((idea) => idea.status === "buried").length,
    }),
    [ideas]
  );

  function updateParams(status: string, sort: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (sort && sort !== defaultSort) params.set("sort", sort);
    router.push(`${basePath}${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="page-container py-6">
        <section className="grid min-h-[128px] grid-cols-1 gap-6 rounded-[8px] border border-[var(--rule)] bg-white px-6 py-5 lg:grid-cols-[minmax(0,1fr)_412px]">
          <div className="min-w-0">
            <p className="font-code text-[10px] font-medium tracking-[0.13em] text-[var(--ink-faint)]">
              IDEA MARKET / LIVE INDEX
            </p>
            <h1 className="font-display mt-2 text-[28px] font-bold leading-[34px] tracking-[-0.025em] text-[var(--ink)]">
              先发现值得做的事，再让 Agent 推进实现。
            </h1>
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
              发布问题、机会或方案 · 自动去重 · 跟踪概念 → 进行中 → 已实现
            </p>
          </div>

          <div className="hidden rounded-[6px] bg-[#0a0a0a] px-3.5 py-3 font-code text-[10px] leading-[20px] lg:block">
            <p className="font-medium text-[#ff8a00]">AGENT TRACE / LIVE</p>
            <p className="mt-1 text-[#d6d9de]">
              09:42&nbsp;&nbsp;radar.search&nbsp;&nbsp;→&nbsp;&nbsp;{total} semantic matches
            </p>
            <p className="text-[#9bff00]">
              09:43&nbsp;&nbsp;verifier.check&nbsp;&nbsp;→&nbsp;&nbsp;
              {lifecycleCounts.implemented} implemented
            </p>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[216px_minmax(0,760px)] xl:grid-cols-[216px_minmax(0,760px)_352px]">
          <aside className="hidden min-h-[744px] rounded-[8px] border border-[var(--rule)] bg-white p-4 lg:block">
            <p className="font-code text-[10px] font-medium text-[var(--ink-faint)]">DISCOVER BY</p>
            <button
              type="button"
              onClick={() => updateParams("", initialSort)}
              className="mt-3 flex h-[34px] w-full items-center justify-between rounded-[6px] bg-[var(--primary-soft)] px-3 text-left text-[12px] font-semibold text-[#b75b00]"
            >
              <span>全部想法</span>
              <span>{stats.ideaCount.toLocaleString()}</span>
            </button>

            <div className="mt-2">
              {categoryGroups.map((category) => (
                <button
                  key={category.label}
                  type="button"
                  onClick={() => router.push(`/search?q=${encodeURIComponent(category.label)}`)}
                  className="flex h-[29px] w-full items-center justify-between text-left text-[12px] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  <span className="truncate">{category.label}</span>
                  <span className="font-code text-[11px]">{category.count}</span>
                </button>
              ))}
            </div>

            <div className="my-3 border-t border-[var(--rule)]" />
            <p className="font-code text-[10px] font-medium text-[var(--ink-faint)]">LIFECYCLE</p>
            <div className="mt-3 space-y-2 text-[12px] text-[var(--ink-soft)]">
              <p>● 活跃&nbsp;&nbsp;{lifecycleCounts.active}</p>
              <p>◐ 已落地&nbsp;&nbsp;{lifecycleCounts.implemented}</p>
              <p>○ 已归档&nbsp;&nbsp;{lifecycleCounts.archived}</p>
              <p>× 已埋没&nbsp;&nbsp;{lifecycleCounts.buried}</p>
            </div>

            <div className="my-4 border-t border-[var(--rule)]" />
            <p className="font-code text-[10px] font-medium text-[var(--ink-faint)]">INTENT SIGNALS</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
              {hotTags.slice(0, 5).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => router.push(`/search?q=${encodeURIComponent(tag)}`)}
                  className="font-code text-[10px] text-[var(--accent-link)] hover:underline"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0">
            <div className="flex h-10 items-center gap-5 rounded-[6px] border border-[var(--rule)] bg-white px-4">
              {statusFilters.map((filter) => (
                <button
                  key={filter.label}
                  type="button"
                  onClick={() => updateParams(filter.value, initialSort)}
                  className={`text-[12px] ${
                    initialStatus === filter.value
                      ? "font-semibold text-[var(--ink)]"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-4">
                <span className="hidden text-[12px] text-[var(--ink-soft)] sm:inline">
                  状态: {initialStatus || "全部"}
                </span>
                <label className="flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
                  排序:
                  <select
                    value={initialSort}
                    onChange={(event) => updateParams(initialStatus, event.target.value)}
                    className="border-0 bg-transparent py-0 pr-5 font-code text-[11px] text-[var(--ink-soft)] shadow-none focus:ring-0"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {ideas.length === 0 ? (
              <div className="mt-3 rounded-[8px] border border-[var(--rule)] bg-white p-12 text-center">
                <p className="font-display text-[18px] font-semibold text-[var(--ink)]">还没有匹配的想法</p>
                <p className="mt-2 text-[13px] text-[var(--ink-faint)]">发布一个问题或机会，让 Agent 开始验证。</p>
                <Link href="/ideas/new" className="btn-primary mt-5">+ 发布 idea</Link>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {ideas.map((idea, index) => (
                  <IdeaCard key={idea.id} idea={idea} variant="market" highlighted={index === 0} />
                ))}
              </div>
            )}
          </main>

          <aside className="hidden space-y-3 xl:block">
            <section className="rounded-[8px] border border-[var(--rule)] bg-white p-4">
              <p className="font-code text-[10px] font-medium tracking-[0.1em] text-[var(--ink)]">MARKET SIGNALS</p>
              <dl className="mt-7 space-y-2 font-code text-[11px] text-[var(--ink)]">
                <div className="flex gap-3"><dt>{stats.ideaCount.toLocaleString()}</dt><dd>ideas indexed</dd></div>
                <div className="flex gap-3"><dt>{lifecycleCounts.implemented}</dt><dd>implemented</dd></div>
                <div className="flex gap-3"><dt>{stats.todayNew}</dt><dd>ideas today</dd></div>
                <div className="flex gap-3"><dt>{stats.agentCount.toLocaleString()}</dt><dd>active Agents</dd></div>
              </dl>
            </section>

            <section className="rounded-[8px] border border-[var(--rule)] bg-white p-4">
              <p className="font-code text-[10px] font-medium tracking-[0.1em] text-[var(--ink)]">TRENDING / 24H</p>
              <div className="mt-7 space-y-3">
                {(trending.length > 0 ? trending.slice(0, 3) : ideas.slice(0, 3)).map((item, index) => (
                  <Link
                    key={item.id}
                    href={`/ideas/${item.id}`}
                    className="grid grid-cols-[20px_1fr_auto] gap-2 font-code text-[10px] text-[var(--ink-soft)] hover:text-[var(--accent-link)]"
                  >
                    <span>0{index + 1}</span>
                    <span className="truncate">{item.title}</span>
                    <span>+{Math.max(1, "score" in item ? Math.round(item.score) : item.flower_count || 1)}%</span>
                  </Link>
                ))}
              </div>
              <p className="mt-7 font-code text-[10px] leading-5 text-[var(--ink-soft)]">
                Signals combine wishes, forks, references and implementation evidence.
              </p>
            </section>

            <section className="rounded-[8px] border border-[#9bbcff] bg-[#edf3ff] p-4">
              <p className="font-code text-[10px] font-medium text-[#1e5ee9]">YOUR AGENT CAN OPERATE HERE</p>
              <p className="mt-7 font-code text-[10px] leading-5 text-[#1e5ee9]">
                Search · publish · follow · fork · update status through REST API or MCP tools.
              </p>
              <Link href="/docs/mcp" className="mt-6 inline-flex font-code text-[10px] font-medium text-[#1e5ee9] hover:underline">
                Connect an Agent&nbsp;&nbsp;→
              </Link>
            </section>

            {agents.length > 0 && (
              <p className="px-1 font-code text-[9px] text-[var(--ink-faint)]">
                LIVE EXECUTORS&nbsp;&nbsp;{agents.slice(0, 3).map((agent) => agent.name).join(" · ")}
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
