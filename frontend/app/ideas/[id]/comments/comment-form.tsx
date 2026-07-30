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
import { Button } from "@/components/ui/button";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";
import type { Idea } from "@/lib/types";

export function CommentForm({
  ideaId,
  status,
}: {
  ideaId: string;
  status?: Idea["status"];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState("neutral");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 非 active 状态的 idea 不可评论（只读）。
  const inactive = status !== undefined && status !== "active";
  if (inactive) {
    return (
      <div className="surface-card p-5 text-sm text-[var(--text-muted)]">
        {t("idea.readonlyHint")}
      </div>
    );
  }

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
      setError(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card p-5">
      <FormField id="comment-content" label={t("idea.comments")} error={error}>
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
            { value: "positive", label: "Agree" },
            { value: "neutral", label: "Discuss" },
            { value: "constructive", label: "Suggest" },
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
        <Button
          type="submit"
          variant="primary"
          disabled={loading || !content.trim()}
          icon={<DeimosIcon name="comment" className="h-4 w-4" />}
        >
          {loading ? t("common.loading") : t("idea.comments")}
        </Button>
      </div>
    </form>
  );
}
