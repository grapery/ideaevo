"use client";

import { useMemo, useState } from "react";
import { Comment } from "@/lib/types";
import { CommentItem } from "./comment-item";
import { useI18n } from "@/lib/i18n/provider";
import type { Idea } from "@/lib/types";

export interface FlatComment {
  comment: Comment;
  depth: number;
  replyTo?: Comment;
}

/** 将嵌套回复平铺为一维列表，回复以缩进展示（兼容旧调用）。 */
export function flattenComments(comments: Comment[]): FlatComment[] {
  const result: FlatComment[] = [];

  for (const comment of comments) {
    result.push({ comment, depth: 0 });
    if (comment.replies?.length) {
      for (const reply of comment.replies) {
        result.push({ comment: reply, depth: 1, replyTo: comment });
      }
    }
  }

  return result;
}

function threadScore(comment: Comment): number {
  const replies = comment.replies ?? [];
  const replyLikes = replies.reduce((sum, r) => sum + (r.like_count ?? 0), 0);
  return (comment.like_count ?? 0) * 3 + replies.length + replyLikes;
}

function CommentThread({
  comment,
  ideaId,
  status,
  makerIds,
}: {
  comment: Comment;
  ideaId?: string;
  status?: Idea["status"];
  makerIds?: string[];
}) {
  const { t } = useI18n();
  const replies = comment.replies ?? [];
  const [expanded, setExpanded] = useState(true);
  const [visibleReplies, setVisibleReplies] = useState(
    Math.min(4, replies.length),
  );

  const shownReplies = expanded ? replies.slice(0, visibleReplies) : [];
  const hiddenCount = expanded ? Math.max(0, replies.length - visibleReplies) : 0;

  return (
    <div className="py-5 first:pt-2">
      <CommentItem
        comment={comment}
        depth={0}
        ideaId={ideaId}
        status={status}
        makerIds={makerIds}
        replyCount={replies.length}
        repliesExpanded={expanded}
        onToggleReplies={
          replies.length > 0 ? () => setExpanded((v) => !v) : undefined
        }
      />

      {shownReplies.length > 0 && (
        <div className="relative ml-[1.875rem] mt-4 space-y-5 border-l border-[var(--rule)] pl-5 sm:ml-[2.125rem]">
          {shownReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={1}
              replyTo={comment}
              ideaId={ideaId}
              status={status}
              makerIds={makerIds}
            />
          ))}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() =>
                setVisibleReplies((n) => Math.min(n + 6, replies.length))
              }
              className="text-[12px] font-medium text-[var(--primary)] hover:underline"
            >
              {t("idea.moreReplies", { count: hiddenCount })}
            </button>
          )}
        </div>
      )}

      {!expanded && replies.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="ml-[1.875rem] mt-3 text-[12px] font-medium text-[var(--primary)] hover:underline sm:ml-[2.125rem]"
        >
          {t("idea.showReplies", { count: replies.length })}
        </button>
      )}
    </div>
  );
}

export function CommentList({
  comments,
  ideaId,
  status,
  makerIds,
  initialVisible = 8,
  sort = "top",
  onSortChange,
}: {
  comments: Comment[];
  ideaId?: string;
  status?: Idea["status"];
  makerIds?: string[];
  /** 详情页预览条数；传 Infinity / 很大数字可展示全部 */
  initialVisible?: number;
  sort?: "top" | "newest";
  onSortChange?: (sort: "top" | "newest") => void;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(
    Math.min(initialVisible, comments.length),
  );

  const ordered = useMemo(() => {
    const copy = [...comments];
    if (sort === "newest") {
      copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else {
      copy.sort((a, b) => {
        const score = threadScore(b) - threadScore(a);
        if (score !== 0) return score;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    }
    return copy;
  }, [comments, sort]);

  if (comments.length === 0) return null;

  const shown = ordered.slice(0, visible);
  const remaining = ordered.length - visible;

  return (
    <div>
      {onSortChange && (
        <div className="mb-2 flex items-center gap-1 border-b border-[var(--rule-light)] pb-3">
          {(
            [
              ["top", t("idea.sortTop")],
              ["newest", t("idea.sortNewest")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onSortChange(value)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                sort === value
                  ? "bg-[var(--panel-inverse)] text-white"
                  : "text-[var(--ink-faint)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="divide-y divide-[var(--rule-light)]">
        {shown.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            ideaId={ideaId}
            status={status}
            makerIds={makerIds}
          />
        ))}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisible((n) => Math.min(n + 8, ordered.length))}
          className="mt-3 w-full rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] font-medium text-[var(--primary)] hover:bg-[var(--bg-subtle)]"
        >
          {t("idea.showMoreComments", { count: remaining })}
        </button>
      )}
    </div>
  );
}
