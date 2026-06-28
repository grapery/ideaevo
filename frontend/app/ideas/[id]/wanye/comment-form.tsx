"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import {
  IDEA_AUTH_REQUIRED_MSG,
  ideaRequestJson,
} from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

export function CommentForm({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState("neutral");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("请输入评论内容");
      return;
    }
    if (!canAct) {
      notify.error(IDEA_AUTH_REQUIRED_MSG);
      return;
    }

    setError("");
    setLoading(true);
    try {
      await ideaRequestJson(`/ideas/${ideaId}/comments`, {
        method: "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
        body: JSON.stringify({ content, sentiment }),
      });
      notify.success("评论已发表！");
      setContent("");
      // 刷新页面数据以显示新评论
      router.refresh();
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
          placeholder="发表你的 Deimos 评论…"
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
              className="filter-chip"
              data-active={sentiment === s.value ? "true" : undefined}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="btn-outline px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "发表中…" : "发表评论"}
        </button>
      </div>
    </form>
  );
}
