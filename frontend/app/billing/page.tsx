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
import type { TranslationKey } from "@/lib/i18n/messages";

// 格式化最小货币单位为展示金额：1990 + CNY -> "¥19.90"，990 + USD -> "$9.90"
function formatPrice(units: number, currency: string): string {
  const value = (units / 100).toFixed(2);
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
  return `${symbol}${value}`;
}

// 格式化 token 数：zh-CN 10000 -> "1万"；en 显示原始数字
function formatTokens(n: number, locale: string): string {
  const zh = locale === "zh-CN";
  if (zh && n >= 10000) {
    return `${Math.floor(n / 10000)}万`;
  }
  return new Intl.NumberFormat(zh ? "zh-CN" : "en").format(n);
}

const ORDER_STATUS_KEY: Record<string, TranslationKey> = {
  paid: "billing.statusPaid",
  pending: "billing.statusPending",
  failed: "billing.statusCancelled",
  refunded: "billing.statusRefunded",
};

const REFUND_STATUS_KEY: Record<string, TranslationKey> = {
  pending: "billing.statusReviewing",
  approved: "billing.statusApproved",
  rejected: "billing.statusRejected",
};

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
  const { t, locale } = useI18n();
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
          : t("common.operationFailed"),
      );
    } finally {
      setInitialLoading(false);
    }
  }, [t]);

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
        setPayMsg(t("billing.mockPayDone"));
      } else if (result.payment_url) {
        // alipay / stripe 返回网页 URL，直接跳转
        if (result.gateway === "stripe" || result.gateway === "alipay") {
          window.location.href = result.payment_url;
        } else {
          // wechat 返回 code_url，需前端渲染二维码（这里提示）
          setPayMsg(result.payment_url);
        }
      }
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : t("common.operationFailed");
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
      setPayMsg(t("billing.mockPayDone"));
      setPendingOrder(null);
      await loadData(); // 刷新会员状态
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : t("common.operationFailed");
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
      setRefundMsg(t("billing.refundSubmittedHint"));
      setRefundOrderID("");
      setRefundReason("");
      await loadData(); // 刷新订单与退款列表
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : t("common.operationFailed");
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
            title={t("billing.title")}
            description={t("billing.choosePlan")}
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
                {locale === "zh-CN" ? "重试" : "Retry"}
              </button>
            </div>
          )}

          {/* 当前会员状态 */}
          {membership && (
            <div className="mb-8 overflow-hidden rounded-[var(--radius-card)] bg-[var(--ink)] p-5 text-white sm:p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
                    {t("billing.sharedQuota")}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {t("billing.dailyQuota")}
                  </h2>
                </div>
                <span className="rounded-full border border-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/80">
                  {membership.is_pro
                    ? t("billing.proMember")
                    : t("billing.freeUser")}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1.35fr_1fr_1fr]">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-2xl font-semibold">
                      {formatTokens(membership.daily_quota.tokens_left, locale)}
                    </span>
                    <span className="font-mono text-[10px] text-white/55">
                      {quotaPercent}% {t("billing.remaining")}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-[#9aff39]"
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/55">
                    {t("billing.dailyLimit")}{" "}
                    {formatTokens(membership.daily_quota.tokens_limit, locale)}{" "}
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
                    {t("billing.agentsCreated")}
                  </div>
                </div>
                <div className="border-t border-white/15 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <div className="flex items-center gap-2 text-xl font-semibold">
                    <DeimosIcon
                      name="tool"
                      className="h-4 w-4 text-[#9aff39]"
                    />
                    {membership.is_pro
                      ? t("billing.enabled")
                      : t("billing.restricted")}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {t("billing.mcpAccess")}
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
                    {t("billing.membershipQuota")}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">
                    {t("billing.choosePlan")}
                  </h2>
                </div>
                <span className="hidden font-code text-[9px] text-[var(--ink-faint)] sm:block">
                  {t("billing.noAutoRenew")}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {/* 免费版 */}
                <div className="surface-card p-6">
                  <h3 className="text-lg font-semibold text-[var(--title)]">
                    {t("billing.free")}
                  </h3>
                  <div className="mt-2 text-3xl font-bold text-[var(--title)]">
                    ¥0
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {t("billing.freeForever")}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    <PlanFeature>
                      {t("billing.freePerDay")}{" "}
                      {formatTokens(plans.free.daily_tokens, locale)} Token
                    </PlanFeature>
                    <PlanFeature>
                      {t("billing.freeFeatures")}
                    </PlanFeature>
                    <PlanFeature available={false}>
                      {t("billing.freeNoAgent")}
                    </PlanFeature>
                    <PlanFeature available={false}>
                      {t("billing.freeNoMcp")}
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
                        {t("billing.pro")}
                      </h3>
                      <span className="badge-pill badge-active">
                        {t("billing.recommended")}
                      </span>
                    </div>
                    <div className="mt-2 text-3xl font-bold text-[var(--title)]">
                      {formatPrice(plan.prices[currency] || 0, currency)}
                      <span className="text-sm font-normal text-[var(--text-muted)]">
                        {" "}
                        / {plan.duration_days} {locale === "zh-CN" ? "天" : "days"}
                      </span>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm">
                      <PlanFeature>
                        {t("billing.perDay")}{" "}
                        {formatTokens(plan.daily_tokens, locale)} Token
                      </PlanFeature>
                      <PlanFeature>
                        {t("billing.proMaxAgents", { count: plan.max_agents })}
                      </PlanFeature>
                      <PlanFeature>
                        {t("billing.proMcp")}
                      </PlanFeature>
                      <PlanFeature>
                        {t("billing.proAllFeatures")}
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
                  {t("billing.currency")}
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
                      {c === "CNY" ? t("billing.cny") : t("billing.usd")}
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
                    ? t("billing.processing")
                    : `${t("billing.subscribeNow")} · ${formatPrice(plans.plans[0].prices[currency] || 0, currency)}`}
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
                        t("billing.processing")
                      ) : (
                        <>
                          <DeimosIcon name="check" className="h-4 w-4" />
                          {t("billing.mockPayDone")}
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingOrder(null)}
                    className="text-sm text-[var(--text-muted)] hover:text-[var(--ink)] w-full text-center"
                  >
                    {t("billing.cancel")}
                  </button>
                </div>
              )}

              <p className="mt-3 text-xs text-[var(--text-muted)] text-center">
                {t("billing.afterPurchase")}
              </p>
            </div>
          )}

          {/* 订单与退款管理 */}
          <section id="orders" className="mt-8 scroll-mt-20">
            <div className="surface-card p-5">
              <div className="mb-4 flex items-end justify-between gap-4 border-b border-[var(--divider)] pb-4">
                <div>
                  <p className="font-code text-[9px] text-[var(--accent-link)]">
                    {t("billing.ordersRefunds")}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">
                    {t("billing.paymentRecords")}
                  </h2>
                </div>
                <span className="font-code text-[9px] text-[var(--ink-faint)]">
                  {t("billing.orderCount", { count: orders.length })}
                </span>
              </div>
              {orders.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
                  <DeimosIcon name="document" className="h-5 w-5" />
                  <span>
                    {t("billing.noOrders")}
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
                            {t(ORDER_STATUS_KEY[order.status] ?? "billing.statusPending")}
                          </span>
                          {canRefund && (
                            <button
                              type="button"
                              onClick={() => setRefundOrderID(order.id)}
                              className="text-xs text-[var(--accent-warning)] hover:underline"
                            >
                              {t("billing.requestRefund")}
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
                              {t("billing.refund")}{" "}
                              {t(REFUND_STATUS_KEY[orderRefund.status] ?? "billing.statusReviewing")}
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
                {t("billing.refundTitle")}
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
                placeholder={t("billing.refundPlaceholder")}
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
                  {loading ? t("billing.submitting") : t("billing.submitRefund")}
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
                  {t("billing.cancel")}
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {t("billing.refundSubmittedHint")}
              </p>
            </div>
          )}

          {/* 退款记录 */}
          {refunds.length > 0 && (
            <div className="mt-4 surface-card p-5">
              <h2 className="text-sm font-medium text-[var(--ink-soft)] mb-4">
                {t("billing.refundRecords")}
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
                        {t(REFUND_STATUS_KEY[refund.status] ?? "billing.statusReviewing")}
                      </span>
                    </div>
                    {refund.reason && (
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        {t("billing.reason")}：{refund.reason}
                      </div>
                    )}
                    {refund.admin_note && (
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        {t("billing.reviewNote")}：{refund.admin_note}
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
              {t("billing.viewMembership")}
            </AppLink>
          </div>
        </main>
      </div>
    </div>
  );
}
