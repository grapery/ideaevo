"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLink } from "@/components/app-link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { billingApi, ApiRequestError } from "@/lib/api-client";
import { BillingPlan, MembershipView, PlansResponse, CreateOrderResult, BillingOrder, Refund } from "@/lib/types";
import { DeimosIcon } from "@/components/deimos-icon";
import { SystemPageHeader } from "@/components/system-page-header";

// 格式化最小货币单位为展示金额：1990 + CNY -> "¥19.90"，990 + USD -> "$9.90"
function formatPrice(units: number, currency: string): string {
  const value = (units / 100).toFixed(2);
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
  return `${symbol}${value}`;
}

// 格式化 token 数：10000 -> "1万"，10000000 -> "1000万"
function formatTokens(n: number): string {
  if (n >= 10000) {
    return `${Math.floor(n / 10000)}万`;
  }
  return String(n);
}

// 订单状态中文文案
function orderStatusText(status: string): string {
  switch (status) {
    case "paid": return "已支付";
    case "pending": return "待支付";
    case "failed": return "已取消";
    case "refunded": return "已退款";
    default: return status;
  }
}

// 退款状态中文文案
function refundStatusText(status: string): string {
  switch (status) {
    case "pending": return "审批中";
    case "approved": return "已批准";
    case "rejected": return "已拒绝";
    default: return status;
  }
}

function PlanFeature({
  children,
  available = true,
}: {
  children: React.ReactNode;
  available?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-2 ${
        available ? "text-[var(--ink-soft)]" : "text-[var(--text-muted)]"
      }`}
    >
      <DeimosIcon
        name={available ? "check" : "lock"}
        className="mt-0.5 h-3.5 w-3.5"
      />
      <span>{children}</span>
    </li>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [membership, setMembership] = useState<MembershipView | null>(null);
  const [currency, setCurrency] = useState<string>("CNY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingOrder, setPendingOrder] = useState<CreateOrderResult | null>(null);
  const [payMsg, setPayMsg] = useState("");
  // 订单与退款记录
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [refundOrderID, setRefundOrderID] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundError, setRefundError] = useState("");
  const [refundMsg, setRefundMsg] = useState("");

  const loadData = useCallback(async () => {
    const [plansRes, memRes, ordersRes, refundsRes] = await Promise.all([
      billingApi.plans(),
      billingApi.membership().catch(() => null),
      billingApi.listOrders(50).catch(() => ({ orders: [], total: 0 })),
      billingApi.listRefunds(50).catch(() => ({ refunds: [], total: 0 })),
    ]);
    setPlans(plansRes);
    setMembership(memRes);
    setOrders(ordersRes.orders);
    setRefunds(refundsRes.refunds);
  }, []);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    loadData();
  }, [user, router, loadData]);

  const handleSubscribe = async (plan: BillingPlan) => {
    if (!user) return;
    setLoading(true);
    setError("");
    setPayMsg("");
    try {
      const result = await billingApi.createOrder({
        plan_id: plan.id,
        currency,
      });
      setPendingOrder(result);

      // mock 网关：不跳转，留在页面等待用户点「模拟支付」
      // 真实网关：跳转到支付页 / 展示二维码
      if (result.gateway === "mock") {
        setPayMsg("演示环境：点击下方按钮模拟支付完成");
      } else if (result.payment_url) {
        // alipay / stripe 返回网页 URL，直接跳转
        if (result.gateway === "stripe" || result.gateway === "alipay") {
          window.location.href = result.payment_url;
        } else {
          // wechat 返回 code_url，需前端渲染二维码（这里提示）
          setPayMsg("请使用微信扫描二维码完成支付：" + result.payment_url);
        }
      }
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : "下单失败，请重试";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleMockPay = async () => {
    if (!pendingOrder) return;
    setLoading(true);
    setError("");
    try {
      await billingApi.mockPay(pendingOrder.order.id);
      setPayMsg("支付成功，会员已激活");
      setPendingOrder(null);
      await loadData(); // 刷新会员状态
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : "支付失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 申请退款：对已支付订单提交退款申请，进入待审批
  const handleRequestRefund = async () => {
    if (!refundOrderID) return;
    setLoading(true);
    setRefundError("");
    setRefundMsg("");
    try {
      await billingApi.requestRefund(refundOrderID, refundReason);
      setRefundMsg("退款申请已提交，等待管理员审批");
      setRefundOrderID("");
      setRefundReason("");
      await loadData(); // 刷新订单与退款列表
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : "申请失败";
      setRefundError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  const quotaPercent = membership?.daily_quota.tokens_limit
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (membership.daily_quota.tokens_left /
              membership.daily_quota.tokens_limit) *
              100
          )
        )
      )
    : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container max-w-4xl py-8">
        <SystemPageHeader
          eyebrow="ACCOUNT / BILLING"
          title="用量、套餐与订单"
          description="额度同时服务于人类账户和正在执行任务的 Agent。升级后可创建更多 Agent，并通过 MCP、REST 与 A2A 持续推进 idea。"
          icon="wish"
          backHref={`/users/${user.id}`}
          backLabel="返回我的主页"
        />

        {/* 当前会员状态 */}
        {membership && (
          <div className="mb-8 overflow-hidden rounded-[var(--radius-card)] bg-[var(--ink)] p-5 text-white sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
                  Shared execution quota
                </p>
                <h2 className="mt-1 text-lg font-semibold">今日执行额度</h2>
              </div>
              <span
                className="rounded-full border border-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/80"
              >
                {membership.is_pro ? "Pro 会员" : "免费用户"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1.35fr_1fr_1fr]">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-2xl font-semibold">
                    {formatTokens(membership.daily_quota.tokens_left)}
                  </span>
                  <span className="font-mono text-[10px] text-white/55">
                    {quotaPercent}% REMAINING
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-[#9aff39]"
                    style={{ width: `${quotaPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/55">
                  每日上限 {formatTokens(membership.daily_quota.tokens_limit)} Token
                </p>
              </div>
              <div className="border-t border-white/15 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                <div className="text-xl font-semibold">
                  {membership.agent_count}
                  <span className="text-sm font-normal text-white/45">
                    {" "}/ {membership.max_agents}
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/55">已创建 Agent</div>
              </div>
              <div className="border-t border-white/15 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                <div className="flex items-center gap-2 text-xl font-semibold">
                  <DeimosIcon name="tool" className="h-4 w-4 text-[#9aff39]" />
                  {membership.is_pro ? "Enabled" : "Limited"}
                </div>
                <div className="mt-1 text-xs text-white/55">MCP / Agent access</div>
              </div>
            </div>
          </div>
        )}

        {/* 套餐对比 */}
        {plans && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* 免费版 */}
            <div className="surface-card p-6">
              <h3 className="text-lg font-semibold text-[var(--title)]">免费版</h3>
              <div className="mt-2 text-3xl font-bold text-[var(--title)]">¥0</div>
              <p className="text-sm text-[var(--text-muted)] mt-1">永久免费</p>
              <ul className="mt-4 space-y-2 text-sm">
                <PlanFeature>每日 {formatTokens(plans.free.daily_tokens)} Token</PlanFeature>
                <PlanFeature>浏览想法、关注、点赞</PlanFeature>
                <PlanFeature available={false}>不能创建 Agent</PlanFeature>
                <PlanFeature available={false}>不能使用 MCP 服务</PlanFeature>
              </ul>
            </div>

            {/* Pro 版 */}
            {plans.plans.map((plan) => (
              <div
                key={plan.id}
                className="surface-card-elevated p-6 ring-1 ring-[var(--primary)]/30"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[var(--title)]">Pro 会员</h3>
                  <span className="badge-pill badge-active">推荐</span>
                </div>
                <div className="mt-2 text-3xl font-bold text-[var(--title)]">
                  {formatPrice(plan.prices[currency] || 0, currency)}
                  <span className="text-sm font-normal text-[var(--text-muted)]">
                    {" "}/ {plan.duration_days} 天
                  </span>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  <PlanFeature>每日 {formatTokens(plan.daily_tokens)} Token</PlanFeature>
                  <PlanFeature>可创建最多 {plan.max_agents} 个 Agent</PlanFeature>
                  <PlanFeature>可使用 MCP 服务</PlanFeature>
                  <PlanFeature>所有免费版功能</PlanFeature>
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* 币种选择 + 购买 */}
        {plans && plans.plans.length > 0 && (
          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-[var(--text-muted)]">支付币种</span>
              <div className="flex gap-1">
                {plans.currencies.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      currency === c
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--rule)]/30 text-[var(--ink-soft)] hover:bg-[var(--rule)]/50"
                    }`}
                  >
                    {c === "CNY" ? "人民币 ¥" : "美元 $"}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-3 text-sm text-[var(--accent-error)]">{error}</div>
            )}

            {!pendingOrder ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => plans.plans[0] && handleSubscribe(plans.plans[0])}
                className="btn-primary w-full"
              >
                {loading ? "处理中..." : `立即开通 Pro · ${formatPrice(plans.plans[0].prices[currency] || 0, currency)}`}
              </button>
            ) : (
              <div className="space-y-3">
                {payMsg && (
                  <div className="text-sm text-[var(--ink-soft)] p-3 rounded-md bg-[var(--rule)]/20">
                    {payMsg}
                  </div>
                )}
                {pendingOrder.gateway === "mock" && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleMockPay}
                    className="btn-primary w-full"
                  >
                    {loading ? (
                      "处理中..."
                    ) : (
                      <>
                        <DeimosIcon name="check" className="h-4 w-4" />
                        模拟支付完成
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPendingOrder(null)}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--ink)] w-full text-center"
                >
                  取消
                </button>
              </div>
            )}

            <p className="mt-3 text-xs text-[var(--text-muted)] text-center">
              购买后 30 天内有效，到期需手动续期，不自动扣费
            </p>
          </div>
        )}

        {/* 订单与退款管理 */}
        {orders.length > 0 && (
          <div className="mt-8 surface-card p-5">
            <h2 className="text-sm font-medium text-[var(--ink-soft)] mb-4">我的订单</h2>
            <div className="space-y-2">
              {orders.map((order) => {
                // 该订单是否已有退款申请（任一状态）
                const orderRefund = refunds.find((r) => r.order_id === order.id);
                const canRefund =
                  order.status === "paid" && !orderRefund;
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between text-sm py-2 border-b border-[var(--rule)]/30 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[var(--title)] font-medium">
                        {formatPrice(order.amount, order.currency)}
                        <span className="ml-2 text-xs text-[var(--text-muted)]">
                          {order.plan_id}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {new Date(order.created_at).toLocaleString("zh-CN")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge-pill ${
                          order.status === "paid"
                            ? "badge-active"
                            : order.status === "refunded"
                              ? "badge-muted"
                              : ""
                        }`}
                      >
                        {orderStatusText(order.status)}
                      </span>
                      {canRefund && (
                        <button
                          type="button"
                          onClick={() => setRefundOrderID(order.id)}
                          className="text-xs text-[var(--accent-warning)] hover:underline"
                        >
                          申请退款
                        </button>
                      )}
                      {orderRefund && (
                        <span
                          className={`badge-pill ${
                            orderRefund.status === "approved"
                              ? "badge-muted"
                              : orderRefund.status === "rejected"
                                ? ""
                                : "badge-active"
                          }`}
                        >
                          退款{refundStatusText(orderRefund.status)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 退款申请表单 */}
        {refundOrderID && (
          <div className="mt-4 surface-card-elevated p-5">
            <h3 className="text-sm font-medium text-[var(--ink-soft)] mb-3">申请退款</h3>
            {refundError && (
              <div className="mb-3 text-sm text-[var(--accent-error)]">{refundError}</div>
            )}
            {refundMsg && (
              <div className="mb-3 text-sm text-[var(--ink-soft)]">{refundMsg}</div>
            )}
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="请填写退款原因（选填）"
              className="w-full text-sm p-2 rounded-md border border-[var(--rule)] bg-transparent text-[var(--title)] resize-none"
              rows={3}
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                disabled={loading}
                onClick={handleRequestRefund}
                className="btn-primary flex-1"
              >
                {loading ? "提交中..." : "提交退款申请"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRefundOrderID("");
                  setRefundReason("");
                  setRefundError("");
                  setRefundMsg("");
                }}
                className="btn-outline"
              >
                取消
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              退款申请提交后需等待管理员审批。批准后将撤销该订单赋予的会员有效期。
            </p>
          </div>
        )}

        {/* 退款记录 */}
        {refunds.length > 0 && (
          <div className="mt-4 surface-card p-5">
            <h2 className="text-sm font-medium text-[var(--ink-soft)] mb-4">退款记录</h2>
            <div className="space-y-2">
              {refunds.map((refund) => (
                <div
                  key={refund.id}
                  className="text-sm py-2 border-b border-[var(--rule)]/30 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--title)] font-medium">
                      {formatPrice(refund.amount, refund.currency)}
                    </span>
                    <span
                      className={`badge-pill ${
                        refund.status === "approved"
                          ? "badge-muted"
                          : refund.status === "rejected"
                            ? ""
                            : "badge-active"
                      }`}
                    >
                      {refundStatusText(refund.status)}
                    </span>
                  </div>
                  {refund.reason && (
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      原因：{refund.reason}
                    </div>
                  )}
                  {refund.admin_note && (
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      审批备注：{refund.admin_note}
                    </div>
                  )}
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    {new Date(refund.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 订单说明 */}
        <div className="mt-6 text-center">
          <AppLink
            href={`/users/${user.id}`}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)]"
          >
            查看我的主页会员状态 →
          </AppLink>
        </div>
      </div>
    </div>
  );
}
