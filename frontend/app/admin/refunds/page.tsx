"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { adminRefundApi, ApiRequestError } from "@/lib/api-client";
import { Refund } from "@/lib/types";
import { DeimosIcon } from "@/components/deimos-icon";
import { SystemPageHeader } from "@/components/system-page-header";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

// 格式化最小货币单位为展示金额
function formatPrice(units: number, currency: string): string {
  const value = (units / 100).toFixed(2);
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
  return `${symbol}${value}`;
}

const REFUND_STATUS_KEY: Record<string, TranslationKey> = {
  pending: "billing.statusReviewing",
  approved: "billing.statusApproved",
  rejected: "billing.statusRejected",
};

export default function AdminRefundsPage() {
  const { t, locale } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionID, setActionID] = useState(""); // 当前操作的退款 ID
  const [note, setNote] = useState("");

  const loadRefunds = useCallback(async () => {
    try {
      const res = await adminRefundApi.listPending(50);
      setRefunds(res.refunds);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : t("common.operationFailed");
      setError(msg);
    }
  }, [t]);

  useEffect(() => {
    if (authLoading) return;
    // 非管理员或未登录跳转
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      router.push("/");
      return;
    }
    loadRefunds();
  }, [user, authLoading, router, loadRefunds]);

  const handleApprove = async (id: string) => {
    setActionID(id);
    setLoading(true);
    setError("");
    try {
      await adminRefundApi.approve(id, note);
      setNote("");
      await loadRefunds();
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : t("common.operationFailed");
      setError(msg);
    } finally {
      setActionID("");
      setLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setActionID(id);
    setLoading(true);
    setError("");
    try {
      await adminRefundApi.reject(id, note);
      setNote("");
      await loadRefunds();
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : t("common.operationFailed");
      setError(msg);
    } finally {
      setActionID("");
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container page-pad">
        <div className="mx-auto max-w-3xl">
        <SystemPageHeader
          eyebrow={t("admin.reviewEyebrow")}
          title={t("admin.refundReview")}
          description={t("admin.refundDesc")}
          icon="decision"
          backHref="/admin"
          backLabel={t("admin.backToAdmin")}
          actions={
            <span className="meta-label inline-flex items-center gap-2 rounded-full border border-[var(--rule)] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-warning)]" />
              {t("admin.pendingBadge", { count: total })}
            </span>
          }
        />

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--accent-error)]/10 text-sm text-[var(--accent-error)]">
            {error}
          </div>
        )}

        {refunds.length === 0 ? (
          <div className="surface-card p-12 text-center">
            <DeimosIcon
              name="evidence"
              className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]"
            />
            <p className="font-medium text-[var(--ink)]">{t("admin.queueClearedShort")}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {t("admin.noRefunds")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {refunds.map((refund) => (
              <div key={refund.id} className="surface-card p-4">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--title)] font-semibold">
                        {formatPrice(refund.amount, refund.currency)}
                      </span>
                      <span className="badge-pill badge-active">
                        {t(REFUND_STATUS_KEY[refund.status] ?? "billing.statusReviewing")}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-[var(--ink-soft)]">
                      <div>
                        <span className="text-[var(--text-muted)]">{t("admin.orderId")}</span>
                        <code className="text-xs">{refund.order_id}</code>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">{t("admin.userId")}</span>
                        <code className="text-xs">{refund.user_id}</code>
                      </div>
                      {refund.reason && (
                        <div>
                          <span className="text-[var(--text-muted)]">{t("admin.refundReason")}</span>
                          {refund.reason}
                        </div>
                      )}
                      <div className="text-xs text-[var(--text-muted)]">
                        {t("admin.requestTime")}{new Date(refund.created_at).toLocaleString(locale)}
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-40">
                    <input
                      type="text"
                      value={actionID === refund.id ? note : ""}
                      onChange={(e) => {
                        setActionID(refund.id);
                        setNote(e.target.value);
                      }}
                      placeholder={t("admin.reviewNotePlaceholder")}
                      className="text-xs p-1.5 rounded border border-[var(--rule)] bg-transparent text-[var(--title)]"
                    />
                    <button
                      type="button"
                      disabled={loading && actionID === refund.id}
                      onClick={() => handleApprove(refund.id)}
                      className="btn-primary text-xs py-1.5"
                    >
                      {t("admin.approveRefund")}
                    </button>
                    <button
                      type="button"
                      disabled={loading && actionID === refund.id}
                      onClick={() => handleReject(refund.id)}
                      className="btn-outline text-xs py-1.5"
                    >
                      {t("admin.reject")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-center text-xs text-[var(--ink-faint)]">
          {t("admin.approveHint")}
        </div>
        </div>
      </div>
    </div>
  );
}
