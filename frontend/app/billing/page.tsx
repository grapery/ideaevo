"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLink } from "@/components/app-link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { billingApi, ApiRequestError } from "@/lib/api-client";
import {
  BillingPlan,
  MembershipView,
  PlansResponse,
  CreateOrderResult,
  BillingOrder,
  Refund,
} from "@/lib/types";
import { DeimosIcon } from "@/components/deimos-icon";
import { SystemPageHeader } from "@/components/system-page-header";
import { AccountSidebar } from "@/components/account-sidebar";
import { useI18n } from "@/lib/i18n/provider";

// 格式化最小货币单位为展示金额：1990 + CNY -> "¥19.90"，990 + USD -> "$9.90"
function formatPrice(units: number, currency: string): string {
  const value = (units / 100).toFixed(2);
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
  return `${symbol}${value}`;
}

// 格式化 token 数：10000 -> "1万"，10000000 -> "1000万"
function formatTokens(n: number, zh: boolean): string {
  if (zh && n >= 10000) {
    return `${Math.floor(n / 10000)}万`;
  }
  return new Intl.NumberFormat(zh ? "zh-CN" : "en").format(n);
}

function orderStatusText(status: string, zh: boolean): string {
  switch (status) {
    case "paid":
      return zh ? "已支付" : "Paid";
    case "pending":
      return zh ? "待支付" : "Pending";
    case "failed":
      return zh ? "已取消" : "Cancelled";
    case "refunded":
      return zh ? "已退款" : "Refunded";
    default:
      return status;
  }
}

function refundStatusText(status: string, zh: boolean): string {
  switch (status) {
    case "pending":
      return zh ? "审批中" : "Under review";
    case "approved":
      return zh ? "已批准" : "Approved";
    case "rejected":
      return zh ? "已拒绝" : "Rejected";
    default:
      return status;
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
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [membership, setMembership] = useState<MembershipView | null>(null);
  const [currency, setCurrency] = useState<string>("CNY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingOrder, setPendingOrder] = useState<CreateOrderResult | null>(
    null,
  );
  const [payMsg, setPayMsg] = useState("");
  // 订单与退款记录
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [refundOrderID, setRefundOrderID] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundError, setRefundError] = useState("");
  const [refundMsg, setRefundMsg] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadData = useCallback(async () => {
    setLoadError("");
    try {
      const [plansRes, memRes, ordersRes, refundsRes] = await Promise.all([
        billingApi.plans(),
        billingApi.membership(),
        billingApi.listOrders(50),
        billingApi.listRefunds(50),
      ]);
      setPlans(plansRes);
      setMembership(memRes);
      setOrders(ordersRes.orders);
      setRefunds(refundsRes.refunds);
    } catch (err) {
      setLoadError(
        err instanceof ApiRequestError
          ? err.message
          : zh
            ? "账单数据加载失败，请稍后重试"
            : "Unable to load billing data. Please try again.",
      );
    } finally {
      setInitialLoading(false);
    }
  }, [zh]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, user, router, loadData]);

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
        setPayMsg(
          zh
            ? "演示环境：点击下方按钮模拟支付完成"
            : "Demo environment: complete the simulated payment below.",
        );
      } else if (result.payment_url) {
        // alipay / stripe 返回网页 URL，直接跳转
        if (result.gateway === "stripe" || result.gateway === "alipay") {
          window.location.href = result.payment_url;
        } else {
          // wechat 返回 code_url，需前端渲染二维码（这里提示）
          setPayMsg(
            (zh
              ? "请使用微信扫描二维码完成支付："
              : "Scan with WeChat to complete payment: ") + result.payment_url,
          );
        }
      }
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : zh
            ? "下单失败，请重试"
            : "Unable to create the order. Please try again.";
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
      setPayMsg(
        zh ? "支付成功，会员已激活" : "Payment complete. Membership activated.",
      );
      setPendingOrder(null);
      await loadData(); // 刷新会员状态
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : zh
            ? "支付失败"
            : "Payment failed";
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
      setRefundMsg(
        zh
          ? "退款申请已提交，等待管理员审批"
          : "Refund request submitted for administrator review.",
      );
      setRefundOrderID("");
      setRefundReason("");
      await loadData(); // 刷新订单与退款列表
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : zh
            ? "申请失败"
            : "Request failed";
      setRefundError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user || initialLoading) {
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
              100,
          ),
        ),
      )
    : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container flex flex-col gap-6 py-6 lg:flex-row">
        <AccountSidebar
          activePath="/billing"
          emailVerified={user.email_verified}
        />
        <main className="min-w-0 flex-1 lg:max-w-[900px]">
          <SystemPageHeader
            eyebrow="ACCOUNT / BILLING"
            title={zh ? "会员、用量与支付" : "Membership, usage, and billing"}
            description={
              zh
                ? "额度由人类账户与执行任务的 Agent 共享。管理套餐、支付订单、发票状态和退款申请。"
                : "Usage is shared by your account and executing Agents. Manage plans, payments, order status, and refund requests."
            }
            icon="billing"
          />

          {loadError && (
            <div className="mb-6 flex items-center justify-between gap-4 rounded-[8px] border border-[var(--coral)]/35 bg-[var(--coral)]/10 p-4 text-sm text-[var(--coral)]">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void loadData()}
                className="btn-outline shrink-0"
              >
                {zh ? "重试" : "Retry"}
              </button>
            </div>
          )}

          {/* 当前会员状态 */}
          {membership && (
            <div className="mb-8 overflow-hidden rounded-[var(--radius-card)] bg-[var(--ink)] p-5 text-white sm:p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
                    {zh ? "共享执行配额" : "SHARED EXECUTION QUOTA"}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {zh ? "今日执行额度" : "Today’s execution quota"}
                  </h2>
                </div>
                <span className="rounded-full border border-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/80">
                  {membership.is_pro
                    ? zh
                      ? "Pro 会员"
                      : "Pro member"
                    : zh
                      ? "免费用户"
                      : "Free plan"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1.35fr_1fr_1fr]">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-2xl font-semibold">
                      {formatTokens(membership.daily_quota.tokens_left, zh)}
                    </span>
                    <span className="font-mono text-[10px] text-white/55">
                      {quotaPercent}% {zh ? "剩余" : "REMAINING"}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-[#9aff39]"
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/55">
                    {zh ? "每日上限" : "Daily limit"}{" "}
                    {formatTokens(membership.daily_quota.tokens_limit, zh)}{" "}
                    Token
                  </p>
                </div>
                <div className="border-t border-white/15 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <div className="text-xl font-semibold">
                    {membership.agent_count}
                    <span className="text-sm font-normal text-white/45">
                      {" "}
                      / {membership.max_agents}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {zh ? "已创建 Agent" : "Agents created"}
                  </div>
                </div>
                <div className="border-t border-white/15 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <div className="flex items-center gap-2 text-xl font-semibold">
                    <DeimosIcon
                      name="tool"
                      className="h-4 w-4 text-[#9aff39]"
                    />
                    {membership.is_pro
                      ? zh
                        ? "已启用"
                        : "Enabled"
                      : zh
                        ? "受限"
                        : "Limited"}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {zh ? "MCP / Agent 权限" : "MCP / Agent access"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 套餐对比 */}
          {plans && (
            <section id="plans" className="mb-6 scroll-mt-20">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="font-code text-[9px] text-[var(--accent-link)]">
                    {zh ? "会员与配额" : "MEMBERSHIP & QUOTA"}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">
                    {zh
                      ? "选择适合执行强度的套餐"
                      : "Choose a plan for your execution load"}
                  </h2>
                </div>
                <span className="hidden font-code text-[9px] text-[var(--ink-faint)] sm:block">
                  {zh ? "不自动续费" : "NO AUTO-RENEWAL"}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {/* 免费版 */}
                <div className="surface-card p-6">
                  <h3 className="text-lg font-semibold text-[var(--title)]">
                    {zh ? "免费版" : "Free"}
                  </h3>
                  <div className="mt-2 text-3xl font-bold text-[var(--title)]">
                    ¥0
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {zh ? "永久免费" : "Free forever"}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    <PlanFeature>
                      {zh ? "每日" : "Daily"}{" "}
                      {formatTokens(plans.free.daily_tokens, zh)} Token
                    </PlanFeature>
                    <PlanFeature>
                      {zh
                        ? "浏览想法、关注、点赞"
                        : "Discover, follow, and like ideas"}
                    </PlanFeature>
                    <PlanFeature available={false}>
                      {zh ? "不能创建 Agent" : "Agent creation unavailable"}
                    </PlanFeature>
                    <PlanFeature available={false}>
                      {zh ? "不能使用 MCP 服务" : "MCP access unavailable"}
                    </PlanFeature>
                  </ul>
                </div>

                {/* Pro 版 */}
                {plans.plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="surface-card-elevated p-6 ring-1 ring-[var(--primary)]/30"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-[var(--title)]">
                        {zh ? "Pro 会员" : "Pro membership"}
                      </h3>
                      <span className="badge-pill badge-active">
                        {zh ? "推荐" : "Recommended"}
                      </span>
                    </div>
                    <div className="mt-2 text-3xl font-bold text-[var(--title)]">
                      {formatPrice(plan.prices[currency] || 0, currency)}
                      <span className="text-sm font-normal text-[var(--text-muted)]">
                        {" "}
                        / {plan.duration_days} {zh ? "天" : "days"}
                      </span>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm">
                      <PlanFeature>
                        {zh ? "每日" : "Daily"}{" "}
                        {formatTokens(plan.daily_tokens, zh)} Token
                      </PlanFeature>
                      <PlanFeature>
                        {zh
                          ? `可创建最多 ${plan.max_agents} 个 Agent`
                          : `Create up to ${plan.max_agents} Agents`}
                      </PlanFeature>
                      <PlanFeature>
                        {zh ? "可使用 MCP 服务" : "Full MCP access"}
                      </PlanFeature>
                      <PlanFeature>
                        {zh ? "所有免费版功能" : "Everything in Free"}
                      </PlanFeature>
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 币种选择 + 购买 */}
          {plans && plans.plans.length > 0 && (
            <div className="surface-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-[var(--text-muted)]">
                  {zh ? "支付币种" : "Billing currency"}
                </span>
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
                      {c === "CNY"
                        ? zh
                          ? "人民币 ¥"
                          : "CNY ¥"
                        : zh
                          ? "美元 $"
                          : "USD $"}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-3 text-sm text-[var(--accent-error)]">
                  {error}
                </div>
              )}

              {!pendingOrder ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    plans.plans[0] && handleSubscribe(plans.plans[0])
                  }
                  className="btn-primary w-full"
                >
                  {loading
                    ? zh
                      ? "处理中..."
                      : "Processing..."
                    : `${zh ? "立即开通 Pro" : "Activate Pro"} · ${formatPrice(plans.plans[0].prices[currency] || 0, currency)}`}
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
                        zh ? (
                          "处理中..."
                        ) : (
                          "Processing..."
                        )
                      ) : (
                        <>
                          <DeimosIcon name="check" className="h-4 w-4" />
                          {zh ? "模拟支付完成" : "Complete simulated payment"}
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingOrder(null)}
                    className="text-sm text-[var(--text-muted)] hover:text-[var(--ink)] w-full text-center"
                  >
                    {zh ? "取消" : "Cancel"}
                  </button>
                </div>
              )}

              <p className="mt-3 text-xs text-[var(--text-muted)] text-center">
                {zh
                  ? "购买后 30 天内有效，到期需手动续期，不自动扣费"
                  : "Valid for 30 days. Renew manually; no automatic charges."}
              </p>
            </div>
          )}

          {/* 订单与退款管理 */}
          <section id="orders" className="mt-8 scroll-mt-20">
            <div className="surface-card p-5">
              <div className="mb-4 flex items-end justify-between gap-4 border-b border-[var(--divider)] pb-4">
                <div>
                  <p className="font-code text-[9px] text-[var(--accent-link)]">
                    {zh ? "订单与退款" : "ORDERS & REFUNDS"}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">
                    {zh ? "支付记录" : "Payment history"}
                  </h2>
                </div>
                <span className="font-code text-[9px] text-[var(--ink-faint)]">
                  {orders.length}{" "}
                  {zh ? "笔订单" : orders.length === 1 ? "ORDER" : "ORDERS"}
                </span>
              </div>
              {orders.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
                  <DeimosIcon name="document" className="h-5 w-5" />
                  <span>
                    {zh
                      ? "暂无订单，开通会员后会在这里显示。"
                      : "No orders yet. New purchases will appear here."}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map((order) => {
                    // 该订单是否已有退款申请（任一状态）
                    const orderRefund = refunds.find(
                      (r) => r.order_id === order.id,
                    );
                    const canRefund = order.status === "paid" && !orderRefund;
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
                            {new Date(order.created_at).toLocaleString(locale)}
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
                            {orderStatusText(order.status, zh)}
                          </span>
                          {canRefund && (
                            <button
                              type="button"
                              onClick={() => setRefundOrderID(order.id)}
                              className="text-xs text-[var(--accent-warning)] hover:underline"
                            >
                              {zh ? "申请退款" : "Request refund"}
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
                              {zh ? "退款" : "Refund"}{" "}
                              {refundStatusText(orderRefund.status, zh)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 退款申请表单 */}
          {refundOrderID && (
            <div className="mt-4 surface-card-elevated p-5">
              <h3 className="text-sm font-medium text-[var(--ink-soft)] mb-3">
                {zh ? "申请退款" : "Request a refund"}
              </h3>
              {refundError && (
                <div className="mb-3 text-sm text-[var(--accent-error)]">
                  {refundError}
                </div>
              )}
              {refundMsg && (
                <div className="mb-3 text-sm text-[var(--ink-soft)]">
                  {refundMsg}
                </div>
              )}
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={
                  zh ? "请填写退款原因（选填）" : "Reason for refund (optional)"
                }
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
                  {loading
                    ? zh
                      ? "提交中..."
                      : "Submitting..."
                    : zh
                      ? "提交退款申请"
                      : "Submit refund request"}
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
                  {zh ? "取消" : "Cancel"}
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {zh
                  ? "退款申请提交后需等待管理员审批。批准后将撤销该订单赋予的会员有效期。"
                  : "Refunds require administrator review. Approval revokes the membership period granted by the order."}
              </p>
            </div>
          )}

          {/* 退款记录 */}
          {refunds.length > 0 && (
            <div className="mt-4 surface-card p-5">
              <h2 className="text-sm font-medium text-[var(--ink-soft)] mb-4">
                {zh ? "退款记录" : "Refund history"}
              </h2>
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
                        {refundStatusText(refund.status, zh)}
                      </span>
                    </div>
                    {refund.reason && (
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        {zh ? "原因" : "Reason"}：{refund.reason}
                      </div>
                    )}
                    {refund.admin_note && (
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        {zh ? "审批备注" : "Review note"}：{refund.admin_note}
                      </div>
                    )}
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {new Date(refund.created_at).toLocaleString(locale)}
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
              {zh ? "查看我的主页会员状态" : "View membership on my profile"} →
            </AppLink>
          </div>
        </main>
      </div>
    </div>
  );
}
