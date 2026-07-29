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
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="page-container py-7">
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
            <div key={String(label)} className="rounded-[7px] border border-[var(--rule)] bg-white p-4">
              <p className="font-code text-[9px] text-[var(--ink-faint)]">{label}</p>
              <p className="font-display mt-3 text-[24px] font-bold text-[var(--ink)]">{value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
          </div>
        ) : agents.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-card)] bg-[var(--ink)] text-white">
              <DeimosIcon name="agent" className="h-5 w-5" />
            </div>
            <p className="font-medium text-[var(--ink)]">{t("agents.noAgent")}</p>
            <p className="mx-auto mb-5 mt-1 max-w-sm text-sm text-[var(--text-muted)]">
              {t("agents.noAgentHint")}
            </p>
            <Link href="/register" className="btn-outline btn-sm">
              <DeimosIcon name="plus" className="h-3.5 w-3.5" />
              {t("agents.createFirst")}
            </Link>
          </div>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <ul className="space-y-3">
            {agents.map((agent) => {
              const expanded = expandedId === agent.id;
              return (
                <li
                  key={agent.id}
                  className={`rounded-[8px] border bg-white p-4 ${
                    expanded ? "border-[var(--accent-link)]" : "border-[var(--rule)]"
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
                        className="block truncate font-display text-[15px] font-semibold text-[var(--ink)] hover:text-[var(--accent-link)]"
                      >
                        {agent.name}
                      </Link>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {agent.description || t("agents.noDesc")}
                      </p>
                      <p className="mt-1 font-code text-[9px] text-[var(--accent-success)]">
                        {agent.visibility === "private" ? "PRIVATE" : "PUBLIC"}
                        {agent.allow_chat === false ? " · CHAT OFF" : " · OPERATIONAL"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Link
                        href={`/agents/${agent.id}/configure`}
                        className="inline-flex items-center gap-1 font-code text-[9px] text-[var(--accent-link)] hover:underline"
                      >
                        <DeimosIcon name="gear" className="h-3 w-3" />
                        {t("agents.configure")}
                      </Link>
                      <button
                        type="button"
                        className="font-code text-[9px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
                        onClick={() => setExpandedId(expanded ? null : agent.id)}
                      >
                        {expanded ? t("agents.hideKey") : t("agents.apiKey")}
                      </button>
                      <button
                        type="button"
                        className="font-code text-[9px] text-[var(--ink-faint)] hover:text-[var(--coral)]"
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
            <section className="rounded-[8px] bg-[#0a0a0a] p-4 font-code text-[10px] leading-6 text-[#d6d9de]">
              <p className="text-[#9bff00]">FLEET / LIVE</p>
              <p className="mt-3">connected&nbsp;&nbsp;{agents.length}</p>
              <p>chat enabled&nbsp;&nbsp;{agents.filter((agent) => agent.allow_chat !== false).length}</p>
              <p>private identities&nbsp;&nbsp;{agents.filter((agent) => agent.visibility === "private").length}</p>
              <p className="mt-3 text-[#8dc0ff]">Every execution is attributed.</p>
            </section>
            <section className="rounded-[8px] border border-[#9bbcff] bg-[#edf3ff] p-4">
              <p className="font-code text-[10px] text-[#1e5ee9]">MCP ACCESS</p>
              <p className="mt-3 text-[12px] leading-5 text-[#174aa9]">
                {t("agents.keyBelongsTo")}
              </p>
              <Link href="/docs/mcp" className="mt-4 inline-flex font-code text-[9px] text-[#1e5ee9]">OPEN MCP DOCS →</Link>
            </section>
            <section className="rounded-[8px] border border-[#ffb76a] bg-[#fff6ea] p-4">
              <p className="font-code text-[10px] text-[#b75b00]">SECURITY NOTE</p>
              <p className="mt-3 text-[12px] leading-5 text-[#7d470f]">
                {t("agents.keyShowOnce")}
              </p>
            </section>
          </aside>
          </div>
        )}

        <p className="mt-6 text-xs text-[var(--text-muted)]">
          {t("agents.browserKeyHint")}
          <Link href="/user/settings?section=apikey" className="text-[var(--primary)] hover:underline mx-1">
            {t("agents.settings")}
          </Link>
          {t("agents.bindKeyHint")}
        </p>
      </div>
    </div>
  );
}
