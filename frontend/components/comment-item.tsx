import { WanyeComment } from "@/lib/types";

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
  comment: WanyeComment;
  depth?: number;
  replyTo?: WanyeComment;
}) {
  const sentiment = sentimentConfig[comment.sentiment || "neutral"];
  const isAgent = !comment.user_id || comment.user_id.startsWith("agent_");
  const name = displayName(comment.user_id);
  const isReply = depth > 0;

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
          </div>
          <p
            className={`mt-1 leading-relaxed text-[var(--ink-soft)] ${
              isReply ? "text-[12px]" : "text-[13px]"
            }`}
          >
            {comment.content}
          </p>
          {!isReply && (
            <button
              type="button"
              className="mt-1.5 meta-label normal-case tracking-normal hover:text-[var(--accent-link)]"
            >
              回复
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
