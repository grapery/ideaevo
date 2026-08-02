"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DeimosIcon } from "@/components/deimos-icon";
import { SearchInput } from "@/components/search-input";
import { SearchResultCard } from "@/components/search-result-card";
import { getApiBase } from "@/lib/api-base";
import { Idea, normalizeTags } from "@/lib/types";
import { useI18n } from "@/lib/i18n/provider";

interface SearchResult {
  idea: Idea;
  similarity: number;
}

const statusFilters = [
  { value: "", label: "market.statusAll" as const },
  { value: "active", label: "market.active" as const },
  { value: "implemented", label: "idea.implemented" as const },
  { value: "buried", label: "market.buried" as const },
];

const categories = [
  { value: "", label: "market.catAll" as const },
  { value: "tool", label: "market.catTool" as const },
  { value: "service", label: "market.catService" as const },
  { value: "integration", label: "market.catIntegration" as const },
  { value: "automation", label: "market.catAutomation" as const },
  { value: "creative", label: "market.catCreative" as const },
  { value: "data", label: "market.catData" as const },
  { value: "other", label: "market.catOther" as const },
];

const suggestedKeywords: { label?: string; labelKey?: string; query: string }[] = [
  { label: "MCP", query: "MCP" },
  { label: "Agent", query: "Agent" },
  { labelKey: "search.suggestedAutomation", query: "automation" },
  { labelKey: "search.suggestedTool", query: "tool" },
  { label: "AI", query: "AI" },
];

function buildSearchParams(query: string, page: number, status: string, category: string) {
  const params = new URLSearchParams({ q: query, page: String(page), limit: "10" });
  if (status) params.set("status", status);
  if (category) params.set("category", category);
  return params.toString();
}

export default function SearchPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [activeStatus, setActiveStatus] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);
  const apiBase = getApiBase();

  const handleSearch = useCallback(
    async (rawQuery: string, pageNumber: number, status: string, category: string) => {
      const searchQuery = rawQuery.trim();
      if (!searchQuery) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setSearched(true);
      const start = performance.now();
      try {
        const response = await fetch(
          `${apiBase}/ideas/search?${buildSearchParams(searchQuery, pageNumber, status, category)}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          setResults([]);
          return;
        }
        const data = await response.json();
        const items: SearchResult[] = data.results || [];
        setResults((previous) => (pageNumber === 1 ? items : [...previous, ...items]));
        setPage(pageNumber);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setElapsed((performance.now() - start) / 1000);
          setLoading(false);
        }
      }
    },
    [apiBase]
  );

  useEffect(() => {
    if (!initialQuery) return;
    const timer = window.setTimeout(
      () => void handleSearch(initialQuery, 1, "", ""),
      0
    );
    return () => window.clearTimeout(timer);
  }, [handleSearch, initialQuery]);

  useEffect(() => {
    if (!searched || !query.trim()) return;
    const timer = window.setTimeout(
      () => void handleSearch(query, 1, activeStatus, activeCategory),
      0
    );
    return () => window.clearTimeout(timer);
  }, [activeCategory, activeStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const relatedTags = useMemo(
    () =>
      Array.from(new Set(results.flatMap((result) => normalizeTags(result.idea.tags))))
        .slice(0, 7),
    [results]
  );

  const evidenceCoverage = results.length
    ? Math.round(
        (results.filter((result) => result.idea.repo_url || result.idea.demo_url).length /
          results.length) *
          100
      )
    : 0;

  const submitSearch = (value = query) =>
    void handleSearch(value, 1, activeStatus, activeCategory);

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-eyebrow">{t("search.eyebrow")}</p>
            <h1 className="page-heading">{t("search.title")}</h1>
          </div>
          <p className="font-code text-[10px] text-[var(--ink-faint)]">{t("search.vectorFallback")}</p>
        </div>

        <section className="callout-link mt-5 p-4">
          <SearchInput
            variant="inline"
            id="search-q"
            placeholder={t("search.placeholder")}
            value={query}
            onChange={setQuery}
            onSubmit={submitSearch}
            navigateOnSubmit={false}
            submitLabel={t("search.submit")}
            loading={loading}
            autoFocus
          />
          <div className="mt-3 flex flex-wrap items-center gap-5 font-code text-[10px] text-[var(--ink-faint)]">
            <span>{t("search.signalSemantic")}</span>
            <span>{t("search.signalLifecycle")}</span>
            <span>{t("search.signalEvidence")}</span>
            {searched && (
              <span className="ml-auto text-[var(--accent-link)]">
                {t("search.matchesElapsed", {
                  count: results.length,
                  seconds: elapsed?.toFixed(2) || "0.00",
                })}
              </span>
            )}
          </div>
        </section>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[208px_minmax(0,720px)] xl:grid-cols-[208px_minmax(0,720px)_320px]">
          <aside className="hidden min-h-[690px] surface-card p-4 lg:block">
            <p className="font-code text-[10px] text-[var(--ink)]">{t("search.filters")}</p>
            <div className="mt-5">
              <p className="font-code text-[9px] text-[var(--ink-faint)]">{t("market.status")}</p>
              <div className="mt-2 space-y-1">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveStatus(filter.value)}
                    className={`flex h-8 w-full items-center rounded-[var(--radius-btn)] px-2 text-left text-[12px] ${
                      activeStatus === filter.value
                        ? "bg-[var(--accent-link-soft)] font-medium text-[var(--accent-link)]"
                        : "text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    {t(filter.label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="my-4 border-t border-[var(--rule)]" />
            <p className="font-code text-[9px] text-[var(--ink-faint)]">{t("idea.category")}</p>
            <div className="mt-2 space-y-1">
              {categories.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setActiveCategory(category.value)}
                  className={`flex h-8 w-full items-center rounded-[var(--radius-btn)] px-2 text-left text-[12px] ${
                    activeCategory === category.value
                      ? "bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
                      : "text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  {t(category.label)}
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0">
            {!searched ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center surface-card p-8 text-center">
                <DeimosIcon name="semantic-search" className="h-7 w-7 text-[var(--accent-link)]" />
                <p className="font-display mt-4 text-[18px] font-semibold text-[var(--ink)]">{t("search.inputQuestion")}</p>
                <p className="mt-1 text-[12px] text-[var(--ink-faint)]">{t("search.desc")}</p>
              </div>
            ) : results.length === 0 ? (
              <div className="callout-primary p-8 text-center">
                <p className="font-code text-[10px] text-[var(--primary)]">{t("search.noMatchEyebrow")}</p>
                <p className="mt-3 font-display text-[18px] font-semibold text-[var(--ink)]">
                  {t("search.noMatch", { query })}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {suggestedKeywords.map((kw) => {
                    const label = kw.labelKey ? t(kw.labelKey as Parameters<typeof t>[0]) : kw.label ?? kw.query;
                    return (
                    <button
                      key={kw.query}
                      type="button"
                      onClick={() => {
                        setQuery(label);
                        submitSearch(label);
                      }}
                      className="font-code text-[10px] text-[var(--primary)] hover:underline"
                    >
                      #{label}
                    </button>
                    );
                  })}
                </div>
                <Link href="/ideas/new" className="btn-primary mt-6">{t("search.registerIdea")}</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((result) => (
                  <SearchResultCard key={result.idea.id} idea={result.idea} similarity={result.similarity} />
                ))}
                {results.length >= 10 && (
                  <button
                    type="button"
                    onClick={() => void handleSearch(query, page + 1, activeStatus, activeCategory)}
                    disabled={loading}
                    className="h-10 w-full rounded-[6px] border border-[var(--rule)] bg-[var(--bg-surface)] px-4 text-left font-code text-[10px] text-[var(--ink-soft)] hover:border-[var(--accent-link)]"
                  >
                    {loading ? t("common.loading") : t("search.loadMore")}
                  </button>
                )}
              </div>
            )}
          </main>

          <aside className="hidden space-y-4 xl:block">
            <section className="panel-inverse p-4 font-code text-[10px] leading-6">
              <p className="panel-inverse-accent">{t("search.howRanks")}</p>
              <p className="mt-3 panel-inverse-muted">{t("search.rankSemantic")}</p>
              <p className="panel-inverse-muted">{t("search.rankEvidence")}</p>
              <p className="panel-inverse-muted">{t("search.rankCommunity")}</p>
              <p className="panel-inverse-muted">{t("search.rankRecency")}</p>
            </section>

            <section className="surface-card p-4">
              <p className="font-code text-[10px] text-[var(--ink)]">{t("search.resultSignals")}</p>
              <dl className="mt-4 space-y-3 font-code text-[10px] text-[var(--ink-soft)]">
                <div className="flex justify-between"><dt>{t("search.matches")}</dt><dd>{results.length}</dd></div>
                <div className="flex justify-between"><dt>{t("search.evidenceCoverage")}</dt><dd>{evidenceCoverage}%</dd></div>
                <div className="flex justify-between"><dt>{t("search.implementedCount")}</dt><dd>{results.filter((r) => r.idea.status === "implemented").length}</dd></div>
              </dl>
            </section>

            {relatedTags.length > 0 && (
              <section className="callout-primary p-4">
                <p className="font-code text-[10px] text-[var(--primary)]">{t("search.relatedIntents")}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                  {relatedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setQuery(tag);
                        submitSearch(tag);
                      }}
                      className="font-code text-[10px] text-[var(--primary)] hover:underline"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
