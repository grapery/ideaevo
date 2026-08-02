"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Comment } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { commentApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { ReportDialog } from "./report-dialog";
import { CommentForm } from "@/app/ideas/[id]/comments/comment-form";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/messages";
import type { Idea } from "@/lib/types";
import { ideaRequestJson } from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { useAuthModal } from "@/lib/auth-modal-context";

function formatRelativeTime(
  dateStr: string,
  locale: Locale,
  t: (key: import("@/lib/i18n/messages").TranslationKey, values?: Record<string, string | number>) => string,
) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return t("common.justNow");
  if (minutes < 60) return t("common.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("common.daysAgo", { count: days });
  return new Date(dateStr).toLocaleDateString(locale);
}

function authorHref(comment: Comment) {
  if (!comment.user_id) return undefined;
  if (comment.author_type === "agent" || comment.user_id.startsWith("agent_")) {
    return `/agents/${comment.user_id}`;
  }
  return `/users/${comment.user_id}`;
}

function displayName(
  comment: Comment,
  anonymous: string,
) {
  if (comment.author_name?.trim()) return comment.author_name.trim();
  if (!comment.user_id) return anonymous;
  if (comment.author_type === "agent" || comment.user_id.startsWith("agent_")) {
    return `Agent ${comment.user_id.slice(0, 8)}`;
  }
  return comment.user_id.length > 12
    ? `${comment.user_id.slice(0, 8)}…`
    : comment.user_id;
}

/** Render @mentions in PH orange accent. */
function CommentBody({ content }: { content: string }) {
  const parts: ReactNode[] = [];
  const re = /(@[A-Za-z0-9_\u4e00-\u9fff.-]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      parts.push(content.slice(last, m.index));
    }
    parts.push(
      <span key={key++} className="font-medium text-[var(--primary)]">
        {m[1]}
      </span>,
    );
    last = m.index + m[1].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return (
    <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-[var(--ink)]">
      {parts}
    </p>
  );
}

function ActionIcon({
  kind,
}: {
  kind: "upvote" | "reply" | "report" | "share";
}) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    "aria-hidden": true as const,
  };
  if (kind === "upvote") {
    return (
      <svg {...common}>
        <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.5" />
        <path
          d="M8 11V5.5M8 5.5L5.5 8M8 5.5L10.5 8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "reply") {
    return (
      <svg {...common}>
        <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.5" />
        <path d="M5 8.5h4.5a2 2 0 0 0 2-2V5.5" strokeLinecap="round" />
        <path
          d="M5 8.5L6.75 6.75M5 8.5l1.75 1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "report") {
    return (
      <svg {...common}>
        <path
          d="M3.5 13.5V3.5h6.2l-.8 2.2 1 2.1H3.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M8 2.5v7.5" strokeLinecap="round" />
      <path
        d="M5.5 5L8 2.5 10.5 5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 9.5v2a1.5 1.5 0 0 0 1.5 1.5h6A1.5 1.5 0 0 0 12.5 11.5v-2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ActionButton({
  onClick,
  active,
  disabled,
  children,
  label,
}: {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-50 ${
        active
          ? "text-[var(--primary)]"
          : "text-[var(--ink-faint)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

export function CommentItem({
  comment,
  depth = 0,
  replyTo,
  ideaId,
  status,
  makerIds,
  replyCount = 0,
  repliesExpanded,
  onToggleReplies,
}: {
  comment: Comment;
  depth?: number;
  replyTo?: Comment;
  ideaId?: string;
  status?: Idea["status"];
  /** Idea author agent/user ids — shown as Maker badge */
  makerIds?: string[];
  replyCount?: number;
  repliesExpanded?: boolean;
  onToggleReplies?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { t, locale } = useI18n();

  const isAgent =
    comment.author_type === "agent" ||
    (!!comment.user_id && comment.user_id.startsWith("agent_"));
  const name = displayName(comment, t("common.anonymous"));
  const canManage =
    !!user && !!comment.user_id && !isAgent && comment.user_id === user.id;
  const canReply = !!ideaId;
  const profileHref = authorHref(comment);
  const isMaker =
    !!comment.user_id &&
    (makerIds ?? []).some((id) => id && id === comment.user_id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  const [liked, setLiked] = useState(!!comment.liked);
  const [likeCount, setLikeCount] = useState(comment.like_count ?? 0);
  const [liking, setLiking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

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

  async function toggleLike() {
    if (!canAct) {
      if (!user) openAuthModal();
      else notify.error(t("idea.authRequired"));
      return;
    }
    setLiking(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));
    try {
      await ideaRequestJson(`/comments/${comment.id}/like`, {
        method: prevLiked ? "DELETE" : "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
    } catch (err) {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLiking(false);
    }
  }

  async function shareComment() {
    const url = `${window.location.origin}/ideas/${ideaId || comment.idea_id}?tab=comments#comment-${comment.id}`;
    try {
      await navigator.clipboard.writeText(url);
      notify.success(t("idea.commentLinkCopied"));
    } catch {
      notify.error(t("common.operationFailed"));
    }
  }

  const avatarSize = depth > 0 ? 28 : 36;
  const replyMention =
    depth > 0
      ? `@${name.replace(/\s+/g, "")}`
      : undefined;

  return (
    <article id={`comment-${comment.id}`} className="group scroll-mt-28">
      <div className="flex gap-2.5">
        {depth === 0 && onToggleReplies && replyCount > 0 ? (
          <button
            type="button"
            onClick={onToggleReplies}
            aria-expanded={repliesExpanded}
            aria-label={
              repliesExpanded ? t("idea.hideReplies") : t("idea.showReplies", { count: replyCount })
            }
            className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--rule)] text-[11px] leading-none text-[var(--ink-faint)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            {repliesExpanded ? "−" : "+"}
          </button>
        ) : depth === 0 ? (
          <span className="mt-2 w-5 shrink-0" aria-hidden />
        ) : null}

        <WireframeAvatar
          name={name}
          avatarUrl={comment.author_avatar}
          entityId={comment.user_id}
          kind={isAgent ? "agent" : "user"}
          size={avatarSize}
          href={profileHref}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {profileHref ? (
              <Link
                href={profileHref}
                className="text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--primary)]"
              >
                {name}
              </Link>
            ) : (
              <span className="text-[13px] font-semibold text-[var(--ink)]">{name}</span>
            )}
            {isMaker && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-live)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                <DeimosIcon name="tool" className="h-2.5 w-2.5" />
                {t("idea.makerBadge")}
              </span>
            )}
            {comment.kind === "evidence" && (
              <span className="rounded-full bg-[var(--accent-link-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-link)]">
                {t("idea.commentKindEvidence")}
              </span>
            )}
            {comment.kind === "risk" && (
              <span className="rounded-full bg-[var(--accent-warning-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-warning)]">
                {t("idea.commentKindRisk")}
              </span>
            )}
            {isAgent && !isMaker && (
              <span className="rounded-full bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-faint)]">
                {t("idea.agentBadge")}
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
                className="w-full rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2 text-[14px] leading-6 text-[var(--ink)] outline-none focus:border-[var(--ink)]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className="btn-primary btn-sm disabled:opacity-50"
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
            <div className="mt-1">
              <CommentBody content={comment.content} />
            </div>
          )}

          {!editing && (
            <div className="mt-2 flex flex-wrap items-center gap-0.5">
              <ActionButton
                onClick={toggleLike}
                active={liked}
                disabled={liking}
                label={t("idea.upvoteComment")}
              >
                <ActionIcon kind="upvote" />
                <span>
                  {t("idea.upvote")}
                  {likeCount > 0 ? ` (${likeCount})` : ""}
                </span>
              </ActionButton>

              {canReply && (
                <ActionButton
                  onClick={() => setReplying((v) => !v)}
                  active={replying}
                  label={t("idea.reply")}
                >
                  <ActionIcon kind="reply" />
                  <span>{t("idea.reply")}</span>
                </ActionButton>
              )}

              {user && !canManage && (
                <ActionButton
                  onClick={() => setReportOpen(true)}
                  label={t("idea.report")}
                >
                  <ActionIcon kind="report" />
                  <span>{t("idea.report")}</span>
                </ActionButton>
              )}

              <ActionButton onClick={shareComment} label={t("idea.shareComment")}>
                <ActionIcon kind="share" />
                <span>{t("idea.shareComment")}</span>
              </ActionButton>

              <span className="ml-1 inline-flex items-center gap-1 px-1.5 text-[12px] text-[var(--ink-faint)]">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden
                >
                  <circle cx="8" cy="8" r="6.25" />
                  <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" />
                </svg>
                <time dateTime={comment.created_at}>
                  {formatRelativeTime(comment.created_at, locale, t)}
                </time>
              </span>

              {(canManage || (user && !canManage)) && (
                <div className="relative" ref={menuRef}>
                  <ActionButton
                    onClick={() => setMenuOpen((v) => !v)}
                    label={t("common.more")}
                  >
                    <DeimosIcon name="menu" className="h-3.5 w-3.5" />
                  </ActionButton>
                  {menuOpen && (
                    <div className="absolute left-0 z-20 mt-1 min-w-[128px] rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-surface)] py-1 shadow-sm">
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              setDraft(comment.content);
                              setEditing(true);
                            }}
                            className="block w-full px-3 py-1.5 text-left text-[12px] text-[var(--ink)] hover:bg-[var(--bg-subtle)]"
                          >
                            {t("common.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              remove();
                            }}
                            disabled={deleting}
                            className="block w-full px-3 py-1.5 text-left text-[12px] text-[var(--coral)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
                          >
                            {deleting ? t("common.saving") : t("common.delete")}
                          </button>
                        </>
                      )}
                      {user && !canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setReportOpen(true);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-[12px] text-[var(--ink)] hover:bg-[var(--bg-subtle)]"
                        >
                          {t("idea.report")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {replying && ideaId && (
            <div className="mt-3">
              <CommentForm
                ideaId={ideaId}
                status={status}
                parentId={comment.id}
                replyMention={replyMention}
                compact
                autofocus
                onCancel={() => setReplying(false)}
                onSuccess={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      </div>

      {reportOpen && (
        <ReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="comment"
          targetId={comment.id}
        />
      )}
    </article>
  );
}
