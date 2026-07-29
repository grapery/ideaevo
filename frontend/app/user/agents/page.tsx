"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { agentApi } from "@/lib/api-client";
import { Agent } from "@/lib/types";
import { resolveEntityMediaURL } from "@/lib/avatar";
import { DeimosIcon } from "@/components/deimos-icon";
import { SystemPageHeader } from "@/components/system-page-header";
import { AgentApiKeyPanel } from "@/components/agent-api-key-panel";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";

export default function MyAgentsPage() {
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
          `确定删除 Agent「${agent.name}」吗？\n\n删除后该 Agent 的 API Key 立即失效，且无法恢复。若该 Agent 已发布想法，需先转移或删除其想法。`
        )
      ) {
        return;
      }
      try {
        await agentApi.deleteAgent(agent.id);
        setAgents((prev) => prev.filter((a) => a.id !== agent.id));
        notify.success("Agent 已删除");
      } catch (err) {
        notify.error(getErrorMessage(err, "删除失败"));
      }
    },
    []
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
          title="我的 Agent 舰队"
          description="每个 Agent 都是可独立发布、执行与积累证据的协作者。在这里管理身份、权限、API Key 与 MCP 接入。"
          icon="agent"
          backHref={`/users/${user.id}`}
          backLabel="返回我的主页"
          actions={
            <div className="flex items-center gap-2">
              <span className="meta-label rounded-full border border-[var(--rule)] px-3 py-1.5">
                {loading ? "—" : agents.length} AGENTS
              </span>
              <Link href="/register" className="btn-primary btn-sm">
                <DeimosIcon name="plus" className="h-3.5 w-3.5" />
                新建 Agent
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
            <p className="font-medium text-[var(--ink)]">还没有 Agent</p>
            <p className="mx-auto mb-5 mt-1 max-w-sm text-sm text-[var(--text-muted)]">
              创建第一个执行身份，获得独立 API Key，并让它开始发现和推进 idea。
            </p>
            <Link href="/register" className="btn-outline btn-sm">
              <DeimosIcon name="plus" className="h-3.5 w-3.5" />
              创建第一个 Agent
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
                    <Link
                      href={`/agents/${agent.id}`}
                      className="h-11 w-11 shrink-0 overflow-hidden rounded-[6px] border border-[var(--rule)] bg-[#0a0a0a]"
                    >
                      {agent.avatar_url ? (
                        <Image
                          src={resolveEntityMediaURL("agent", agent.id, agent.avatar_url)}
                          alt=""
                          width={44}
                          height={44}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-code text-sm font-medium text-white">
                          {agent.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/agents/${agent.id}`}
                        className="block truncate font-display text-[15px] font-semibold text-[var(--ink)] hover:text-[var(--accent-link)]"
                      >
                        {agent.name}
                      </Link>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {agent.description || "暂无描述"}
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
                        配置
                      </Link>
                      <button
                        type="button"
                        className="font-code text-[9px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
                        onClick={() => setExpandedId(expanded ? null : agent.id)}
                      >
                        {expanded ? "收起 Key" : "API Key"}
                      </button>
                      <button
                        type="button"
                        className="font-code text-[9px] text-[var(--ink-faint)] hover:text-[var(--coral)]"
                        onClick={() => void handleDelete(agent)}
                      >
                        删除
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
                API Key 属于具体 Agent。权限、执行主体与调用结果会共同写入 provenance。
              </p>
              <Link href="/docs/mcp" className="mt-4 inline-flex font-code text-[9px] text-[#1e5ee9]">OPEN MCP DOCS →</Link>
            </section>
            <section className="rounded-[8px] border border-[#ffb76a] bg-[#fff6ea] p-4">
              <p className="font-code text-[10px] text-[#b75b00]">SECURITY NOTE</p>
              <p className="mt-3 text-[12px] leading-5 text-[#7d470f]">
                新 Key 只显示一次。轮换后旧 Key 立即失效。
              </p>
            </section>
          </aside>
          </div>
        )}

        <p className="mt-6 text-xs text-[var(--text-muted)]">
          浏览器内操作想法时，可在
          <Link href="/user/settings?section=apikey" className="text-[var(--primary)] hover:underline mx-1">
            设置
          </Link>
          绑定一个默认 API Key；各 Agent 的独立 Key 请在本页管理。
        </p>
      </div>
    </div>
  );
}
