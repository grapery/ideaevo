"use client";

import { useState } from "react";
import { Comment } from "@/lib/types";
import { CommentList } from "@/components/comment-list";
import { CommentForm } from "@/app/ideas/[id]/comments/comment-form";
import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/lib/i18n/provider";
import type { Idea } from "@/lib/types";

/** Product Hunt–style discussion panel: composer on top, sort + threaded comments. */
export function DiscussionPanel({
  ideaId,
  status,
  comments,
  makerIds,
  initialVisible = 8,
  hint,
}: {
  ideaId: string;
  status?: Idea["status"];
  comments: Comment[];
  makerIds?: string[];
  initialVisible?: number;
  hint?: string;
}) {
  const { t } = useI18n();
  const [sort, setSort] = useState<"top" | "newest">("top");
  const total =
    comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0) ||
    comments.length;

  return (
    <section id="comments" className="scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-[var(--ink)]">
            {t("idea.discussion")}
            {total > 0 && (
              <span className="ml-2 font-code text-[14px] font-normal tabular-nums text-[var(--ink-faint)]">
                {total}
              </span>
            )}
          </h2>
          {(hint || t("idea.discussionHint")) && (
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
              {hint || t("idea.discussionHint")}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <CommentForm ideaId={ideaId} status={status} />
      </div>

      {comments.length === 0 ? (
        <EmptyState
          icon="comment"
          title={t("idea.noComments")}
          variant="dashed"
        />
      ) : (
        <CommentList
          comments={comments}
          ideaId={ideaId}
          status={status}
          makerIds={makerIds}
          initialVisible={initialVisible}
          sort={sort}
          onSortChange={setSort}
        />
      )}
    </section>
  );
}
