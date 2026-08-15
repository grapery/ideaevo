import Link from "next/link";
import { Agent } from "@/lib/types";
import { getApiBase } from "@/lib/api-base";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";
import { SystemPageHeader } from "@/components/system-page-header";
import { EmptyState } from "@/components/empty-state";
import { getServerI18n } from "@/lib/i18n/server";

const apiBase = getApiBase();

// 分类 chip（与后端 Agent.Category 枚举一致）
const agentCategories = [
  { value: "", key: "agents.catAll" as const },
  { value: "coding", key: "agents.catCoding" as const },
  { value: "design", key: "agents.catDesign" as const },
  { value: "research", key: "agents.catResearch" as const },
  { value: "automation", key: "agents.catAutomation" as const },
  { value: "validation", key: "agents.catValidation" as const },
  { value: "marketing", key: "agents.catMarketing" as const },
  { value: "other", key: "agents.catOther" as const },
];

// 分类语义图标
function agentCategoryIcon(category?: string): DeimosIconName {
  switch (category) {
    case "coding": return "tool";
    case "design": return "smile";
    case "research": return "search";
    case "automation": return "gear";
    case "validation": return "check";
    case "marketing": return "share";
    default: return "agent";
  }
}

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

type ServerT = Awaited<ReturnType<typeof getServerI18n>>["t"];

function AgentCard({ agent, t }: { agent: Agent; t: ServerT }) {
  const categoryLabel =
    agentCategories.find((c) => c.value === agent.category)?.key || "agents.catOther";
  const ownerName = agent.owner?.name;
  const ownerHref = agent.is_personal && agent.owner ? `/users/${agent.owner.id}` : undefined;

  return (
    // 拉伸链接铺满卡片，创建者链接叠加其上，避免 <a> 嵌套
    <article className="group relative surface-card p-5 transition-shadow hover:border-[var(--rule-strong)] hover:shadow-[var(--shadow-md)]">
      <Link
        href={`/agents/${agent.id}`}
        className="absolute inset-0 rounded-[var(--radius-card)]"
        aria-label={t("agents.viewAgent", { name: agent.name })}
      />
      <div className="flex items-start gap-3">
        <WireframeAvatar
          name={agent.name}
          avatarUrl={agent.avatar_url}
          entityId={agent.id}
          kind="agent"
          size={44}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-[var(--ink)] group-hover:text-[var(--accent-link)]">
              {agent.name}
            </h3>
            <span className="badge-pill badge-outline inline-flex items-center gap-1">
              <DeimosIcon name={agentCategoryIcon(agent.category)} className="h-3 w-3" />
              {t(categoryLabel)}
            </span>
          </div>
          {/* 创建者（独立链接，点击不触发整卡跳转） */}
          {ownerName && (
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--ink-faint)]">
              <span>{t("agents.ownerBy", { name: "" })}</span>
              {ownerHref ? (
                <Link
                  href={ownerHref}
                  className="relative z-10 inline-flex items-center gap-1 font-medium text-[var(--ink-soft)] hover:text-[var(--accent-link)]"
                >
                  <WireframeAvatar
                    name={ownerName}
                    avatarUrl={agent.owner?.avatar_url}
                    entityId={agent.owner?.id}
                    kind="user"
                    size={14}
                  />
                  {ownerName}
                </Link>
              ) : (
                <span className="font-medium text-[var(--ink-soft)]">{ownerName}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {agent.description && (
        <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[var(--ink-soft)]">
          {agent.description}
        </p>
      )}

      {Array.isArray(agent.capabilities) && agent.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {agent.capabilities.slice(0, 4).map((cap) => (
            <span key={cap} className="tag-pill font-mono">
              {cap}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 border-t border-[var(--rule)] pt-3 text-[12px] text-[var(--ink-faint)]">
        {typeof agent.follower_count === "number" && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <DeimosIcon name="follow" className="h-3.5 w-3.5" />
            {t("agents.followersCount", { count: agent.follower_count })}
          </span>
        )}
        {agent.allow_chat && (
          <span className="inline-flex items-center gap-1">
            <DeimosIcon name="chat" className="h-3.5 w-3.5" />
            {t("agents.chatEnabled")}
          </span>
        )}
        <DeimosIcon
          name="chevron-right"
          className="ml-auto h-4 w-4 text-[var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
    </article>
  );
}
