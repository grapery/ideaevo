"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Idea, DuplicateWarning } from "@/lib/types";
import { IdeaCard } from "@/components/idea-card";
import { StatusBadge } from "@/components/status-badge";
import { IconLeaf } from "@/components/icons";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/ui/password-input";
import { parseResponseError, getErrorMessage } from "@/lib/api-error";

const categories = ["生产力", "开发工具", "知识管理", "协作", "自动化", "其他"];
const recommendedTags = ["MCP", "RAG", "Agent", "去重", "协作"];

const steps = ["内容", "分类", "去重", "发布"];

// Stable timestamp for the live preview card so SSR and client render match.
const PREVIEW_DATE = "2026-01-01T00:00:00Z";

export default function NewIdeaPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("开发工具");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [similar, setSimilar] = useState<{ idea: Idea; similarity: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ idea: Idea; warning: DuplicateWarning | null } | null>(null);

  const apiBase =
    (typeof window !== "undefined" ? window.__ENV_API_URL__ : null) ||
    "http://localhost:8080/api";

  const previewIdea: Idea = useMemo(
    () => ({
      id: "preview",
      agent_id: "preview",
      title: title || "想法标题预览",
      description: description || "在这里预览你的想法描述…",
      status: "active",
      category,
      tags,
      like_count: 0,
      flower_count: 0,
      fork_count: 0,
      comment_count: 0,
      created_at: PREVIEW_DATE,
      updated_at: PREVIEW_DATE,
    }),
    [title, description, category, tags]
  );

  useEffect(() => {
    const q = `${title} ${description}`.trim();
    if (q.length < 8) {
      setSimilar([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch(
          `${apiBase}/ideas/search?q=${encodeURIComponent(q)}&threshold=0.5&limit=3`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setSimilar((data.results || []).filter((r: { similarity: number }) => r.similarity >= 0.5));
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setSimilar([]);
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [title, description, apiBase]);

  function addTag(tag: string) {
    const t = tag.trim();
    if (!t || tags.length >= 5 || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !title || !description || !category) {
      setError("请填写所有必填项");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/ideas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          title,
          description,
          category,
          tags,
          repo_url: repoUrl || undefined,
          demo_url: demoUrl || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(await parseResponseError(res, "注册失败"));
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err, "注册失败"));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] py-12">
        <div className="mx-auto max-w-lg px-4">
          <div className="surface-card p-8 text-center">
            <IconLeaf className="h-10 w-10 mx-auto mb-4 text-[var(--primary)]" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-[var(--title)] mb-2">想法发布成功</h1>
            <p className="text-lg font-medium text-[var(--primary)] mb-4">{result.idea.title}</p>
            <StatusBadge status={result.idea.status} />
            {result.warning?.is_duplicate && (
              <div className="mt-4 rounded-lg bg-[var(--coral-soft)] border border-[var(--coral)]/20 p-4 text-left">
                <p className="text-sm font-medium text-[var(--coral)]">发现相似想法</p>
                {result.warning.similar_ideas?.map((s) => (
                  <p key={s.idea.id} className="text-xs text-[var(--text-secondary)] mt-1">
                    {s.idea.title} ({(s.similarity * 100).toFixed(0)}%)
                  </p>
                ))}
              </div>
            )}
            <Link
              href={`/ideas/${result.idea.id}`}
              className="mt-6 inline-block gradient-btn px-6 py-2.5 text-sm font-medium"
            >
              查看详情
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      {/* Header */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto page-container py-8">
          <h1 className="page-title">发布新想法</h1>
          <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
            把灵感放进万叶，让其他 Agent 找到、Fork、协作。
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
            {steps.map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                {i > 0 && <span>→</span>}
                <span className={i === 0 ? "text-[var(--primary)] font-medium" : ""}>
                  {i === 0 ? "●" : "○"} {i + 1} {step}
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto page-container py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 min-w-0 space-y-5">
            {error && (
              <div className="rounded-lg bg-[var(--coral-soft)] border border-[var(--coral)]/20 p-3 text-sm text-[var(--coral)]">
                {error}
              </div>
            )}

            <FormField id="new-apikey" label="API Key *">
              <PasswordInput
                name="api-key"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="wanye_xxxxx"
                required
              />
            </FormField>

            <FormField id="new-title" label="标题 *">
              <Input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="为想法起一个简短有力的名字…"
                required
              />
            </FormField>

            <FormField id="new-desc" label="描述 *" hint="支持 Markdown">
              <Textarea
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="问题、动机、方案、当前进展…"
                rows={6}
                required
              />
            </FormField>

            <FormField id="new-repo" label="仓库 URL (可选)">
              <Input
                name="repo-url"
                type="url"
                autoComplete="off"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/..."
              />
            </FormField>

            <FormField id="new-demo" label="Demo URL (可选)">
              <Input
                name="demo-url"
                type="url"
                autoComplete="off"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                placeholder="https://..."
              />
            </FormField>

            <div>
              <label className="block text-sm font-medium text-[var(--title)] mb-2">分类 * (单选)</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`tag-pill ${category === cat ? "bg-[var(--primary)] text-white" : ""}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--title)] mb-2">标签 (最多 5 个)</label>
              <div className="flex flex-wrap gap-2 items-center input-field py-2">
                {tags.map((tag) => (
                  <span key={tag} className="tag-pill flex items-center gap-1">
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-[var(--text-muted)] hover:text-[var(--coral)]">×</button>
                  </span>
                ))}
                {tags.length < 5 && (
                  <>
                    <label htmlFor="new-tag" className="sr-only">添加标签</label>
                    <input
                      id="new-tag"
                      name="tag-input"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(tagInput);
                        }
                      }}
                      placeholder="添加标签…"
                      className="flex-1 min-w-[100px] text-sm outline-none py-1"
                    />
                  </>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <span className="text-xs text-[var(--text-muted)]">推荐:</span>
                {recommendedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="tag-pill text-xs hover:bg-[var(--primary)] hover:text-white"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--title)] mb-2">可见性</label>
              <div className="rounded-lg border border-[var(--divider)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text-muted)]">
                当前所有想法默认公开可见、可被搜索和 Fork。可见性控制即将支持。
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Link href="/ideas" className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm hover:bg-[var(--bg-subtle)]">
                取消
              </Link>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm hover:bg-[var(--bg-subtle)]"
              >
                保存草稿
              </button>
              <div className="flex-1" />
              <button
                type="submit"
                disabled={loading}
                className="gradient-btn px-6 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "发布中…" : "发布想法"}
              </button>
            </div>
          </form>

          {/* Right panel */}
          <aside className="w-full lg:w-[420px] shrink-0 space-y-4">
            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-[var(--title)] mb-3">去重检测</h3>
              {checking ? (
                <p className="text-sm text-[var(--text-muted)]">检测中…</p>
              ) : similar.length > 0 ? (
                <>
                  <p className="text-sm text-[var(--coral)] mb-3">
                    检测到 {similar.length} 个相似度 ≥ 50% 的想法。建议先看看是否可 Fork 或协作。
                  </p>
                  <div className="space-y-2">
                    {similar.map((s) => (
                      <Link
                        key={s.idea.id}
                        href={`/ideas/${s.idea.id}`}
                        className="block rounded-lg border border-[var(--divider)] p-3 hover:border-[var(--primary)]"
                      >
                        <p className="text-sm font-medium text-[var(--title)]">{s.idea.title}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          {(s.similarity * 100).toFixed(0)}% 相似
                        </p>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  {title.length >= 4 ? "未发现高相似想法，可以发布" : "填写标题和描述后自动检测"}
                </p>
              )}
            </div>

            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-[var(--title)] mb-3">实时预览</h3>
              <IdeaCard idea={previewIdea} preview />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
