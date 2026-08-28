import Link from "next/link";
import { Agent, CAPABILITY_I18N_KEYS } from "@/lib/types";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { DeimosIcon } from "@/components/deimos-icon";
import { agentCategoryIcon, agentCategoryLabelKey } from "@/lib/agent-meta";
import type { TranslationKey } from "@/lib/i18n/messages";

/** 服务端 getServerI18n 与客户端 useI18n 的 t 签名一致，卡片组件两者通用。 */
export type AgentCardT = (
  key: TranslationKey,
  values?: Record<string, string | number>,
) => string;

const MAX_CAP_CHIPS = 4;

interface AgentCardProps {
  agent: Agent;
  t: AgentCardT;
  /** 是否展示创建者行（个人主页里创建者就是本人，可省略）。 */
  showOwner?: boolean;
  className?: string;
}

function capabilityLabel(cap: string, t: AgentCardT): { text: string; mono: boolean } {
  const key = CAPABILITY_I18N_KEYS[cap];
  if (key) return { text: t(key), mono: false };
  return { text: cap, mono: true };
}

/**
 * Agent 交互卡片：整卡可点（拉伸链接），头像 + 分类徽章 + 能力标签 +
 * 统计/对话入口，hover 时边框、投影、标题色、右侧箭头同步反馈。
 */
export function AgentCard({ agent, t, showOwner = true, className }: AgentCardProps) {
  const ownerName = agent.owner?.name;
  const ownerHref = agent.is_personal && agent.owner ? `/users/${agent.owner.id}` : undefined;
  const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  const chips = caps.slice(0, MAX_CAP_CHIPS).map((cap) => ({ cap, ...capabilityLabel(cap, t) }));
  const capOverflow = caps.length - MAX_CAP_CHIPS;

  return (
    // 拉伸链接铺满卡片，创建者链接叠加其上，避免 <a> 嵌套
    <article
      className={`group relative surface-card flex flex-col p-5 transition-shadow hover:border-[var(--rule-strong)] hover:shadow-[var(--shadow-md)] ${className || ""}`}
    >
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
              {t(agentCategoryLabelKey(agent.category))}
            </span>
            {agent.visibility === "private" && (
              <span className="badge-pill badge-outline inline-flex items-center gap-1 text-[var(--ink-faint)]">
                <DeimosIcon name="lock" className="h-3 w-3" />
                {t("common.private")}
              </span>
            )}
          </div>
          {/* 创建者（独立链接，点击不触发整卡跳转） */}
          {showOwner && ownerName && (
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

      <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[var(--ink-soft)]">
        {agent.description || t("agents.noDesc")}
      </p>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map(({ cap, text, mono }) => (
            <span key={cap} className={`tag-pill ${mono ? "font-mono" : ""}`}>
              {text}
            </span>
          ))}
          {capOverflow > 0 && (
            <span className="tag-pill text-[var(--ink-faint)]">
              {t("agents.capMore", { count: capOverflow })}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center gap-3 border-t border-[var(--rule)] pt-3 text-[12px] text-[var(--ink-faint)]">
        {/* 恒渲染关注者数(无数据按 0), 保证多卡底部行对齐 */}
        <span className="inline-flex items-center gap-1 tabular-nums">
          <DeimosIcon name="follow" className="h-3.5 w-3.5" />
          {t("agents.followersCount", { count: agent.follower_count ?? 0 })}
        </span>
        {agent.allow_chat ? (
          // 对话入口徽标：常驻可见的交互暗示，hover 时强化为品牌橙
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-soft)] transition-colors group-hover:border-[var(--primary)]/40 group-hover:text-[var(--primary)]">
            <DeimosIcon name="chat" className="h-3.5 w-3.5" />
            {t("agents.chatCta")}
          </span>
        ) : (
          <DeimosIcon
            name="chevron-right"
            className="ml-auto h-4 w-4 text-[var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </div>
    </article>
  );
}
