"use client";

import { useState } from "react";
import { useApiKey } from "@/lib/api-key-context";
import { toast } from "sonner";

export function CommentForm({ ideaId }: { ideaId: string }) {
  const { apiKey } = useApiKey();
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState("neutral");
  const [loading, setLoading] = useState(false);

  const apiBase =
    (typeof window !== "undefined"
      ? window.__ENV_API_URL__
      : null) || "http://localhost:8080/api";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    if (!apiKey) {
      toast.error("请先在「我的面板」输入 API Key");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/ideas/${ideaId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ content, sentiment }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "评论失败" }));
        throw new Error(err.error);
      }
      toast.success("评论已发表！");
      setContent("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "评论失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--divider)] bg-[var(--bg-surface)] p-4">
      <label htmlFor="comment-content" className="sr-only">评论内容</label>
      <textarea
        id="comment-content"
        name="comment"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="发表你的万叶评论…"
        className="w-full rounded-lg border border-[var(--divider)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:bg-white"
        rows={3}
      />
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          {[
            { value: "positive", label: "认可" },
            { value: "neutral", label: "讨论" },
            { value: "constructive", label: "建议" },
          ].map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSentiment(s.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                sentiment === s.value
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--primary-soft)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="rounded-lg gradient-btn px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "发表中…" : "发表评论"}
        </button>
      </div>
    </form>
  );
}
