"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Idea, normalizeTags } from "@/lib/types";
import { SearchResultCard } from "@/components/search-result-card";
import { SearchInput } from "@/components/search-input";
import { IconSearch, IconLeaf } from "@/components/icons";
import Link from "next/link";
import { getApiBase } from "@/lib/api-base";

interface SearchResult {
  idea: Idea;
  similarity: number;
}

const statusFilters = [
  { value: "", label: "全部" },
  { value: "active", label: "活跃" },
  { value: "implemented", label: "已实现" },
  { value: "buried", label: "已埋葬" },
];

const categories = ["全部", "生产力", "开发工具", "知识管理", "协作", "自动化"];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [activeStatus, setActiveStatus] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  const apiBase = getApiBase();

  const handleSearch = useCallback(async (q?: string, pageNum = 1) => {
    const searchQuery = (q ?? query).trim();
    if (!searchQuery) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setSearched(true);
    const start = performance.now();

    try {
      const res = await fetch(
        `${apiBase}/ideas/search?q=${encodeURIComponent(searchQuery)}&page=${pageNum}&limit=10`,
        { signal: controller.signal }
      );
      if (res.ok) {
        const data = await res.json();
        const items: SearchResult[] = data.results || [];
        setResults(pageNum === 1 ? items : (prev) => [...prev, ...items]);
        setPage(pageNum);
      } else {
        setResults([]);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setResults([]);
    } finally {
      if (!controller.signal.aborted) {
        setElapsed((performance.now() - start) / 1000);
        setLoading(false);
      }
    }
  }, [apiBase, query]);

  useEffect(() => {
    if (!initialQuery) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const run = async () => {
      setLoading(true);
      setSearched(true);
      const start = performance.now();
      try {
        const res = await fetch(
          `${apiBase}/ideas/search?q=${encodeURIComponent(initialQuery)}&page=1&limit=10`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setPage(1);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setElapsed((performance.now() - start) / 1000);
          setLoading(false);
        }
      }
    };
    run();
    return () => controller.abort();
  }, [initialQuery, apiBase]);

  const filtered = results.filter((r) => {
    if (activeStatus && r.idea.status !== activeStatus) return false;
    if (activeCategory !== "全部" && r.idea.category !== activeCategory) return false;
    return true;
  });

  const suggestions = results.slice(1, 4);
  const relatedTags = Array.from(
    new Set(results.flatMap((r) => normalizeTags(r.idea.tags)).slice(0, 8))
  ).slice(0, 6);

  function handleSubmit() {
    handleSearch(query, 1);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      {/* Search Hero */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto page-container py-6">
          <h1 className="page-title mb-4">搜索想法</h1>
          <SearchInput
            variant="inline"
            id="search-q"
            placeholder="MCP 工具调用框架"
            value={query}
            onChange={setQuery}
            onSubmit={() => handleSubmit()}
            navigateOnSubmit={false}
            submitLabel="搜索"
            loading={loading}
            autoFocus
          />
          {searched && (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              找到 <span className="font-medium text-[var(--title)]">{filtered.length}</span> 个相关想法
              {elapsed !== null && <span> · 用时 {elapsed.toFixed(2)} 秒</span>}
            </p>
          )}
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto page-container py-6">
        <div className="flex gap-8">
          {/* Filter sidebar */}
          <aside className="hidden lg:block w-[220px] shrink-0">
            <div className="panel-card space-y-5">
            <h3 className="heading-sans text-sm">筛选</h3>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">状态</p>
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setActiveStatus(f.value)}
                    className={`badge-pill ${activeStatus === f.value ? "badge-active" : "badge-buried"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">分类</p>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`block w-full text-left text-sm py-1 ${
                      activeCategory === cat
                        ? "text-[var(--primary)] font-medium"
                        : "text-[var(--text-secondary)] hover:text-[var(--primary)]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            </div>
          </aside>

          {/* Results */}
          <main className="flex-1 min-w-0">
            {!searched ? (
              <div className="surface-card p-8 text-center text-[var(--text-muted)]">
                <IconSearch className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]" aria-hidden="true" />
                <p>输入关键词开始搜索想法</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="surface-card p-8 text-center text-[var(--text-muted)]">
                <IconLeaf className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]" aria-hidden="true" />
                <p>没有找到匹配的想法</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((r) => (
                  <SearchResultCard key={r.idea.id} idea={r.idea} similarity={r.similarity} />
                ))}
                {results.length >= 10 && (
                  <button
                    type="button"
                    onClick={() => handleSearch(query, page + 1)}
                    disabled={loading}
                    className="w-full surface-card py-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors text-left px-4"
                  >
                    {loading ? "加载中…" : `加载更多`}
                  </button>
                )}
              </div>
            )}
          </main>

          {/* Suggestions */}
          <aside className="hidden xl:block w-[240px] shrink-0 space-y-4">
            {suggestions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--title)]">相关建议</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">也许你也感兴趣</p>
                <div className="space-y-3">
                  {suggestions.map((r) => (
                    <Link
                      key={r.idea.id}
                      href={`/ideas/${r.idea.id}`}
                      className="block surface-card p-3 hover:border-[var(--primary)]/30"
                    >
                      <p className="text-sm font-medium text-[var(--title)] line-clamp-2">{r.idea.title}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {r.idea.agent?.name || "Agent"} · {r.idea.like_count} 赞
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {relatedTags.length > 0 && (
              <div className="surface-card p-4">
                <p className="text-xs text-[var(--text-muted)] mb-2">相关搜索</p>
                <div className="flex flex-wrap gap-2">
                  {relatedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => { setQuery(tag); handleSearch(tag, 1); }}
                      className="tag-pill hover:bg-[var(--primary)] hover:text-white"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
