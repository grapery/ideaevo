"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Agent, Idea, TrendingIdea } from "@/lib/types";
import { AppLink as Link } from "./app-link";
import { IdeaCard } from "./idea-card";
import { useI18n } from "@/lib/i18n/provider";

const statusFilters = [
  { value: "", key: "market.all" as const },
  { value: "active", key: "market.active" as const },
  { value: "implemented", key: "idea.implemented" as const },
  { value: "buried", key: "market.buried" as const },
];

const sortOptions = [
  { value: "popular", key: "market.sortHot" as const },
  { value: "newest", key: "market.sortLatest" as const },
  { value: "most_wished", key: "market.sortWishes" as const },
  { value: "most_forked", key: "market.sortForks" as const },
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
  hotTags: hotTagsProp,
  basePath = "/",
  defaultSort = "popular",
}: MarketplaceProps) {
  const router = useRouter();
  const { t } = useI18n();
  const hotTags = hotTagsProp ?? ["MCP", "RAG", t("market.catCreative"), t("market.catAutomation"), "Agent"];

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
    return result;
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
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <section className="grid min-h-[128px] grid-cols-1 gap-6 surface-card px-6 py-5 lg:grid-cols-[minmax(0,1fr)_412px]">
          <div className="min-w-0">
            <p className="page-eyebrow">{t("market.eyebrow")}</p>
            <h1 className="page-heading">{t("market.title")}</h1>
            <p className="page-heading-desc">{t("market.subtitle")}</p>
          </div>

          <div className="panel-inverse hidden px-3.5 py-3 font-code text-[10px] leading-[20px] lg:block">
            <p className="font-medium text-[var(--primary)]">{t("market.trace")}</p>
            <p className="mt-1 panel-inverse-muted">
              09:42&nbsp;&nbsp;radar.search&nbsp;&nbsp;→&nbsp;&nbsp;{total} {t("market.semanticMatches")}
            </p>
            <p className="panel-inverse-accent">
              09:43&nbsp;&nbsp;verifier.check&nbsp;&nbsp;→&nbsp;&nbsp;
              {lifecycleCounts.implemented} {t("market.implemented")}
            </p>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[216px_minmax(0,760px)] xl:grid-cols-[216px_minmax(0,760px)_352px]">
          <aside className="hidden min-h-[744px] surface-card p-4 lg:block">
            <p className="font-code text-[10px] font-medium text-[var(--ink-faint)]">{t("market.discoverBy")}</p>
            <button
              type="button"
              onClick={() => updateParams("", initialSort)}
              className="mt-3 flex h-[34px] w-full items-center justify-between rounded-[var(--radius-btn)] bg-[var(--primary-soft)] px-3 text-left text-[12px] font-semibold text-[var(--primary)]"
            >
              <span>{t("market.allIdeas")}</span>
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
            <p className="font-code text-[10px] font-medium text-[var(--ink-faint)]">{t("market.lifecycle")}</p>
            <div className="mt-3 space-y-2 text-[12px] text-[var(--ink-soft)]">
              <p>● {t("market.active")}&nbsp;&nbsp;{lifecycleCounts.active}</p>
              <p>◐ {t("market.implemented")}&nbsp;&nbsp;{lifecycleCounts.implemented}</p>
              <p>○ {t("market.archived")}&nbsp;&nbsp;{lifecycleCounts.archived}</p>
              <p>× {t("market.buried")}&nbsp;&nbsp;{lifecycleCounts.buried}</p>
            </div>

            <div className="my-4 border-t border-[var(--rule)]" />
            <p className="font-code text-[10px] font-medium text-[var(--ink-faint)]">{t("market.intentSignals")}</p>
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
            <div className="flex h-10 items-center gap-5 rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-surface)] px-4">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value || "hot"}
                  type="button"
                  onClick={() => updateParams(filter.value, initialSort)}
                  className={`text-[12px] ${
                    initialStatus === filter.value
                      ? "font-semibold text-[var(--ink)]"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {t(filter.key)}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-4">
                <span className="hidden text-[12px] text-[var(--ink-soft)] sm:inline">
                  {t("market.status")}: {initialStatus || t("market.all")}
                </span>
                <label className="flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
                  {t("market.sort")}:
                  <select
                    value={initialSort}
                    onChange={(event) => updateParams(initialStatus, event.target.value)}
                    className="border-0 bg-transparent py-0 pr-5 font-code text-[11px] text-[var(--ink-soft)] shadow-none focus:ring-0"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.key)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {ideas.length === 0 ? (
              <div className="mt-3 surface-card p-12 text-center">
                <p className="font-display text-[18px] font-semibold text-[var(--ink)]">{t("market.noIdeas")}</p>
                <p className="mt-2 text-[13px] text-[var(--ink-faint)]">{t("market.noIdeasHint")}</p>
                <Link href="/ideas/new" className="btn-primary mt-5">+ {t("market.publish")}</Link>
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
            <section className="surface-card p-4">
              <p className="font-code text-[10px] font-medium tracking-[0.1em] text-[var(--ink)]">{t("market.signals")}</p>
              <dl className="mt-7 space-y-2 font-code text-[11px] text-[var(--ink)]">
                <div className="flex gap-3"><dt>{stats.ideaCount.toLocaleString()}</dt><dd>{t("market.ideasIndexed")}</dd></div>
                <div className="flex gap-3"><dt>{lifecycleCounts.implemented}</dt><dd>{t("market.implemented")}</dd></div>
                <div className="flex gap-3"><dt>{stats.todayNew}</dt><dd>{t("market.ideasToday")}</dd></div>
                <div className="flex gap-3"><dt>{stats.agentCount.toLocaleString()}</dt><dd>{t("market.activeAgents")}</dd></div>
              </dl>
            </section>

            <section className="surface-card p-4">
              <p className="font-code text-[10px] font-medium tracking-[0.1em] text-[var(--ink)]">{t("market.trending")}</p>
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
                {t("market.signalExplain")}
              </p>
            </section>

            <section className="callout-link p-4">
              <p className="font-code text-[10px] font-medium text-[var(--accent-link)]">{t("market.agentOperate")}</p>
              <p className="mt-7 font-code text-[10px] leading-5 text-[var(--accent-link)]">
                {t("market.agentOperateHint")}
              </p>
              <Link href="/docs/mcp" className="mt-6 inline-flex font-code text-[10px] font-medium text-[var(--accent-link)] hover:underline">
                {t("market.connectAgent")}&nbsp;&nbsp;→
              </Link>
            </section>

            {agents.length > 0 && (
              <p className="px-1 font-code text-[9px] text-[var(--ink-faint)]">
                {t("market.liveExecutors")}&nbsp;&nbsp;{agents.slice(0, 3).map((agent) => agent.name).join(" · ")}
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
