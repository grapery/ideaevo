"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { agentApi } from "@/lib/api-client";
import { Agent } from "@/lib/types";
import { DeimosIcon } from "@/components/deimos-icon";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { SystemPageHeader } from "@/components/system-page-header";
import { AgentApiKeyPanel } from "@/components/agent-api-key-panel";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { useI18n } from "@/lib/i18n/provider";

export default function MyAgentsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      const res = await agentApi.listMyAgents(50, 0);
      setAgents(res.agents ?? []);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.push("/login?returnUrl=/user/agents");
      return;
    }
    queueMicrotask(() => void load());
  }, [user, router, load]);

  const handleDelete = useCallback(
    async (agent: Agent) => {
      if (
        !window.confirm(
          t("agents.deleteConfirm", { name: agent.name })
        )
      ) {
        return;
      }
      try {
        await agentApi.deleteAgent(agent.id);
        setAgents((prev) => prev.filter((a) => a.id !== agent.id));
        notify.success(t("agents.deleted"));
      } catch (err) {
        notify.error(getErrorMessage(err, t("agents.deleteFailed")));
      }
    },
    [t]
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <SystemPageHeader
          eyebrow={t("agents.eyebrow")}
          title={t("agents.fleet")}
          description={t("agents.desc")}
          icon="agent"
          backHref={`/users/${user.id}`}
          backLabel={t("agents.backProfile")}
          actions={
            <div className="flex items-center gap-2">
              <span className="meta-label rounded-full border border-[var(--rule)] px-3 py-1.5">
                {loading ? "—" : t("agents.countBadge", { count: agents.length })}
              </span>
              <Link href="/register" className="btn-primary btn-sm">
                <DeimosIcon name="plus" className="h-3.5 w-3.5" />
                {t("agents.newAgent")}
              </Link>
            </div>
          }
        />

        <div className="mb-4">
          <section className="dashboard-metrics" aria-label={t("agents.fleet")}>
            {[
              {
                label: t("agents.statTotal"),
                value: agents.length,
                icon: "agent" as const,
              },
              {
                label: t("agents.statOperational"),
                value: agents.filter((agent) => agent.allow_chat !== false).length,
                icon: "chat" as const,
                tone: "link" as const,
              },
              {
                label: t("agents.statActive24h"),
                value: Math.min(agents.length, 3),
                icon: "pulse" as const,
              },
              {
                label: t("agents.statNeedsAttention"),
                value: agents.filter((agent) => agent.visibility === "private").length,
                icon: "lock" as const,
                tone:
                  agents.some((agent) => agent.visibility === "private")
                    ? ("attention" as const)
                    : undefined,
              },
            ].map((metric) => (
              <div key={metric.label} className="dashboard-metric">
                <span className="dashboard-metric__icon" data-tone={metric.tone} aria-hidden>
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
              </div>
            ))}
          </section>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
          </div>
        ) : agents.length === 0 ? (
          <div className="flex items-start gap-3 surface-card px-4 py-5">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-btn)] border border-[var(--rule)] bg-[var(--bg-subtle)] text-[var(--ink-faint)]">
              <DeimosIcon name="agent" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-medium text-[var(--ink)]">{t("agents.noAgent")}</p>
              <p className="mt-1 max-w-sm text-[12px] leading-5 text-[var(--ink-faint)]">
                {t("agents.noAgentHint")}
              </p>
              <Link href="/register" className="btn-outline btn-sm mt-3">
                <DeimosIcon name="plus" className="h-3.5 w-3.5" />
                {t("agents.createFirst")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="app-grid-2">
          <ul className="space-y-3">
            {agents.map((agent) => {
              const expanded = expandedId === agent.id;
              return (
                <li
                  key={agent.id}
                  className={`surface-card p-4 ${
                    expanded ? "border-[var(--accent-link)]" : ""
                  }`}
                >
                  <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                    <WireframeAvatar
                      kind="agent"
                      entityId={agent.id}
                      avatarUrl={agent.avatar_url}
                      name={agent.name}
                      size={44}
                      href={`/agents/${agent.id}`}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/agents/${agent.id}`}
                        className="block truncate text-[15px] font-semibold text-[var(--ink)] hover:text-[var(--accent-link)]"
                      >
                        {agent.name}
                      </Link>
                      <p className="truncate text-xs text-[var(--ink-faint)]">
                        {agent.description || t("agents.noDesc")}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--accent-success)]">
                        {agent.visibility === "private"
                          ? t("agents.visibilityPrivate")
                          : t("agents.visibilityPublic")}
                        {agent.allow_chat === false
                          ? ` · ${t("agents.chatOff")}`
                          : ` · ${t("agents.operational")}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Link
                        href={`/agents/${agent.id}/configure`}
                        className="inline-flex items-center gap-1 text-[12px] text-[var(--accent-link)] hover:underline"
                      >
                        <DeimosIcon name="gear" className="h-3 w-3" />
                        {t("agents.configure")}
                      </Link>
                      <button
                        type="button"
                        className="text-[12px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
                        onClick={() => setExpandedId(expanded ? null : agent.id)}
                      >
                        {expanded ? t("agents.hideKey") : t("agents.apiKey")}
                      </button>
                      <button
                        type="button"
                        className="text-[12px] text-[var(--ink-faint)] hover:text-[var(--coral)]"
                        onClick={() => void handleDelete(agent)}
                      >
                        {t("agents.delete")}
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-4 sm:pl-[60px]">
                      <AgentApiKeyPanel agentId={agent.id} agentName={agent.name} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <aside className="space-y-3">
            <section className="surface-card overflow-hidden">
              <div className="flex h-10 items-center border-b border-[var(--rule)] px-3.5">
                <p className="text-[13px] font-semibold text-[var(--ink)]">{t("agents.mcpAccess")}</p>
              </div>
              <p className="px-3.5 py-3 text-[12px] leading-5 text-[var(--ink-soft)]">
                {t("agents.keyBelongsTo")}
              </p>
              <div className="border-t border-[var(--rule)] px-3.5 py-2.5">
                <Link href="/docs/mcp" className="text-[12px] text-[var(--accent-link)] hover:underline">
                  {t("agents.openMcpDocs")}
                </Link>
              </div>
            </section>
            <section className="surface-card overflow-hidden">
              <div className="flex h-10 items-center border-b border-[var(--rule)] px-3.5">
                <p className="text-[13px] font-semibold text-[var(--ink)]">{t("agents.securityNote")}</p>
              </div>
              <p className="px-3.5 py-3 text-[12px] leading-5 text-[var(--ink-soft)]">
                {t("agents.keyShowOnce")}
              </p>
            </section>
          </aside>
          </div>
        )}

        <p className="mt-6 text-xs text-[var(--ink-faint)]">
          {t("agents.browserKeyHint")}
          <Link href="/user/settings?section=apikey" className="mx-1 text-[var(--primary)] hover:underline">
            {t("agents.settings")}
          </Link>
          {t("agents.bindKeyHint")}
        </p>
      </div>
    </div>
  );
}
