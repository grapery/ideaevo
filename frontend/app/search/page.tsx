"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DeimosIcon } from "@/components/deimos-icon";
import { SearchInput } from "@/components/search-input";
import { SearchResultCard } from "@/components/search-result-card";
import { getApiBase } from "@/lib/api-base";
import { Idea, normalizeTags } from "@/lib/types";

interface SearchResult {
  idea: Idea;
  similarity: number;
}

const statusFilters = [
  { value: "", label: "全部状态" },
  { value: "active", label: "活跃" },
  { value: "implemented", label: "已实现" },
  { value: "buried", label: "已埋没" },
];

const categories = [
  { value: "", label: "全部分类" },
  { value: "tool", label: "工具" },
  { value: "service", label: "服务" },
  { value: "integration", label: "MCP / 集成" },
  { value: "automation", label: "自动化" },
  { value: "creative", label: "创意" },
  { value: "data", label: "数据" },
  { value: "other", label: "其他" },
];

const suggestedKeywords = ["MCP", "Agent", "自动化", "工具", "AI"];

function buildSearchParams(query: string, page: number, status: string, category: string) {
  const params = new URLSearchParams({ q: query, page: String(page), limit: "10" });
  if (status) params.set("status", status);
  if (category) params.set("category", category);
  return params.toString();
}

export default function SearchPage() {
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
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="page-container py-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-code text-[10px] text-[var(--accent-link)]">SEMANTIC RADAR / EVIDENCE SEARCH</p>
            <h1 className="font-display mt-2 text-[30px] font-bold tracking-[-0.025em] text-[var(--ink)]">
              搜索问题，不只搜索关键词。
            </h1>
          </div>
          <p className="font-code text-[9px] text-[var(--ink-faint)]">VECTOR + MYSQL FALLBACK</p>
        </div>

        <section className="mt-5 rounded-[8px] border border-[#9bbcff] bg-white p-4">
          <SearchInput
            variant="inline"
            id="search-q"
            placeholder="例如：如何确认一个 MCP Agent idea 已经被实现？"
            value={query}
            onChange={setQuery}
            onSubmit={submitSearch}
            navigateOnSubmit={false}
            submitLabel="搜索证据 →"
            loading={loading}
            autoFocus
          />
          <div className="mt-3 flex flex-wrap items-center gap-5 font-code text-[9px] text-[var(--ink-faint)]">
            <span>semantic similarity</span>
            <span>lifecycle state</span>
            <span>implementation evidence</span>
            {searched && (
              <span className="ml-auto text-[var(--accent-link)]">
                {results.length} MATCHES · {elapsed?.toFixed(2) || "0.00"}s
              </span>
            )}
          </div>
        </section>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[208px_minmax(0,720px)] xl:grid-cols-[208px_minmax(0,720px)_320px]">
          <aside className="hidden min-h-[690px] rounded-[8px] border border-[var(--rule)] bg-white p-4 lg:block">
            <p className="font-code text-[10px] text-[var(--ink)]">FILTERS</p>
            <div className="mt-5">
              <p className="font-code text-[9px] text-[var(--ink-faint)]">STATUS</p>
              <div className="mt-2 space-y-1">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveStatus(filter.value)}
                    className={`flex h-8 w-full items-center rounded-[5px] px-2 text-left text-[12px] ${
                      activeStatus === filter.value
                        ? "bg-[var(--accent-link-soft)] font-medium text-[var(--accent-link)]"
                        : "text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="my-4 border-t border-[var(--rule)]" />
            <p className="font-code text-[9px] text-[var(--ink-faint)]">CATEGORY</p>
            <div className="mt-2 space-y-1">
              {categories.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setActiveCategory(category.value)}
                  className={`flex h-8 w-full items-center rounded-[5px] px-2 text-left text-[12px] ${
                    activeCategory === category.value
                      ? "bg-[var(--primary-soft)] font-medium text-[#b75b00]"
                      : "text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0">
            {!searched ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[8px] border border-[var(--rule)] bg-white p-8 text-center">
                <DeimosIcon name="semantic-search" className="h-7 w-7 text-[var(--accent-link)]" />
                <p className="font-display mt-4 text-[18px] font-semibold text-[var(--ink)]">输入问题或机会</p>
                <p className="mt-1 text-[12px] text-[var(--ink-faint)]">Deimos 会返回语义重叠、实现状态与证据来源。</p>
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-[8px] border border-[#ffb76a] bg-[#fff6ea] p-8 text-center">
                <p className="font-code text-[10px] text-[#b75b00]">NO MATCH / EXPLORATION SPACE</p>
                <p className="font-display mt-3 text-[18px] font-semibold text-[var(--ink)]">
                  没有找到「{query}」的直接重叠
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {suggestedKeywords.map((keyword) => (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => {
                        setQuery(keyword);
                        submitSearch(keyword);
                      }}
                      className="font-code text-[10px] text-[#b75b00] hover:underline"
                    >
                      #{keyword}
                    </button>
                  ))}
                </div>
                <Link href="/ideas/new" className="btn-primary mt-6">+ REGISTER THIS IDEA</Link>
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
                    className="h-10 w-full rounded-[6px] border border-[var(--rule)] bg-white px-4 text-left font-code text-[10px] text-[var(--ink-soft)] hover:border-[var(--accent-link)]"
                  >
                    {loading ? "LOADING…" : "LOAD MORE RESULTS →"}
                  </button>
                )}
              </div>
            )}
          </main>

          <aside className="hidden space-y-4 xl:block">
            <section className="rounded-[8px] bg-[#0a0a0a] p-4 font-code text-[10px] leading-6 text-[#d6d9de]">
              <p className="text-[#9bff00]">HOW THIS RANKS</p>
              <p className="mt-3">0.45 semantic overlap</p>
              <p>0.25 implementation evidence</p>
              <p>0.20 community future value</p>
              <p>0.10 lifecycle recency</p>
            </section>

            <section className="rounded-[8px] border border-[var(--rule)] bg-white p-4">
              <p className="font-code text-[10px] text-[var(--ink)]">RESULT SIGNALS</p>
              <dl className="mt-4 space-y-3 font-code text-[10px] text-[var(--ink-soft)]">
                <div className="flex justify-between"><dt>matches</dt><dd>{results.length}</dd></div>
                <div className="flex justify-between"><dt>evidence coverage</dt><dd>{evidenceCoverage}%</dd></div>
                <div className="flex justify-between"><dt>implemented</dt><dd>{results.filter((r) => r.idea.status === "implemented").length}</dd></div>
              </dl>
            </section>

            {relatedTags.length > 0 && (
              <section className="rounded-[8px] border border-[#ffb76a] bg-[#fff6ea] p-4">
                <p className="font-code text-[10px] text-[#b75b00]">RELATED INTENTS</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                  {relatedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setQuery(tag);
                        submitSearch(tag);
                      }}
                      className="font-code text-[9px] text-[#b75b00] hover:underline"
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
