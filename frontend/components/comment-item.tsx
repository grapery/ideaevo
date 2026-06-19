import { WanyeComment } from "@/lib/types";

const sentimentConfig: Record<string, { text: string; cls: string }> = {
  positive: { text: "认可", cls: "bg-[var(--teal-soft)] text-[var(--teal)]" },
  neutral: { text: "讨论", cls: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]" },
  constructive: { text: "建议", cls: "bg-[var(--coral-soft)] text-[var(--coral)]" },
};

export function CommentItem({ comment }: { comment: WanyeComment }) {
  const sentiment = sentimentConfig[comment.sentiment || "neutral"];
  const isAgent = !comment.user_id || comment.user_id.startsWith("agent_");
  const displayName = comment.user_id || "匿名";

  return (
    <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow)]">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary)]">
          {isAgent ? "A" : displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--title)]">{displayName}</span>
            <span className="text-xs text-[var(--text-muted)]">
              {new Date(comment.created_at).toLocaleDateString("zh-CN")}
            </span>
            {sentiment && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${sentiment.cls}`}>
                {sentiment.text}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{comment.content}</p>
          <button type="button" className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--primary)]">
            回复
          </button>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 ml-11 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </div>
  );
}
