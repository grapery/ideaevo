"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { adminRefundApi, ApiRequestError } from "@/lib/api-client";
import { Refund } from "@/lib/types";
import { DeimosIcon } from "@/components/deimos-icon";
import { SystemPageHeader } from "@/components/system-page-header";

// 格式化最小货币单位为展示金额
function formatPrice(units: number, currency: string): string {
  const value = (units / 100).toFixed(2);
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
  return `${symbol}${value}`;
}

function refundStatusText(status: string): string {
  switch (status) {
    case "pending": return "审批中";
    case "approved": return "已批准";
    case "rejected": return "已拒绝";
    default: return status;
  }
}

export default function AdminRefundsPage() {
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
      const msg = err instanceof ApiRequestError ? err.message : "加载失败";
      setError(msg);
    }
  }, []);

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
      const msg = err instanceof ApiRequestError ? err.message : "操作失败";
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
      const msg = err instanceof ApiRequestError ? err.message : "操作失败";
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
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container max-w-4xl py-8">
        <SystemPageHeader
          eyebrow="ADMIN / REVIEW QUEUE"
          title="退款审批"
          description="每个审批决定都会改变订单和会员有效期。请在确认支付上下文与退款原因后记录处理结论。"
          icon="decision"
          backHref="/admin"
          backLabel="返回管理后台"
          actions={
            <span className="meta-label inline-flex items-center gap-2 rounded-full border border-[var(--rule)] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-warning)]" />
              {total} PENDING
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
            <p className="font-medium text-[var(--ink)]">审批队列已清空</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              暂无待审批的退款申请
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
                        {refundStatusText(refund.status)}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-[var(--ink-soft)]">
                      <div>
                        <span className="text-[var(--text-muted)]">订单 ID：</span>
                        <code className="text-xs">{refund.order_id}</code>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">用户 ID：</span>
                        <code className="text-xs">{refund.user_id}</code>
                      </div>
                      {refund.reason && (
                        <div>
                          <span className="text-[var(--text-muted)]">退款原因：</span>
                          {refund.reason}
                        </div>
                      )}
                      <div className="text-xs text-[var(--text-muted)]">
                        申请时间：{new Date(refund.created_at).toLocaleString("zh-CN")}
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
                      placeholder="审批备注（选填）"
                      className="text-xs p-1.5 rounded border border-[var(--rule)] bg-transparent text-[var(--title)]"
                    />
                    <button
                      type="button"
                      disabled={loading && actionID === refund.id}
                      onClick={() => handleApprove(refund.id)}
                      className="btn-primary text-xs py-1.5"
                    >
                      批准退款
                    </button>
                    <button
                      type="button"
                      disabled={loading && actionID === refund.id}
                      onClick={() => handleReject(refund.id)}
                      className="btn-outline text-xs py-1.5"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-xs text-[var(--text-muted)] text-center">
          批准退款将撤销该订单赋予的会员有效期；拒绝则会员状态保持不变。
        </div>
      </div>
    </div>
  );
}
