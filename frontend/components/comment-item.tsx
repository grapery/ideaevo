"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Comment } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { commentApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { ReportDialog } from "./report-dialog";
import { CommentForm } from "@/app/ideas/[id]/comments/comment-form";
import { useI18n } from "@/lib/i18n/provider";
import type { Idea } from "@/lib/types";

const sentimentBorder: Record<string, string> = {
  positive: "var(--accent-live)",
  neutral: "var(--ink-faint)",
  constructive: "var(--accent-stamp)",
};

function displayName(userId: string, anonymous: string) {
  if (!userId) return anonymous;
  if (userId.startsWith("agent_")) return `Agent ${userId.slice(6, 12)}`;
  return userId.length > 12 ? `${userId.slice(0, 8)}…` : userId;
}

export function CommentItem({
  comment,
  depth = 0,
  replyTo,
  ideaId,
  status,
  replyCount = 0,
  repliesExpanded,
  onToggleReplies,
}: {
  comment: Comment;
  depth?: number;
  replyTo?: Comment;
  ideaId?: string;
  status?: Idea["status"];
  replyCount?: number;
  repliesExpanded?: boolean;
  onToggleReplies?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const border = sentimentBorder[comment.sentiment || "neutral"];
  const isAgent = !comment.user_id || comment.user_id.startsWith("agent_");
  const name = displayName(comment.user_id, t("common.anonymous"));
  const isReply = depth > 0;
  const canManage =
    !!user && !!comment.user_id && !isAgent && comment.user_id === user.id;
  const canReply = !!ideaId && !isReply && status === "active";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [replying, setReplying] = useState(false);

  const sentimentLabel =
    comment.sentiment === "positive"
      ? t("idea.sentimentAgree")
      : comment.sentiment === "constructive"
        ? t("idea.sentimentSuggest")
        : t("idea.sentimentDiscuss");

  async function saveEdit() {
    if (!draft.trim()) {
      notify.error(t("idea.descEmpty"));
      return;
    }
    setSaving(true);
    try {
      await commentApi.update(comment.id, draft.trim());
      notify.success(t("idea.commentUpdated"));
      setEditing(false);
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(t("idea.confirmDeleteComment"))) return;
    setDeleting(true);
    try {
      await commentApi.delete(comment.id);
      notify.success(t("idea.commentDeleted"));
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={
        isReply
          ? "relative border-l border-[var(--rule)] pl-4 py-2"
          : "rounded-[var(--radius-card)] border border-[var(--rule)] border-l-[3px] bg-[var(--bg-surface)] p-3.5"
      }
      style={!isReply ? { borderLeftColor: border } : undefined}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] font-[family-name:var(--font-mono)] text-[10px] font-semibold text-[var(--ink-soft)]">
          {isAgent ? "A" : name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`font-medium text-[var(--ink)] ${isReply ? "text-[12px]" : "text-[13px]"}`}
            >
              {name}
            </span>
            {replyTo && (
              <span className="text-[11px] text-[var(--ink-faint)]">
                {t("idea.replyTo")}{" "}
                <span className="text-[var(--accent-link)]">
                  {displayName(replyTo.user_id, t("common.anonymous"))}
                </span>
              </span>
            )}
            <span className="text-[11px] text-[var(--ink-faint)]">
              {new Date(comment.created_at).toLocaleDateString(locale)}
            </span>
            {!isReply && (
              <span
                className="rounded border border-[var(--rule)] px-1.5 py-px text-[10px] text-[var(--ink-soft)]"
                style={{ borderLeftWidth: 2, borderLeftColor: border }}
              >
                {sentimentLabel}
              </span>
            )}
            {comment.is_moderated && (
              <span className="text-[10px] text-[var(--coral)]">
                {t("idea.commentHidden")}
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className="btn-outline btn-sm disabled:opacity-50"
                >
                  {saving ? t("common.saving") : t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(comment.content);
                    setEditing(false);
                  }}
                  disabled={saving}
                  className="btn-default btn-sm"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <p
              className={`mt-1.5 whitespace-pre-wrap leading-relaxed text-[var(--ink-soft)] ${
                isReply ? "text-[12px]" : "text-[13px]"
              }`}
            >
              {comment.content}
            </p>
          )}

          {!editing && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {canReply && (
                <button
                  type="button"
                  onClick={() => setReplying((v) => !v)}
                  className="text-[11px] font-medium text-[var(--ink-faint)] hover:text-[var(--accent-link)]"
                >
                  {t("idea.reply")}
                </button>
              )}
              {replyCount > 0 && onToggleReplies && (
                <button
                  type="button"
                  onClick={onToggleReplies}
                  className="text-[11px] font-medium text-[var(--accent-link)] hover:underline"
                  aria-expanded={repliesExpanded}
                >
                  {repliesExpanded
                    ? t("idea.hideReplies")
                    : t("idea.showReplies", { count: replyCount })}
                </button>
              )}
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(comment.content);
                      setEditing(true);
                    }}
                    className="text-[11px] text-[var(--ink-faint)] hover:text-[var(--accent-link)]"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={deleting}
                    className="text-[11px] text-[var(--ink-faint)] hover:text-[var(--coral)] disabled:opacity-50"
                  >
                    {deleting ? t("common.saving") : t("common.delete")}
                  </button>
                </>
              )}
              {user && !canManage && (
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="text-[11px] text-[var(--ink-faint)] hover:text-[var(--coral)]"
                >
                  {t("idea.report")}
                </button>
              )}
            </div>
          )}

          {replying && ideaId && (
            <CommentForm
              ideaId={ideaId}
              status={status}
              parentId={comment.id}
              compact
              autofocus
              onCancel={() => setReplying(false)}
              onSuccess={() => setReplying(false)}
            />
          )}

          {reportOpen && (
            <ReportDialog
              open={reportOpen}
              onClose={() => setReportOpen(false)}
              targetType="comment"
              targetId={comment.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
