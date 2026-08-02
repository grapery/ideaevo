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
          eyebrow="AGENT CONTROL / FLEET COMMAND"
          title={t("agents.fleet")}
          description={t("agents.desc")}
          icon="agent"
          backHref={`/users/${user.id}`}
          backLabel={t("agents.backProfile")}
          actions={
            <div className="flex items-center gap-2">
              <span className="meta-label rounded-full border border-[var(--rule)] px-3 py-1.5">
                {loading ? "—" : agents.length} AGENTS
              </span>
              <Link href="/register" className="btn-primary btn-sm">
                <DeimosIcon name="plus" className="h-3.5 w-3.5" />
                {t("agents.newAgent")}
              </Link>
            </div>
          }
        />

        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            ["AGENTS / TOTAL", agents.length],
            ["OPERATIONAL", agents.filter((agent) => agent.allow_chat !== false).length],
            ["ACTIVE / 24H", Math.min(agents.length, 3)],
            ["NEEDS ATTENTION", agents.filter((agent) => agent.visibility === "private").length],
          ].map(([label, value]) => (
            <div key={String(label)} className="surface-card p-4">
              <p className="font-code text-[10px] text-[var(--ink-faint)]">{label}</p>
              <p className="mt-3 font-display text-[24px] font-bold text-[var(--ink)]">{value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
          </div>
        ) : agents.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-card)] bg-[var(--panel-inverse)] text-white">
              <DeimosIcon name="agent" className="h-5 w-5" />
            </div>
            <p className="font-medium text-[var(--ink)]">{t("agents.noAgent")}</p>
            <p className="mx-auto mb-5 mt-1 max-w-sm text-sm text-[var(--ink-faint)]">
              {t("agents.noAgentHint")}
            </p>
            <Link href="/register" className="btn-outline btn-sm">
              <DeimosIcon name="plus" className="h-3.5 w-3.5" />
              {t("agents.createFirst")}
            </Link>
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
                      <p className="mt-1 font-code text-[10px] text-[var(--accent-success)]">
                        {agent.visibility === "private" ? "PRIVATE" : "PUBLIC"}
                        {agent.allow_chat === false ? " · CHAT OFF" : " · OPERATIONAL"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Link
                        href={`/agents/${agent.id}/configure`}
                        className="inline-flex items-center gap-1 font-code text-[10px] text-[var(--accent-link)] hover:underline"
                      >
                        <DeimosIcon name="gear" className="h-3 w-3" />
                        {t("agents.configure")}
                      </Link>
                      <button
                        type="button"
                        className="font-code text-[10px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
                        onClick={() => setExpandedId(expanded ? null : agent.id)}
                      >
                        {expanded ? t("agents.hideKey") : t("agents.apiKey")}
                      </button>
                      <button
                        type="button"
                        className="font-code text-[10px] text-[var(--ink-faint)] hover:text-[var(--coral)]"
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
          <aside className="space-y-4">
            <section className="panel-inverse p-4 font-code text-[10px] leading-6">
              <p className="panel-inverse-accent">FLEET / LIVE</p>
              <p className="mt-3 panel-inverse-muted">connected&nbsp;&nbsp;{agents.length}</p>
              <p className="panel-inverse-muted">chat enabled&nbsp;&nbsp;{agents.filter((agent) => agent.allow_chat !== false).length}</p>
              <p className="panel-inverse-muted">private identities&nbsp;&nbsp;{agents.filter((agent) => agent.visibility === "private").length}</p>
              <p className="mt-3 text-[var(--accent-link)]">Every execution is attributed.</p>
            </section>
            <section className="callout-link p-4">
              <p className="font-code text-[10px] text-[var(--accent-link)]">MCP ACCESS</p>
              <p className="mt-3 text-[12px] leading-5 text-[var(--accent-link)]">
                {t("agents.keyBelongsTo")}
              </p>
              <Link href="/docs/mcp" className="mt-4 inline-flex font-code text-[10px] text-[var(--accent-link)]">OPEN MCP DOCS →</Link>
            </section>
            <section className="callout-primary p-4">
              <p className="font-code text-[10px] text-[var(--primary)]">SECURITY NOTE</p>
              <p className="mt-3 text-[12px] leading-5 text-[var(--ink-soft)]">
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
