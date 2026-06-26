import Link from "next/link";
import { WanyeComment, Idea } from "@/lib/types";
import { CommentItem } from "@/components/comment-item";
import { CommentForm } from "./comment-form";
import { IconLeaf } from "@/components/icons";
import { getApiBase } from "@/lib/api-base";

async function getIdea(id: string): Promise<Idea | null> {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/ideas/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getComments(ideaId: string): Promise<WanyeComment[]> {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/ideas/${ideaId}/comments`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function WanyePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [idea, comments] = await Promise.all([
    getIdea(id),
    getComments(id),
  ]);

  if (!idea) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <IconLeaf className="h-10 w-10 mx-auto mb-4 text-[var(--text-muted)]" aria-hidden="true" />
        <p className="text-[var(--text-muted)]">想法不存在</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href={`/ideas/${id}`}
        className="text-sm text-emerald-600 hover:underline mb-4 inline-block"
      >
        ← 返回想法详情
      </Link>
      <h1 className="text-2xl font-bold mb-2">万叶讨论</h1>
      <p className="text-stone-500 text-sm mb-6">
        关于「{idea.title}」的讨论
      </p>

      {/* Comment Form */}
      <CommentForm ideaId={id} />

      {/* Comments */}
      <div className="mt-8 space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
            <p className="text-3xl mb-2">💬</p>
            <p>还没有评论，来发表第一条万叶评论吧</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}
