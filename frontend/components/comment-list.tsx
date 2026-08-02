"use client";

import { useState } from "react";
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

function CommentThread({
  comment,
  ideaId,
  status,
}: {
  comment: Comment;
  ideaId?: string;
  status?: Idea["status"];
}) {
  const replies = comment.replies ?? [];
  const [expanded, setExpanded] = useState(replies.length > 0 && replies.length <= 3);

  return (
    <div className="space-y-0">
      <CommentItem
        comment={comment}
        depth={0}
        ideaId={ideaId}
        status={status}
        replyCount={replies.length}
        repliesExpanded={expanded}
        onToggleReplies={
          replies.length > 0 ? () => setExpanded((v) => !v) : undefined
        }
      />
      {expanded && replies.length > 0 && (
        <div className="ml-3 mt-1 space-y-0 border-l border-[var(--rule)] pl-3">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={1}
              replyTo={comment}
              ideaId={ideaId}
              status={status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentList({
  comments,
  ideaId,
  status,
  initialVisible = 8,
}: {
  comments: Comment[];
  ideaId?: string;
  status?: Idea["status"];
  /** 详情页预览条数；传 Infinity / 很大数字可展示全部 */
  initialVisible?: number;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(
    Math.min(initialVisible, comments.length)
  );

  if (comments.length === 0) return null;

  const shown = comments.slice(0, visible);
  const remaining = comments.length - visible;

  return (
    <div className="space-y-3">
      {shown.map((comment) => (
        <CommentThread
          key={comment.id}
          comment={comment}
          ideaId={ideaId}
          status={status}
        />
      ))}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisible((n) => Math.min(n + 8, comments.length))}
          className="w-full surface-card px-3 py-2.5 text-[13px] font-medium text-[var(--accent-link)] hover:border-[var(--accent-link)] hover:bg-[var(--bg-subtle)]"
        >
          {t("idea.showMoreComments", { count: remaining })}
        </button>
      )}
    </div>
  );
}
