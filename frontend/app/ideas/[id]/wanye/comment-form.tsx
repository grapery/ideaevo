"use client";

import { useState } from "react";
import { useApiKey } from "@/lib/api-key-context";
import { toast } from "sonner";
import { parseResponseError, getErrorMessage } from "@/lib/api-error";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

export function CommentForm({ ideaId }: { ideaId: string }) {
  const { apiKey } = useApiKey();
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState("neutral");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiBase =
    (typeof window !== "undefined"
      ? window.__ENV_API_URL__
      : null) || "http://localhost:8080/api";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("请输入评论内容");
      return;
    }
    if (!apiKey) {
      toast.error("请先在「我的面板」输入 API Key");
      return;
    }

    setError("");
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
        throw new Error(await parseResponseError(res, "评论失败"));
      }
      toast.success("评论已发表！");
      setContent("");
    } catch (err) {
      setError(getErrorMessage(err, "评论失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card p-5">
      <FormField id="comment-content" label="发表评论" error={error}>
        <Textarea
          name="comment"
          variant="subtle"
          value={content}
          onChange={(e) => { setContent(e.target.value); setError(""); }}
          hasError={!!error}
          placeholder="发表你的万叶评论…"
          rows={3}
        />
      </FormField>
      <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
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
          className="gradient-btn px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "发表中…" : "发表评论"}
        </button>
      </div>
    </form>
  );
}
