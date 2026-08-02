"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import {
  IDEA_AUTH_REQUIRED_MSG,
  ideaRequestJson,
} from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { useI18n } from "@/lib/i18n/provider";
import type { Idea } from "@/lib/types";

export function CommentForm({
  ideaId,
  status,
  parentId,
  replyMention,
  compact = false,
  autofocus = false,
  onCancel,
  onSuccess,
}: {
  ideaId: string;
  status?: Idea["status"];
  parentId?: string;
  /** Prefill @mention when replying into a thread */
  replyMention?: string;
  compact?: boolean;
  autofocus?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const [content, setContent] = useState(() =>
    replyMention ? `${replyMention} ` : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(compact || autofocus);

  useEffect(() => {
    if (replyMention && !content.trim()) {
      setContent(`${replyMention} `);
    }
  }, [replyMention]); // eslint-disable-line react-hooks/exhaustive-deps

  // 评论不因 idea 状态锁定（与后端一致）；仅展示只读提示给 buried 可选
  const inactive = status === "buried";
  if (inactive && !parentId) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--rule)] px-4 py-5 text-sm text-[var(--ink-faint)]">
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
      if (!user) openAuthModal();
      else notify.error(IDEA_AUTH_REQUIRED_MSG);
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
          sentiment: "neutral",
          ...(parentId ? { parent_id: parentId } : {}),
        }),
      });
      notify.success(t("chat.commentPublished"));
      setContent(replyMention ? `${replyMention} ` : "");
      setFocused(false);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  const displayName = user?.name || t("common.anonymous");
  const showActions = focused || content.trim().length > 0 || compact;

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-start gap-3">
        <WireframeAvatar
          name={displayName}
          avatarUrl={user?.avatar_url}
          entityId={user?.id}
          kind="user"
          size={compact ? 28 : 36}
        />
        <div className="min-w-0 flex-1">
          <div
            className={`rounded-[var(--radius-card)] border bg-[var(--bg-surface)] transition-colors ${
              focused
                ? "border-[var(--ink)]"
                : "border-[var(--rule)] hover:border-[var(--rule-strong)]"
            }`}
          >
            <textarea
              name={parentId ? "comment-reply" : "comment"}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setError("");
              }}
              onFocus={() => setFocused(true)}
              placeholder={
                parentId ? t("idea.replyPlaceholder") : t("idea.composerPlaceholder")
              }
              rows={showActions ? (compact ? 2 : 3) : 1}
              autoFocus={autofocus}
              className="w-full resize-none rounded-[var(--radius-card)] bg-transparent px-3.5 py-2.5 text-[14px] leading-6 text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
            />
            {showActions && (
              <div className="flex items-center justify-between gap-2 border-t border-[var(--rule-light)] px-3 py-2">
                <p className="hidden text-[11px] text-[var(--ink-faint)] sm:block">
                  {parentId ? t("idea.replyHint") : t("idea.composerHint")}
                </p>
                <div className="ml-auto flex items-center gap-2">
                  {(onCancel || (focused && !compact && !content.trim())) && (
                    <button
                      type="button"
                      onClick={() => {
                        setContent(replyMention ? `${replyMention} ` : "");
                        setError("");
                        setFocused(false);
                        onCancel?.();
                      }}
                      className="px-2 py-1.5 text-[12px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
                    >
                      {t("common.cancel")}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !content.trim()}
                    className="rounded-full bg-[var(--primary)] px-4 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading
                      ? t("common.loading")
                      : parentId
                        ? t("idea.reply")
                        : t("idea.postComment")}
                  </button>
                </div>
              </div>
            )}
          </div>
          {error && <p className="mt-1.5 text-xs text-[var(--coral)]">{error}</p>}
        </div>
      </div>
    </form>
  );
}
