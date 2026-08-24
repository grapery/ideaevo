"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { agentApi, notificationApi, NotificationItem, userApi } from "@/lib/api-client";
import { Agent, UserProfile, WorkspaceOverview } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { DeimosIcon } from "@/components/deimos-icon";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { SystemPageHeader } from "@/components/system-page-header";
import { ImplStatusBadge } from "@/components/impl-status-badge";

function formatRelativeTime(
  dateStr: string,
  locale: string,
): string {
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return "";
  const diffSec = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale === "en" ? "en" : "zh-CN", {
    numeric: "auto",
  });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export default function DashboardPage() {
  const { locale, t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?returnUrl=/dashboard");
      return;
    }
    let cancelled = false;
    Promise.all([
      userApi.getMyProfile(),
      agentApi.listMyAgents(8, 0),
      notificationApi.list({ limit: 8 }),
      userApi.getOverview().catch(() => null),
    ])
      .then(([profileResult, agentResult, notificationResult, overviewResult]) => {
        if (cancelled) return;
        setProfile(profileResult);
        setAgents(agentResult.agents || []);
        setNotifications(notificationResult.items || []);
        setOverview(overviewResult);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, router, user]);

  const pendingDecisions = useMemo(
    () => notifications.filter((item) => !item.read).slice(0, 6),
    [notifications],
  );

  // 只展示「有实现迹象」的 idea：进度条目非空或 impl_status 非概念期
  const progressIdeas = useMemo(
    () =>
      (overview?.ideas || [])
        .filter((s) => s.todos + s.dones > 0 || (s.impl_status && s.impl_status !== "concept"))
        .slice(0, 6),
    [overview],
  );
  const activeJobs = (overview?.jobs?.pending || 0) + (overview?.jobs?.in_progress || 0);

  if (loadFailed) {
    return (
      <div className="page-shell-full">
        <div className="page-container page-pad py-16 text-center text-sm text-[var(--text-muted)]">
          {t("common.loadFailed")}
        </div>
      </div>
    );
  }

  if (authLoading || loading || !user || !profile) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[var(--bg-canvas)]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  const metrics = [
    {
      label: t("dashboard.metricIdeas"),
      value: profile.idea_count,
      href: `/users/${profile.user.id}`,
      icon: "document" as const,
    },
    {
      label: t("dashboard.metricAgents"),
      value: profile.agent_count ?? agents.length,
      href: "/user/agents",
      icon: "agent" as const,
      tone: "link" as const,
    },
    {
      label: t("dashboard.metricFollowing"),
      value: profile.following_count,
      href: `/users/${profile.user.id}`,
      icon: "follow" as const,
    },
    {
      label: t("dashboard.metricAttention"),
      value: pendingDecisions.length,
      href: "/notifications",
      icon: "bell" as const,
      tone: pendingDecisions.length > 0 ? ("attention" as const) : undefined,
    },
  ];

  const shortcuts = [
    { href: "/user/jobs", icon: "lifecycle" as const, label: t("jobs.title") },
    { href: "/chat", icon: "chat" as const, label: t("dashboard.actionChat") },
    { href: "/ideas/new", icon: "publish" as const, label: t("dashboard.actionPublish") },
    { href: "/docs/mcp", icon: "tool" as const, label: t("dashboard.actionMcp") },
    { href: "/search", icon: "semantic-search" as const, label: t("dashboard.searchEvidence") },
  ];

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        {/* Header: identity + primary actions */}
        <SystemPageHeader
          title={t("dashboard.workbench", { name: profile.user.name })}
          description={t("dashboard.desc")}
          avatar={
            <WireframeAvatar
              kind="user"
              entityId={profile.user.id}
              avatarUrl={profile.user.avatar_url}
              name={profile.user.name}
              size={40}
            />
          }
          actions={
            <>
              <Link href="/ideas/new" className="btn-primary btn-sm">
                <DeimosIcon name="publish" className="h-3.5 w-3.5" />
                {t("dashboard.newIdea")}
              </Link>
              <Link href="/chat" className="btn-outline btn-sm">
                <DeimosIcon name="chat" className="h-3.5 w-3.5" />
                {t("dashboard.askAgent")}
              </Link>
              <Link href="/user/settings" className="btn-default btn-sm">
                {t("dashboard.settings")}
              </Link>
            </>
          }
        />

        {/* Metrics: wireframe icon + tabular value strip */}
        <section className="dashboard-metrics mt-6" aria-label={t("dashboard.desc")}>
          {metrics.map((metric) => (
            <Link key={metric.label} href={metric.href} className="dashboard-metric">
              <span
                className="dashboard-metric__icon"
                data-tone={metric.tone}
                aria-hidden
              >
                <DeimosIcon name={metric.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="dashboard-metric__body">
                <span className="dashboard-metric__label">{metric.label}</span>
                <span
                  className="dashboard-metric__value"
                  data-tone={metric.tone === "attention" ? "attention" : undefined}
                >
                  {metric.value}
                </span>
              </span>
              <DeimosIcon name="chevron-right" className="dashboard-metric__chevron" />
            </Link>
          ))}
        </section>

        {/* Body: inbox + side panels */}
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="min-w-0">
            <section className="surface-card overflow-hidden">
              <div className="flex h-10 items-center justify-between border-b border-[var(--rule)] px-4">
                <div className="flex items-center gap-2">
                  <DeimosIcon name="decision" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
                  <h2 className="text-[13px] font-semibold text-[var(--ink)]">
                    {t("dashboard.todayActions")}
                  </h2>
                  {pendingDecisions.length > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary-soft)] px-1.5 text-[11px] font-medium tabular-nums text-[var(--primary)]">
                      {pendingDecisions.length}
                    </span>
                  )}
                </div>
                <Link
                  href="/notifications"
                  className="text-[12px] text-[var(--accent-link)] hover:underline"
                >
                  {t("dashboard.openInbox")}
                </Link>
              </div>

              {pendingDecisions.length === 0 ? (
                <div className="flex items-start gap-3 px-4 py-5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-btn)] border border-[var(--rule)] bg-[var(--bg-subtle)] text-[var(--accent-success)]">
                    <DeimosIcon name="check" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--ink)]">
                      {t("dashboard.noDecisions")}
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-[var(--ink-faint)]">
                      {t("dashboard.workspaceHint")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href="/ideas/new" className="btn-default btn-sm">
                        {t("dashboard.newIdea")}
                      </Link>
                      <Link href="/chat" className="btn-default btn-sm">
                        {t("dashboard.askAgent")}
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <ul>
                  {pendingDecisions.map((item) => (
                    <li key={item.id} className="border-b border-[var(--rule)] last:border-0">
                      <Link
                        href={item.target_id ? `/ideas/${item.target_id}` : "/notifications"}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-subtle)]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                          <DeimosIcon name="bell" className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-[var(--ink)]">
                            {item.actor_name || t("dashboard.collaborator")}
                            <span className="font-normal text-[var(--ink-soft)]">
                              {" · "}
                              {item.action}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[11px] tabular-nums text-[var(--ink-faint)]">
                            {formatRelativeTime(item.created_at, locale)}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] text-[var(--accent-link)]">
                          {t("dashboard.review")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 我的实现进度:跨 idea 一屏自查(私域视图) */}
            <section className="surface-card overflow-hidden">
              <div className="flex h-10 items-center justify-between border-b border-[var(--rule)] px-4">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
                  <DeimosIcon name="check" className="h-3.5 w-3.5 text-[var(--accent-success)]" />
                  {t("dashboard.progressTitle")}
                </h2>
                <Link
                  href="/user/jobs"
                  className={`text-[12px] hover:underline ${activeJobs > 0 ? "text-[var(--accent-link)]" : "text-[var(--ink-faint)]"}`}
                >
                  {activeJobs > 0
                    ? t("dashboard.progressJobs", { count: activeJobs })
                    : t("jobs.title")}
                </Link>
              </div>

              {progressIdeas.length === 0 ? (
                <p className="px-4 py-5 text-[12px] leading-5 text-[var(--ink-faint)]">
                  {t("dashboard.progressEmpty")}
                </p>
              ) : (
                <ul>
                  {progressIdeas.map((s) => {
                    const total = s.todos + s.dones;
                    const percent = total > 0 ? Math.round((s.dones / total) * 100) : 0;
                    return (
                      <li key={s.idea_id} className="border-b border-[var(--rule)] last:border-0">
                        <Link
                          href={`/ideas/${s.idea_id}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-subtle)]"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[13px] font-medium text-[var(--ink)]">
                                {s.title}
                              </span>
                              <ImplStatusBadge status={s.impl_status} />
                            </span>
                            <span className="mt-1.5 flex items-center gap-2">
                              <span className="h-1 w-24 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                                <span
                                  className="block h-full rounded-full bg-[var(--accent-success)]"
                                  style={{ width: `${percent}%` }}
                                />
                              </span>
                              <span className="text-[11px] tabular-nums text-[var(--ink-faint)]">
                                {t("idea.progressCount", { done: s.dones, total })}
                              </span>
                              {s.last_progress_at && (
                                <span className="text-[11px] tabular-nums text-[var(--ink-faint)]">
                                  · {formatRelativeTime(s.last_progress_at, locale)}
                                </span>
                              )}
                            </span>
                          </span>
                          <DeimosIcon
                            name="chevron-right"
                            className="h-3.5 w-3.5 shrink-0 text-[var(--ink-disabled)]"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </section>

          <aside className="space-y-3">
            <section className="surface-card overflow-hidden">
              <div className="flex h-10 items-center justify-between border-b border-[var(--rule)] px-3.5">
                <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
                  <DeimosIcon name="agent" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
                  {t("dashboard.ownedAgents", { count: agents.length })}
                </h2>
                <Link
                  href="/user/agents"
                  className="text-[12px] text-[var(--accent-link)] hover:underline"
                >
                  {t("dashboard.manageFleet")}
                </Link>
              </div>

              {agents.length === 0 ? (
                <div className="px-3.5 py-4">
                  <p className="text-[12px] leading-5 text-[var(--ink-faint)]">
                    {t("dashboard.noAgents")}
                  </p>
                  <Link href="/register" className="btn-default btn-sm mt-3">
                    {t("dashboard.createAgent")}
                  </Link>
                </div>
              ) : (
                <ul>
                  {agents.slice(0, 5).map((agent) => (
                    <li key={agent.id} className="border-b border-[var(--rule)] last:border-0">
                      <Link
                        href={`/agents/${agent.id}`}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-[var(--bg-subtle)]"
                      >
                        <WireframeAvatar
                          kind="agent"
                          entityId={agent.id}
                          avatarUrl={agent.avatar_url}
                          name={agent.name}
                          size={28}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-[var(--ink)]">
                            {agent.name}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-success)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {t("dashboard.operational")}
                          </span>
                        </span>
                        <DeimosIcon
                          name="chevron-right"
                          className="h-3.5 w-3.5 shrink-0 text-[var(--ink-disabled)]"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="surface-card overflow-hidden">
              <div className="flex h-10 items-center border-b border-[var(--rule)] px-3.5">
                <h2 className="text-[13px] font-semibold text-[var(--ink)]">
                  {t("dashboard.quickActions")}
                </h2>
              </div>
              <ul>
                {shortcuts.map((item) => (
                  <li key={item.href} className="border-b border-[var(--rule)] last:border-0">
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-[var(--ink-soft)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                    >
                      <DeimosIcon
                        name={item.icon}
                        className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <DeimosIcon
                        name="chevron-right"
                        className="h-3.5 w-3.5 shrink-0 text-[var(--ink-disabled)]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
