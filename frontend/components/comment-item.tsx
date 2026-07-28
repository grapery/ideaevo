"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Comment } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { commentApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { ReportDialog } from "./report-dialog";

const sentimentConfig: Record<string, { text: string; border: string }> = {
  positive: { text: "认可", border: "var(--accent-live)" },
  neutral: { text: "讨论", border: "var(--ink-faint)" },
  constructive: { text: "建议", border: "var(--accent-stamp)" },
};

function displayName(userId: string) {
  if (!userId) return "匿名";
  if (userId.startsWith("agent_")) return `Agent ${userId.slice(6, 12)}`;
  return userId.length > 12 ? `${userId.slice(0, 8)}…` : userId;
}

export function CommentItem({
  comment,
  depth = 0,
  replyTo,
}: {
  comment: Comment;
  depth?: number;
  replyTo?: Comment;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const sentiment = sentimentConfig[comment.sentiment || "neutral"];
  const isAgent = !comment.user_id || comment.user_id.startsWith("agent_");
  const name = displayName(comment.user_id);
  const isReply = depth > 0;

  // 仅当前登录用户账户（非 agent）可编辑/删除自己的评论
  const canManage =
    !!user && !!comment.user_id && !isAgent && comment.user_id === user.id;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function saveEdit() {
    if (!draft.trim()) {
      notify.error("评论内容不能为空");
      return;
    }
    setSaving(true);
    try {
      await commentApi.update(comment.id, draft.trim());
      notify.success("评论已更新");
      setEditing(false);
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "更新失败"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("确定删除这条评论吗？")) return;
    setDeleting(true);
    try {
      await commentApi.delete(comment.id);
      notify.success("评论已删除");
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "删除失败"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={
        isReply
          ? "ml-5 border-l border-[var(--rule)] pl-4 py-1"
          : "surface-card p-3 border-l-[3px]"
      }
      style={!isReply ? { borderLeftColor: sentiment.border } : undefined}
    >
      <div className="flex items-start gap-2.5">
        <div className="btn-icon h-7 w-7 text-[9px] font-[family-name:var(--font-mono)] shrink-0">
          {isAgent ? "A" : name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-medium text-[var(--ink)] ${isReply ? "text-[12px]" : "text-[13px]"}`}>
              {name}
            </span>
            {replyTo && (
              <span className="text-[11px] text-[var(--ink-faint)]">
                回复{" "}
                <span className="text-[var(--accent-link)]">
                  {displayName(replyTo.user_id)}
                </span>
              </span>
            )}
            <span className="meta-label normal-case tracking-normal">
              {new Date(comment.created_at).toLocaleDateString("zh-CN")}
            </span>
            {sentiment && (
              <span
                className="badge-pill text-[9px]"
                style={{ borderLeftColor: sentiment.border, color: "var(--ink-soft)" }}
              >
                {sentiment.text}
              </span>
            )}
            {comment.is_moderated && (
              <span className="badge-pill text-[9px] text-[var(--coral)]">
                已隐藏
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-1.5 space-y-2">
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
                  {saving ? "保存中…" : "保存"}
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
                  取消
                </button>
              </div>
            </div>
          ) : (
            <p
              className={`mt-1 leading-relaxed text-[var(--ink-soft)] ${
                isReply ? "text-[12px]" : "text-[13px]"
              }`}
            >
              {comment.content}
            </p>
          )}

          {!editing && (
            <div className="mt-1.5 flex items-center gap-3">
              {!isReply && (
                <button
                  type="button"
                  className="meta-label normal-case tracking-normal hover:text-[var(--accent-link)]"
                >
                  回复
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
                    className="meta-label normal-case tracking-normal hover:text-[var(--accent-link)]"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={deleting}
                    className="meta-label normal-case tracking-normal hover:text-[var(--coral)] disabled:opacity-50"
                  >
                    {deleting ? "删除中…" : "删除"}
                  </button>
                </>
              )}
              {user && !canManage && (
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="meta-label normal-case tracking-normal hover:text-[var(--coral)]"
                >
                  举报
                </button>
              )}
            </div>
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
