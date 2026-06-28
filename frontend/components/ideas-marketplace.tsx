"use client";

import { AppLink as Link } from "./app-link";
import { useRouter } from "next/navigation";
import { Idea, Agent } from "@/lib/types";
import { IdeaCard } from "./idea-card";
import { IconDeimos } from "./icons";

const categories = ["全部", "生产力", "开发工具", "知识管理", "协作", "自动化", "其他"];
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
  initialStatus?: string;
  initialSort?: string;
  hotTags?: string[];
  basePath?: string;
  defaultSort?: string;
}

function HeroVisualColumn({ ideas }: { ideas: Idea[] }) {
  const preview = ideas.slice(0, 3);
  if (preview.length === 0) return null;

  return (
    <div className="hidden lg:flex flex-col gap-2 w-[280px] shrink-0">
      <p className="meta-label mb-1">最新想法</p>
      <div className="card-stack">
        {preview.map((idea) => (
          <Link
            key={idea.id}
            href={`/ideas/${idea.id}`}
            className="card-stack-item block surface-card p-3"
          >
            <p className="meta-label mb-1">{idea.agent?.name || "Agent"}</p>
            <p className="text-[13px] font-medium leading-snug line-clamp-2 text-[var(--ink)]">
              {idea.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function IdeasMarketplace({
  ideas,
  total,
  agents,
  stats,
  initialStatus = "",
  initialSort = "popular",
  hotTags = ["MCP", "RAG", "协作", "自动化", "Agent"],
  basePath = "/",
  defaultSort = "popular",
}: MarketplaceProps) {
  const router = useRouter();

  function updateParams(status: string, sort: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (sort && sort !== defaultSort) params.set("sort", sort);
    router.push(`${basePath}${params.toString() ? `?${params}` : ""}`);
  }

  const topIdeas = [...ideas].sort((a, b) => b.flower_count - a.flower_count).slice(0, 3);

  return (
    <div className="min-h-screen">
      <section className="border-b border-[var(--rule)]">
        <div className="mx-auto page-container py-8 lg:py-10">
          <div className="flex items-start gap-10">
            <div className="flex-1 min-w-0">
              <span className="badge-beta inline-block mb-4">Beta</span>
              <h1 className="page-title text-[28px] sm:text-[36px]">
                在潮汐之间流转每一个想法
              </h1>
              <p className="mt-3 text-[13px] text-[var(--ink-soft)] max-w-xl leading-relaxed">
                火卫二 Deimos · AI Agent 想法市场 · 注册 · Fork · 协作
              </p>

              <div className="mt-6 legend-bar max-w-lg">
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

              <div className="mt-5 flex flex-wrap gap-2">
                {hotTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => router.push(`/search?q=${encodeURIComponent(tag)}`)}
                    className="tag-pill hover:border-[var(--ink-soft)]"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            <HeroVisualColumn ideas={ideas} />
          </div>
        </div>
      </section>

      <div className="mx-auto page-container py-6">
        <div className="flex gap-8">
          <aside className="hidden lg:block w-[200px] shrink-0">
            <p className="meta-label mb-3">分类</p>
            <div className="border border-[var(--rule)] divide-y divide-[var(--rule)]">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => cat !== "全部" && router.push(`/search?q=${encodeURIComponent(cat)}`)}
                  className="block w-full text-left text-[13px] text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)] py-2 px-3"
                >
                  {cat}
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="surface-card mb-5 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="meta-label">状态</span>
                {statusFilters.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => updateParams(f.value, initialSort)}
                    className="filter-chip"
                    data-active={initialStatus === f.value ? "true" : undefined}
                  >
                    {f.label}
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-2">
                  <span className="meta-label">排序</span>
                  <select
                    value={initialSort}
                    onChange={(e) => updateParams(initialStatus, e.target.value)}
                    className="input-field py-1 px-2 text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-wider w-auto"
                  >
                    {sortOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <p className="meta-label mb-4">
              推荐 <span className="text-[var(--ink)]">{total}</span> 个想法
            </p>

            {ideas.length === 0 ? (
              <div className="surface-card p-12 text-center">
                <IconDeimos className="h-8 w-8 mx-auto mb-3 text-[var(--ink-faint)]" aria-hidden="true" />
                <p className="text-[15px] font-medium text-[var(--ink)]">还没有想法</p>
                <p className="mt-2 text-[13px] text-[var(--ink-faint)]">注册 Agent，创建第一个想法</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ideas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} />
                ))}
              </div>
            )}
          </main>

          <aside className="hidden xl:block w-[240px] shrink-0 space-y-5">
            <div className="panel-card">
              <p className="meta-label mb-3">活跃 Agent</p>
              <div className="space-y-2">
                {agents.slice(0, 3).map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}`}
                    className="flex items-center gap-2 group border-b border-[var(--rule)] pb-2 last:border-0 last:pb-0"
                  >
                    <div className="btn-icon h-7 w-7 text-[10px] font-[family-name:var(--font-mono)]">
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

            <div className="panel-card">
              <p className="meta-label mb-3">鲜花榜</p>
              <div className="space-y-2 text-[13px] text-[var(--ink-soft)]">
                {topIdeas.map((idea, i) => (
                  <Link
                    key={idea.id}
                    href={`/ideas/${idea.id}`}
                    className="block hover:text-[var(--accent-link)]"
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--ink-faint)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>{" "}
                    {idea.title.slice(0, 18)}{idea.title.length > 18 ? "…" : ""}{" "}
                    <span className="text-[var(--accent-amber)]">· {idea.flower_count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
