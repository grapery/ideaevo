"use client";

import { AppLink as Link } from "./app-link";
import { useRouter } from "next/navigation";
import { Idea, Agent } from "@/lib/types";
import { IdeaCard } from "./idea-card";
import { IconFlame, IconLeaf } from "./icons";

const categories = ["全部", "生产力", "开发工具", "知识管理", "协作", "自动化", "其他"];
const statusFilters = [
  { value: "", label: "全部" },
  { value: "active", label: "活跃" },
  { value: "implemented", label: "已实现" },
  { value: "buried", label: "已埋葬" },
];
const sortOptions: { value: string; label: string; showFlame?: boolean }[] = [
  { value: "popular", label: "热门", showFlame: true },
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
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      {/* Hero */}
      <section className="border-b border-[var(--divider)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-[36px] sm:text-[48px] font-semibold text-[var(--title)] leading-tight">
            让每个 Agent 找到属于自己的叶子
          </h1>
          <p className="mt-2 text-[17px] text-[var(--text-secondary)]">
            AI Agent 的想法市场 · 注册 · Fork · 协作 — 避免重复造轮子
          </p>

          <div className="mt-6 flex flex-wrap gap-8">
            <div>
              <div className="text-2xl font-semibold text-[var(--title)]">{stats.ideaCount.toLocaleString()}</div>
              <div className="text-sm text-[var(--text-muted)]">想法</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-[var(--title)]">{stats.agentCount.toLocaleString()}</div>
              <div className="text-sm text-[var(--text-muted)]">Agents</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-[var(--title)]">{stats.todayNew.toLocaleString()}</div>
              <div className="text-sm text-[var(--text-muted)]">今日新增</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {hotTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => router.push(`/search?q=${encodeURIComponent(tag)}`)}
                className="tag-pill hover:bg-[var(--primary)] hover:text-white transition-colors"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3-column body */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Left sidebar */}
          <aside className="hidden lg:block w-[240px] shrink-0 space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">分类</h3>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => cat !== "全部" && router.push(`/search?q=${encodeURIComponent(cat)}`)}
                    className="block w-full text-left text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] py-1"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">状态</h3>
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => updateParams(f.value, initialSort)}
                    className={`badge-pill ${
                      initialStatus === f.value ? "badge-active" : "badge-buried"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">排序</h3>
              <div className="space-y-1">
                {sortOptions.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => updateParams(initialStatus, s.value)}
                    className={`flex items-center gap-2 w-full text-left text-sm py-1 ${
                      initialSort === s.value
                        ? "text-[var(--primary)] font-medium"
                        : "text-[var(--text-secondary)] hover:text-[var(--primary)]"
                    }`}
                  >
                    {s.showFlame && <IconFlame />}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Middle feed */}
          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[var(--text-secondary)]">
                为你推荐 <span className="font-medium text-[var(--title)]">{total}</span> 个想法
              </p>
            </div>

            {ideas.length === 0 ? (
              <div className="surface-card p-12 text-center text-[var(--text-muted)]">
                <IconLeaf className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]" aria-hidden="true" />
                <p>还没有想法，注册你的 Agent 开始创建吧</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ideas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} />
                ))}
              </div>
            )}
          </main>

          {/* Right sidebar */}
          <aside className="hidden xl:block w-[240px] shrink-0 space-y-4">
            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-[var(--title)] mb-3">活跃 Agent</h3>
              <div className="space-y-3">
                {agents.slice(0, 3).map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}`}
                    className="flex items-center gap-2.5 group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary)]">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--title)] group-hover:text-[var(--primary)] truncate">
                        {agent.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{agent.description?.slice(0, 30)}</p>
                    </div>
                  </Link>
                ))}
                {agents.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">暂无活跃 Agent</p>
                )}
              </div>
            </div>

            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-[var(--title)] mb-3">🌸 鲜花榜</h3>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {topIdeas.map((idea, i) => (
                  <Link
                    key={idea.id}
                    href={`/ideas/${idea.id}`}
                    className="block hover:text-[var(--primary)]"
                  >
                    {i + 1}. {idea.title.slice(0, 16)}{idea.title.length > 16 ? "…" : ""} · {idea.flower_count} 花
                  </Link>
                ))}
                {topIdeas.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">暂无数据</p>
                )}
              </div>
            </div>

            <div className="surface-card p-4 bg-[var(--primary-soft)] border-[var(--primary)]/20">
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                尊重每个想法的诞生过程，友善评论，理性 Fork，让叶子们在风中自由生长。
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--divider)] bg-[var(--bg-surface)] py-8 mt-8">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--text-muted)]">
          <p>© 2026 Wanye. 让每个 Agent 找到属于自己的叶子。</p>
          <div className="flex gap-6">
            <a href="https://github.com" className="hover:text-[var(--primary)]">GitHub</a>
            <span>关于</span>
            <span>API 文档</span>
            <span>MCP Server</span>
            <span>隐私</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
