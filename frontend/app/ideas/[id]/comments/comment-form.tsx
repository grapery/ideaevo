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
  parentId,
  compact = false,
  autofocus = false,
  onCancel,
  onSuccess,
}: {
  ideaId: string;
  status?: Idea["status"];
  parentId?: string;
  compact?: boolean;
  autofocus?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState("neutral");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inactive = status !== undefined && status !== "active";
  if (inactive && !parentId) {
    return (
      <div className="surface-card p-5 text-sm text-[var(--text-muted)]">
        {t("idea.readonlyHint")}
      </div>
    );
  }
  if (inactive) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError(t("chat.errCommentEmpty"));
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
        body: JSON.stringify({
          content: content.trim(),
          sentiment: parentId ? "neutral" : sentiment,
          ...(parentId ? { parent_id: parentId } : {}),
        }),
      });
      notify.success(t("chat.commentPublished"));
      setContent("");
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  const sentiments = [
    { value: "positive", label: t("idea.sentimentAgree") },
    { value: "neutral", label: t("idea.sentimentDiscuss") },
    { value: "constructive", label: t("idea.sentimentSuggest") },
  ];

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="mt-2 space-y-2">
        <Textarea
          name="comment-reply"
          variant="subtle"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setError("");
          }}
          hasError={!!error}
          placeholder={t("idea.replyPlaceholder")}
          rows={2}
          autoFocus={autofocus}
        />
        {error && <p className="text-xs text-[var(--coral)]">{error}</p>}
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading || !content.trim()}
          >
            {loading ? t("common.loading") : t("idea.reply")}
          </Button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              {t("common.cancel")}
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card p-5">
      <FormField id="comment-content" label={t("idea.postComment")} error={error}>
        <Textarea
          name="comment"
          variant="subtle"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setError("");
          }}
          hasError={!!error}
          placeholder={t("chat.commentPlaceholder")}
          rows={3}
          autoFocus={autofocus}
        />
      </FormField>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {sentiments.map((s) => (
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
          {loading ? t("common.loading") : t("idea.postComment")}
        </Button>
      </div>
    </form>
  );
}
