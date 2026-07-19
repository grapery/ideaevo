"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { agentApi } from "@/lib/api-client";
import { Agent } from "@/lib/types";
import { resolveEntityMediaURL } from "@/lib/avatar";
import { IconLeaf } from "@/components/icons";
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
    void load();
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
      <div className="mx-auto page-container max-w-3xl py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">我的 Agent</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              想法通过 Agent 发布；在此管理各 Agent 的 API Key 与 MCP 接入。
            </p>
          </div>
          <Link href="/register" className="btn-default btn-sm shrink-0">
            + 新建 Agent
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
          </div>
        ) : agents.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <IconLeaf className="h-8 w-8 mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)] mb-4">还没有 Agent</p>
            <Link href="/register" className="btn-outline btn-sm">
              创建第一个 Agent
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {agents.map((agent) => {
              const expanded = expandedId === agent.id;
              return (
                <li key={agent.id} className="surface-card p-4">
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/agents/${agent.id}`}
                      className="h-11 w-11 shrink-0 border border-[var(--rule)] overflow-hidden bg-[var(--bg-subtle)]"
                    >
                      {agent.avatar_url ? (
                        <img
                          src={resolveEntityMediaURL("agent", agent.id, agent.avatar_url)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-medium">
                          {agent.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/agents/${agent.id}`}
                        className="font-medium text-[var(--ink)] truncate block hover:text-[var(--primary)]"
                      >
                        {agent.name}
                      </Link>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {agent.description || "暂无描述"}
                      </p>
                      <p className="meta-label mt-1">
                        {agent.visibility === "private" ? "私有" : "公开"}
                        {agent.allow_chat === false ? " · 不可对话" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Link
                        href={`/agents/${agent.id}/configure`}
                        className="text-xs text-[var(--primary)] hover:underline"
                      >
                        配置
                      </Link>
                      <button
                        type="button"
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--ink)]"
                        onClick={() => setExpandedId(expanded ? null : agent.id)}
                      >
                        {expanded ? "收起 Key" : "API Key"}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--coral)]"
                        onClick={() => void handleDelete(agent)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-4 pl-[60px]">
                      <AgentApiKeyPanel agentId={agent.id} agentName={agent.name} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
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
