import { WanyeComment } from "@/lib/types";
import { CommentItem } from "./comment-item";

export interface FlatComment {
  comment: WanyeComment;
  depth: number;
  replyTo?: WanyeComment;
}

/** 将嵌套回复平铺为一维列表，回复以缩进展示 */
export function flattenComments(comments: WanyeComment[]): FlatComment[] {
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

export function CommentList({ comments }: { comments: WanyeComment[] }) {
  if (comments.length === 0) return null;

  const flat = flattenComments(comments);

  return (
    <div className="space-y-2">
      {flat.map(({ comment, depth, replyTo }) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          depth={depth}
          replyTo={replyTo}
        />
      ))}
    </div>
  );
}
