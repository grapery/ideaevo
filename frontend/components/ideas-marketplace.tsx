"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Agent, Idea, TrendingIdea } from "@/lib/types";
import { AppLink as Link } from "./app-link";
import { IdeaCard } from "./idea-card";
import { DeimosIcon } from "./deimos-icon";
import { SystemPageHeader } from "./system-page-header";
import { useI18n } from "@/lib/i18n/provider";

const statusFilters = [
  { value: "", key: "market.all" as const },
  { value: "active", key: "market.active" as const },
  { value: "implemented", key: "idea.implemented" as const },
  { value: "buried", key: "market.buried" as const },
];

const sortOptions = [
  { value: "weighted", key: "market.sortTrending" as const },
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
  const hotTags = hotTagsProp ?? ["MCP", "RAG", t("market.catCreative"), t("market.catAutomation"), t("activity.agent")];

  const categoryGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const idea of ideas) {
      const category = idea.category?.trim();
      if (category) counts.set(category, (counts.get(category) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => ({ label, count }));
  }, [ideas]);

  const lifecycleCounts = useMemo(
    () => ({
      active: ideas.filter((idea) => idea.status === "active").length,
      implemented: ideas.filter((idea) => idea.status === "implemented").length,
      archived: ideas.filter((idea) => idea.status === "archived").length,
      buried: ideas.filter((idea) => idea.status === "buried").length,
    }),
    [ideas],
  );

  function updateParams(status: string, sort: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (sort && sort !== defaultSort) params.set("sort", sort);
    router.push(`${basePath}${params.toString() ? `?${params}` : ""}`);
  }

  // 生命周期筛选:桌面侧栏与移动端折叠面板共用,避免两份拷贝漂移
  const lifecycleList = (
    <div className="space-y-1 text-[12px]">
      {([
        { status: "active", label: t("market.active"), count: lifecycleCounts.active },
        { status: "implemented", label: t("market.implemented"), count: lifecycleCounts.implemented },
        { status: "archived", label: t("market.archived"), count: lifecycleCounts.archived },
        { status: "buried", label: t("market.buried"), count: lifecycleCounts.buried },
      ] as const).map((item) => {
        const active = initialStatus === item.status;
        return (
          <button
            key={item.status}
            type="button"
            onClick={() => updateParams(item.status, initialSort)}
            className={`flex h-8 w-full items-center justify-between rounded-[var(--radius-btn)] px-2.5 text-left ${
              active
                ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
                : "text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
            }`}
          >
            <span>{item.label}</span>
            <span className="font-mono tabular-nums text-[var(--ink-faint)]">
              {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );

  const metrics = [
    {
      label: t("market.ideasIndexed"),
      value: stats.ideaCount,
      icon: "document" as const,
      // 当前页本身即是全量列表,不再自链接
      href: undefined as string | undefined,
    },
    {
      label: t("market.ideasToday"),
      value: stats.todayNew,
      icon: "pulse" as const,
      href: "/activity",
      tone: stats.todayNew > 0 ? ("attention" as const) : undefined,
    },
    {
      label: t("market.implemented"),
      value: lifecycleCounts.implemented,
      icon: "lifecycle" as const,
      href: `${basePath}?status=implemented`,
      tone: "link" as const,
    },
    {
      label: t("market.activeAgents"),
      value: stats.agentCount,
      icon: "agent" as const,
      href: "/agents",
    },
  ];

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        {basePath === "/" ? (
          <section className="pb-1 pt-8 text-center sm:pt-12">
            <h1 className="font-display text-3xl sm:text-[36px] font-bold leading-tight tracking-tight text-[var(--ink)]">
              {t("market.title")}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-soft)] sm:text-[16px]">
              {t("market.subtitle")}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <Link href="/ideas/new" className="btn-primary btn-sm">
                <DeimosIcon name="publish" className="h-3.5 w-3.5" />
                {t("market.publish")}
              </Link>
              <Link href="/search" className="btn-outline btn-sm">
                <DeimosIcon name="semantic-search" className="h-3.5 w-3.5" />
                {t("dashboard.searchEvidence")}
              </Link>
            </div>
          </section>
        ) : (
          <SystemPageHeader
            title={t("market.title")}
            description={t("market.subtitle")}
            actions={
              <>
                <Link href="/ideas/new" className="btn-primary btn-sm">
                  <DeimosIcon name="publish" className="h-3.5 w-3.5" />
                  {t("market.publish")}
                </Link>
                <Link href="/search" className="btn-outline btn-sm">
                  <DeimosIcon name="semantic-search" className="h-3.5 w-3.5" />
                  {t("dashboard.searchEvidence")}
                </Link>
              </>
            }
          />
        )}

        <section className="dashboard-metrics mt-6" aria-label={t("market.signals")}>
          {metrics.map((metric) =>
            metric.href ? (
              <Link key={metric.label} href={metric.href} className="dashboard-metric">
                <span className="dashboard-metric__icon" data-tone={metric.tone} aria-hidden>
                  <DeimosIcon name={metric.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="dashboard-metric__body">
                  <span className="dashboard-metric__label">{metric.label}</span>
                  <span
                    className="dashboard-metric__value"
                    data-tone={metric.tone === "attention" ? "attention" : undefined}
                  >
                    {metric.value.toLocaleString()}
                  </span>
                </span>
                <DeimosIcon name="chevron-right" className="dashboard-metric__chevron" />
              </Link>
            ) : (
              <div key={metric.label} className="dashboard-metric">
                <span className="dashboard-metric__icon" aria-hidden>
                  <DeimosIcon name={metric.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="dashboard-metric__body">
                  <span className="dashboard-metric__label">{metric.label}</span>
                  <span className="dashboard-metric__value">
                    {metric.value.toLocaleString()}
                  </span>
                </span>
              </div>
            ),
          )}
        </section>

        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_280px]">
          {/* 移动端可折叠筛选:分类 + 热门标签(桌面端走左侧栏,此处隐藏) */}
          <details className="surface-card lg:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-between px-3.5 text-[13px] font-semibold text-[var(--ink)]">
              <span className="inline-flex items-center gap-1.5">
                <DeimosIcon name="radar" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
                {t("market.discoverBy")}
              </span>
              <DeimosIcon name="chevron-right" className="h-3.5 w-3.5 text-[var(--ink-faint)]" />
            </summary>
            <div className="border-t border-[var(--rule)] p-2">
              {categoryGroups.map((category) => (
                <button
                  key={category.label}
                  type="button"
                  onClick={() => router.push(`/search?q=${encodeURIComponent(category.label)}`)}
                  className="flex h-8 w-full items-center justify-between rounded-[var(--radius-btn)] px-2.5 text-left text-[12px] text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                >
                  <span className="truncate">{category.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--ink-faint)]">
                    {category.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-[var(--rule)] px-3.5 py-3">
              <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-[var(--ink-faint)]">
                <DeimosIcon name="lifecycle" className="h-3 w-3" />
                {t("market.lifecycle")}
              </p>
              {lifecycleList}
            </div>
            <div className="border-t border-[var(--rule)] px-3.5 py-3">
              <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-[var(--ink-faint)]">
                <DeimosIcon name="pulse" className="h-3 w-3" />
                {t("market.intentSignals")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {hotTags.slice(0, 5).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => router.push(`/search?q=${encodeURIComponent(tag)}`)}
                    className="rounded-[var(--radius-btn)] border border-[var(--rule)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--accent-link)] hover:border-[var(--accent-link)]"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <aside className="hidden surface-card overflow-hidden lg:block">
            <div className="flex h-10 items-center gap-1.5 border-b border-[var(--rule)] px-3.5">
              <DeimosIcon name="radar" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
              <p className="text-[13px] font-semibold text-[var(--ink)]">{t("market.discoverBy")}</p>
            </div>
            <div className="p-2">
              <button
                type="button"
                onClick={() => updateParams("", initialSort)}
                className="flex h-8 w-full items-center justify-between rounded-[var(--radius-btn)] bg-[var(--primary-soft)] px-2.5 text-left text-[12px] font-semibold text-[var(--primary)]"
              >
                <span>{t("market.allIdeas")}</span>
                <span className="font-mono tabular-nums">{stats.ideaCount.toLocaleString()}</span>
              </button>
              {categoryGroups.map((category) => (
                <button
                  key={category.label}
                  type="button"
                  onClick={() => router.push(`/search?q=${encodeURIComponent(category.label)}`)}
                  className="flex h-8 w-full items-center justify-between rounded-[var(--radius-btn)] px-2.5 text-left text-[12px] text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                >
                  <span className="truncate">{category.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--ink-faint)]">
                    {category.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="border-t border-[var(--rule)] px-3.5 py-3">
              <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-[var(--ink-faint)]">
                <DeimosIcon name="lifecycle" className="h-3 w-3" />
                {t("market.lifecycle")}
              </p>
              {lifecycleList}
            </div>

            <div className="border-t border-[var(--rule)] px-3.5 py-3">
              <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-[var(--ink-faint)]">
                <DeimosIcon name="pulse" className="h-3 w-3" />
                {t("market.intentSignals")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {hotTags.slice(0, 5).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => router.push(`/search?q=${encodeURIComponent(tag)}`)}
                    className="rounded-[var(--radius-btn)] border border-[var(--rule)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--accent-link)] hover:border-[var(--accent-link)]"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            {/* flex-wrap:窄屏下排序控件换行显示,而不是被横向滚动条藏起来 */}
            <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-[var(--rule)] pb-2 sm:h-10 sm:pb-0">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value || "hot"}
                  type="button"
                  onClick={() => updateParams(filter.value, initialSort)}
                  className={`relative shrink-0 px-3 text-[13px] transition-colors ${
                    initialStatus === filter.value
                      ? "font-semibold text-[var(--accent-link)] after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--accent-link)]"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {t(filter.key)}
                </button>
              ))}
              <label className="ml-auto flex shrink-0 items-center gap-1.5 py-1 pr-1 text-[12px] text-[var(--ink-soft)] sm:py-2">
                {t("market.sort")}:
                <select
                  value={initialSort}
                  onChange={(event) => updateParams(initialStatus, event.target.value)}
                  className="border-0 bg-transparent py-0 pr-5 text-[12px] text-[var(--ink-soft)] shadow-none focus:ring-0"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.key)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {ideas.length === 0 ? (
              <div className="mt-3 flex items-start gap-3 surface-card px-4 py-5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-btn)] border border-[var(--rule)] bg-[var(--bg-subtle)] text-[var(--ink-faint)]">
                  <DeimosIcon name="document" className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-[var(--ink)]">{t("market.noIdeas")}</p>
                  <p className="mt-1 text-[12px] text-[var(--ink-faint)]">{t("market.noIdeasHint")}</p>
                  <Link href="/ideas/new" className="btn-primary btn-sm mt-3">
                    {t("market.publish")}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {ideas.map((idea, index) => (
                  <IdeaCard key={idea.id} idea={idea} variant="market" highlighted={index === 0} />
                ))}
              </div>
            )}
          </div>

          <aside className="hidden space-y-3 xl:block">
            {(trending.length > 0 || ideas.length > 0) && (
            <section className="surface-card overflow-hidden">
              <div className="flex h-10 items-center gap-1.5 border-b border-[var(--rule)] px-3.5">
                <DeimosIcon name="pulse" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
                <p className="text-[13px] font-semibold text-[var(--ink)]">{t("market.trending")}</p>
              </div>
              <div>
                {(trending.length > 0 ? trending.slice(0, 5) : ideas.slice(0, 5)).map((item, index) => (
                  <Link
                    key={item.id}
                    href={`/ideas/${item.id}`}
                    className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--rule)] px-3.5 py-2.5 text-[12px] last:border-0 hover:bg-[var(--bg-subtle)]"
                  >
                    <span className="font-mono text-[11px] tabular-nums text-[var(--ink-faint)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-[var(--ink)]">{item.title}</span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--accent-link)]">
                      +{"score" in item ? Math.max(0, Math.round(item.score)) : Math.max(item.like_count, item.flower_count)}
                    </span>
                  </Link>
                ))}
              </div>
              <p className="border-t border-[var(--rule)] px-3.5 py-2.5 text-[11px] leading-5 text-[var(--ink-faint)]">
                {t("market.signalExplain")}
              </p>
            </section>
            )}

            <section className="surface-card overflow-hidden">
              <div className="flex h-10 items-center justify-between gap-1.5 border-b border-[var(--rule)] px-3.5">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
                  <DeimosIcon name="agent" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
                  {t("market.agentOperate")}
                </p>
                <Link href="/docs/mcp" className="text-[12px] text-[var(--accent-link)] hover:underline">
                  {t("market.connectAgent")}
                </Link>
              </div>
              <p className="px-3.5 py-3 text-[12px] leading-5 text-[var(--ink-soft)]">
                {t("market.agentOperateHint")}
              </p>
              {agents.length > 0 && (
                <p className="border-t border-[var(--rule)] px-3.5 py-2.5 text-[11px] text-[var(--ink-faint)]">
                  {t("market.liveExecutors")} · {agents.slice(0, 3).map((agent) => agent.name).join(" · ")}
                </p>
              )}
            </section>

            <p className="px-1 text-[11px] text-[var(--ink-faint)]">
              {total.toLocaleString()} {t("market.semanticMatches")}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
