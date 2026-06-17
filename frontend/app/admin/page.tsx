"use client";

import { useState } from "react";
import { toast } from "sonner";

interface Comment {
  id: string;
  idea_id: string;
  user_id: string;
  content: string;
  sentiment: string;
  is_moderated: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);

  const apiBase =
    (typeof window !== "undefined"
      ? window.__ENV_API_URL__
      : null) || "http://localhost:8080/api";

  function handleLogin() {
    if (token.trim()) {
      setAuthenticated(true);
    }
  }

  async function moderateComment(commentId: string, approved: boolean) {
    try {
      const res = await fetch(
        `${apiBase}/admin/comments/${commentId}/moderate`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ moderated: approved }),
        }
      );
      if (!res.ok) throw new Error("操作失败");
      toast.success(approved ? "评论已通过" : "评论已拒绝");
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-2xl font-semibold text-[var(--title)] mb-2">管理后台</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">
          需要管理员 Token 才能访问
        </p>
        <div className="surface-card p-6">
          <label htmlFor="admin-token" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Admin Token</label>
          <div className="flex gap-2">
            <input
              id="admin-token"
              name="admin-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="JWT Token"
              className="flex-1 rounded-lg border border-[var(--divider)] bg-white px-4 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
            <button
              onClick={handleLogin}
              className="gradient-btn rounded-lg px-4 py-2 text-sm font-medium"
            >
              登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-[var(--title)]">管理后台</h1>
        <button
          onClick={() => setAuthenticated(false)}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          退出
        </button>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="surface-card p-4 text-center">
          <div className="text-2xl font-semibold text-[var(--title)]">-</div>
          <div className="text-xs text-[var(--text-muted)]">待审核评论</div>
        </div>
        <div className="surface-card p-4 text-center">
          <div className="text-2xl font-semibold text-[var(--title)]">-</div>
          <div className="text-xs text-[var(--text-muted)]">活跃想法</div>
        </div>
        <div className="surface-card p-4 text-center">
          <div className="text-2xl font-semibold text-[var(--title)]">-</div>
          <div className="text-xs text-[var(--text-muted)]">注册 Agent</div>
        </div>
      </div>

      {/* Comments list */}
      <h2 className="text-lg font-semibold mb-4 text-[var(--title)]">待审核评论</h2>
      {comments.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-[var(--text-muted)]">暂无待审核评论</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="surface-card p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--title)]">{comment.content}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    by {comment.user_id} · {comment.sentiment}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => moderateComment(comment.id, true)}
                    className="rounded-lg bg-[var(--teal-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal)] hover:opacity-80"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => moderateComment(comment.id, false)}
                    className="rounded-lg bg-[var(--coral-soft)] px-3 py-1.5 text-xs font-medium text-[var(--coral)] hover:opacity-80"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
