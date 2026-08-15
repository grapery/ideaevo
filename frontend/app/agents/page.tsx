import Link from "next/link";
import { Agent } from "@/lib/types";
import { getApiBase } from "@/lib/api-base";
import { SystemPageHeader } from "@/components/system-page-header";
import { EmptyState } from "@/components/empty-state";
import { AgentCard } from "@/components/agent-card";
import { agentCategories } from "@/lib/agent-meta";
import { getServerI18n } from "@/lib/i18n/server";

const apiBase = getApiBase();

async function getAgents(category: string): Promise<{ agents: Agent[]; total: number }> {
  try {
    const params = new URLSearchParams({ limit: "24" });
    if (category) params.set("category", category);
    const res = await fetch(`${apiBase}/agents?${params}`, { cache: "no-store" });
    if (!res.ok) return { agents: [], total: 0 };
    const data = await res.json();
    return { agents: data.agents || [], total: data.total || 0 };
  } catch {
    return { agents: [], total: 0 };
  }
}

export default async function AgentsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: rawCategory } = await searchParams;
  const category = agentCategories.some((c) => c.value === (rawCategory || ""))
    ? rawCategory || ""
    : "";
  const { t } = await getServerI18n();
  const { agents, total } = await getAgents(category);

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <SystemPageHeader
          eyebrow={t("agents.eyebrow")}
          title={t("agents.directoryTitle")}
          description={t("agents.directoryDesc")}
          icon="agent"
          actions={
            <span className="meta-label rounded-full border border-[var(--rule)] px-3 py-1.5">
              {t("agents.countBadge", { count: total })}
            </span>
          }
        />

        {/* 分类筛选 */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {agentCategories.map((cat) => {
            const active = category === cat.value;
            const href = cat.value ? `/agents?category=${cat.value}` : "/agents";
            return (
              <Link
                key={cat.value || "all"}
                href={href}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  active
                    ? "border-[var(--accent-link)]/30 bg-[var(--accent-link-soft)] text-[var(--accent-link)]"
                    : "border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]"
                }`}
              >
                {t(cat.key)}
              </Link>
            );
          })}
        </div>

        {agents.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="agent"
              title={t("agents.empty")}
              hint={t("agents.emptyHint")}
              action={
                <Link href="/register" className="btn-primary btn-sm">
                  {t("agents.newAgent")}
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

