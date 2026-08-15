"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notify } from "@/components/ui/notify";
import { PasswordInput } from "@/components/ui/password-input";
import { parseResponseError, getErrorMessage } from "@/lib/api-error";
import { getApiBase } from "@/lib/api-base";
import { EmptyState } from "@/components/empty-state";
import { DeimosIcon } from "@/components/deimos-icon";
import { SystemPageHeader } from "@/components/system-page-header";
import { useI18n } from "@/lib/i18n/provider";

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
  const { t } = useI18n();
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
      if (!res.ok) throw new Error(await parseResponseError(res, t("common.operationFailed")));
      const data = (await res.json()) as AdminCommentsResponse;
      setComments(data.comments ?? []);
      setTotal(data.total ?? data.comments?.length ?? 0);
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
      setComments([]);
      setTotal(0);
    } finally {
      setLoadingComments(false);
    }
  }, [apiBase, token, t]);

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
      if (!res.ok) throw new Error(await parseResponseError(res, t("common.operationFailed")));
      notify.success(hide ? t("admin.commentRejected") : t("admin.commentApproved"));
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    }
  }

  if (!authenticated) {
    return (
      <div className="page-shell-full">
        <div className="page-container page-pad">
        <SystemPageHeader
          eyebrow={t("admin.eyebrow")}
          title={t("admin.title")}
          description={t("admin.desc")}
          icon="decision"
          backHref="/"
          backLabel={t("admin.backHome")}
        />
        <div className="grid gap-4 md:grid-cols-[1fr_1.35fr]">
          <div className="panel-inverse p-5">
            <DeimosIcon name="shield" className="mb-8 h-5 w-5 panel-inverse-accent" />
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
              {t("admin.protectedSurface")}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/75">
              {t("admin.tokenHint")}
            </p>
          </div>
          <div className="surface-card p-6">
          <label htmlFor="admin-token" className="block text-sm font-medium text-[var(--title)] mb-1.5">
            {t("admin.tokenLabel")}
          </label>
          <p className="mb-4 text-xs leading-5 text-[var(--text-muted)]">
            {t("admin.tokenPlaceholder")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PasswordInput
              id="admin-token"
              name="admin-token"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("admin.tokenInputPlaceholder")}
              className="flex-1"
            />
            <button
              onClick={handleLogin}
              className="btn-outline px-4 py-2 text-sm font-medium"
            >
              {t("admin.signIn")}
            </button>
          </div>
        </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
      <SystemPageHeader
        eyebrow={t("admin.eyebrow")}
        title={t("admin.queue")}
        description={t("admin.queueDesc")}
        icon="decision"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/refunds" className="btn-outline btn-sm">
              <DeimosIcon name="evidence" className="h-3.5 w-3.5" />
              {t("admin.refundReview")}
            </Link>
            <button
              onClick={() => setAuthenticated(false)}
              className="btn-default btn-sm"
            >
              {t("admin.exit")}
            </button>
          </div>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="surface-card p-4 text-center">
          <div className="text-2xl font-semibold text-[var(--title)]">{total}</div>
          <div className="text-xs text-[var(--text-muted)]">{t("admin.pendingComments")}</div>
        </div>
        <div className="surface-card p-4 text-center">
          <div className="text-2xl font-semibold text-[var(--title)]">-</div>
          <div className="text-xs text-[var(--text-muted)]">{t("admin.activeIdeas")}</div>
        </div>
        <div className="surface-card p-4 text-center">
          <div className="text-2xl font-semibold text-[var(--title)]">-</div>
          <div className="text-xs text-[var(--text-muted)]">{t("admin.registeredAgents")}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--title)]">{t("admin.pendingComments")}</h2>
        <button
          onClick={() => void loadComments()}
          disabled={loadingComments}
          className="text-sm text-[var(--primary)] hover:opacity-80 disabled:opacity-50"
        >
          {loadingComments ? t("common.loading") : t("common.refresh")}
        </button>
      </div>
      {loadingComments && comments.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-[var(--text-muted)]">{t("common.loading")}</p>
        </div>
      ) : comments.length === 0 ? (
        <EmptyState icon="evidence" title={t("admin.queueCleared")} hint={t("admin.noPending")} />
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="surface-card p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--title)]">{comment.content}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    idea {comment.idea_id} · by {comment.user_id} · {comment.sentiment}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => moderateComment(comment.id, false)}
                    className="rounded-lg bg-[var(--teal-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal)] hover:opacity-80"
                  >
                    {t("admin.approve")}
                  </button>
                  <button
                    onClick={() => moderateComment(comment.id, true)}
                    className="rounded-lg bg-[var(--coral-soft)] px-3 py-1.5 text-xs font-medium text-[var(--coral)] hover:opacity-80"
                  >
                    {t("admin.reject")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
