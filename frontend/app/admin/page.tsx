"use client";

import { useCallback, useEffect, useState } from "react";
import { notify } from "@/components/ui/notify";
import { PasswordInput } from "@/components/ui/password-input";
import { parseResponseError, getErrorMessage } from "@/lib/api-error";
import { getApiBase } from "@/lib/api-base";

interface Comment {
  id: string;
  idea_id: string;
  user_id: string;
  content: string;
  sentiment: string;
  is_moderated: boolean;
  created_at: string;
}

interface AdminCommentsResponse {
  comments: Comment[];
  total: number;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingComments, setLoadingComments] = useState(false);

  const apiBase = getApiBase();

  const loadComments = useCallback(async () => {
    if (!token.trim()) return;
    setLoadingComments(true);
    try {
      const res = await fetch(
        `${apiBase}/admin/comments?moderated=false&limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error(await parseResponseError(res, "加载评论失败"));
      const data = (await res.json()) as AdminCommentsResponse;
      setComments(data.comments ?? []);
      setTotal(data.total ?? data.comments?.length ?? 0);
    } catch (err) {
      notify.error(getErrorMessage(err, "加载评论失败"));
      setComments([]);
      setTotal(0);
    } finally {
      setLoadingComments(false);
    }
  }, [apiBase, token]);

  useEffect(() => {
    if (authenticated) {
      void loadComments();
    }
  }, [authenticated, loadComments]);

  function handleLogin() {
    if (token.trim()) {
      setAuthenticated(true);
    }
  }

  async function moderateComment(commentId: string, hide: boolean) {
    try {
      const res = await fetch(
        `${apiBase}/admin/comments/${commentId}/moderate`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ moderated: hide }),
        }
      );
      if (!res.ok) throw new Error(await parseResponseError(res, "操作失败"));
      notify.success(hide ? "评论已拒绝" : "评论已通过");
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      notify.error(getErrorMessage(err, "操作失败"));
    }
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="page-title text-2xl mb-2">管理后台</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">
          需要管理员 Token 才能访问
        </p>
        <div className="surface-card p-6">
          <label htmlFor="admin-token" className="block text-sm font-medium text-[var(--title)] mb-1.5">
            Admin Token
          </label>
          <div className="flex gap-2">
            <PasswordInput
              id="admin-token"
              name="admin-token"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="JWT Token"
              className="flex-1"
            />
            <button
              onClick={handleLogin}
              className="btn-outline px-4 py-2 text-sm font-medium"
            >
              登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="page-title text-2xl">管理后台</h1>
        <button
          onClick={() => setAuthenticated(false)}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          退出
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="surface-card p-4 text-center">
          <div className="text-2xl font-semibold text-[var(--title)]">{total}</div>
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

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--title)]">待审核评论</h2>
        <button
          onClick={() => void loadComments()}
          disabled={loadingComments}
          className="text-sm text-[var(--primary)] hover:opacity-80 disabled:opacity-50"
        >
          {loadingComments ? "加载中…" : "刷新"}
        </button>
      </div>
      {loadingComments && comments.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-[var(--text-muted)]">加载中…</p>
        </div>
      ) : comments.length === 0 ? (
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
                    idea {comment.idea_id} · by {comment.user_id} · {comment.sentiment}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => moderateComment(comment.id, false)}
                    className="rounded-lg bg-[var(--teal-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal)] hover:opacity-80"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => moderateComment(comment.id, true)}
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
