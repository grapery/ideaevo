"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { agentApi, notificationApi, NotificationItem, userApi } from "@/lib/api-client";
import { Agent, UserProfile } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { DeimosIcon } from "@/components/deimos-icon";

export default function DashboardPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

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
    ])
      .then(([profileResult, agentResult, notificationResult]) => {
        if (cancelled) return;
        setProfile(profileResult);
        setAgents(agentResult.agents || []);
        setNotifications(notificationResult.items || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, router, user]);

  const pendingDecisions = useMemo(
    () => notifications.filter((item) => !item.read).slice(0, 4),
    [notifications]
  );

  if (authLoading || loading || !user || !profile) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[var(--bg-canvas)]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--accent-link)] border-t-transparent" />
      </div>
    );
  }

  const metricCards = [
    [t("dashboard.metricIdeas"), profile.idea_count, "registered"],
    [t("dashboard.metricAgents"), profile.agent_count, "operational"],
    [t("dashboard.metricFollowing"), profile.following_count, "following"],
    [t("dashboard.metricAttention"), pendingDecisions.length, "decision"],
  ];

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="page-eyebrow">{t("dashboard.eyebrow")}</p>
            <h1 className="page-heading">
              {t("dashboard.workbench", { name: profile.user.name })}
            </h1>
            <p className="page-heading-desc">{t("dashboard.desc")}</p>
          </div>
          <Link href="/user/settings" className="btn-outline h-8 px-4 text-[12px]">
            {t("dashboard.settings")}
          </Link>
        </div>

        <section className="panel-inverse mt-5 grid min-h-[152px] gap-5 p-5 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="font-code text-[10px] panel-inverse-accent">{t("dashboard.quickDecision")}</p>
            <h2 className="font-display mt-4 text-[22px] font-bold">{t("dashboard.todayPrompt")}</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/ideas/new" className="rounded-[var(--radius-btn)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--ink)]">
                {t("dashboard.newIdea")}
              </Link>
              <Link href="/chat" className="rounded-[var(--radius-btn)] border border-white/20 px-3 py-2 font-code text-[10px] text-white/80 hover:border-white/40">
                {t("dashboard.askAgent")}
              </Link>
              <Link href="/search" className="rounded-[var(--radius-btn)] border border-white/20 px-3 py-2 font-code text-[10px] text-white/80 hover:border-white/40">
                {t("dashboard.searchEvidence")}
              </Link>
            </div>
          </div>
          <div className="rounded-[var(--radius-card)] border border-[var(--panel-inverse-accent)]/30 bg-black/30 p-4 font-code text-[10px] leading-5 panel-inverse-accent">
            <p>{t("dashboard.processMemory", { count: notifications.length })}</p>
            <p className="mt-3">{t("dashboard.sessionSaved")}</p>
            <p>{t("dashboard.agentsAvailable", { count: agents.length })}</p>
            <p>{t("dashboard.provenanceOn")}</p>
          </div>
        </section>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(([label, value, detail]) => (
            <div key={String(label)} className="surface-card p-4">
              <p className="font-code text-[9px] text-[var(--ink-faint)]">{label}</p>
              <p className="font-display mt-3 text-[25px] font-bold text-[var(--ink)]">{value}</p>
              <p className="mt-1 font-code text-[9px] text-[var(--accent-link)]">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
          <main className="space-y-4">
            <section className="surface-card">
              <div className="flex h-11 items-center justify-between border-b border-[var(--rule)] px-4">
                <p className="font-code text-[10px] text-[var(--ink)]">{t("dashboard.todayActions")}</p>
                <Link href="/notifications" className="font-code text-[9px] text-[var(--accent-link)]">{t("dashboard.openInbox")}</Link>
              </div>
              {pendingDecisions.length === 0 ? (
                <div className="p-5 text-[13px] text-[var(--ink-faint)]">{t("dashboard.noDecisions")}</div>
              ) : (
                pendingDecisions.map((item, index) => (
                  <Link
                    key={item.id}
                    href={item.target_id ? `/ideas/${item.target_id}` : "/notifications"}
                    className="grid min-h-[62px] grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-[var(--rule)] px-4 last:border-0 hover:bg-[var(--bg-subtle)]"
                  >
                    <span className="font-code text-[10px] text-[var(--ink-faint)]">0{index + 1}</span>
                    <span className="text-[13px] font-medium text-[var(--ink)]">
                      {item.actor_name || t("dashboard.collaborator")} · {item.action}
                    </span>
                    <span className="font-code text-[9px] text-[var(--accent-link)]">{t("dashboard.review")}</span>
                  </Link>
                ))
              )}
            </section>

            <section className="callout-link p-5">
              <div className="flex items-center gap-3 text-[var(--accent-link)]">
                <DeimosIcon name="semantic-search" className="h-5 w-5" />
                <p className="font-code text-[10px] font-medium">{t("dashboard.teamValue")}</p>
              </div>
              <p className="mt-4 text-[13px] leading-6 text-[var(--accent-link)]">
                {t("dashboard.workspaceHint")}
              </p>
            </section>
          </main>

          <aside className="space-y-4">
            <section className="surface-card p-4">
              <p className="font-code text-[10px] text-[var(--ink)]">{t("dashboard.ownedAgents", { count: agents.length })}</p>
              <div className="mt-4 space-y-3">
                {agents.slice(0, 4).map((agent) => (
                  <Link key={agent.id} href={`/agents/${agent.id}`} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-btn)] bg-[var(--panel-inverse)] font-code text-[10px] text-white">
                      {agent.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-[var(--ink)]">{agent.name}</span>
                      <span className="font-code text-[9px] text-[var(--accent-success)]">{t("dashboard.operational")}</span>
                    </span>
                  </Link>
                ))}
              </div>
              <Link href="/user/agents" className="mt-5 inline-flex font-code text-[9px] text-[var(--accent-link)]">
                {t("dashboard.manageFleet")}
              </Link>
            </section>

            <section className="panel-inverse p-4 font-code text-[10px] leading-6">
              <p className="panel-inverse-accent">{t("dashboard.quickActions")}</p>
              <Link href="/chat" className="mt-3 block panel-inverse-muted hover:text-white">{t("dashboard.actionChat")}</Link>
              <Link href="/ideas/new" className="block panel-inverse-muted hover:text-white">{t("dashboard.actionPublish")}</Link>
              <Link href="/docs/mcp" className="block panel-inverse-muted hover:text-white">{t("dashboard.actionMcp")}</Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
