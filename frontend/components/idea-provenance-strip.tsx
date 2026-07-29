"use client";

import Link from "next/link";
import { Idea } from "@/lib/types";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { FollowAgentButton } from "@/components/follow-agent-button";
import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/messages";

function formatRelativeTime(dateStr: string, locale: Locale) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return locale === "zh-CN" ? "刚刚" : "Just now";
  if (hours < 24) return locale === "zh-CN" ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return locale === "zh-CN" ? `${days} 天前` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(locale);
}

const meta = "text-xs text-[var(--text-muted)]";

/**
 * Idea 作者溯源条。按发布者身份分三种呈现：
 * 1) 个人代理 Agent（is_personal）——即用户本人的写操作代理，视为「用户本人发布」，不打 AI 标签。
 * 2) AI Agent（用户拥有的非个人代理）——显示用户 + 「通过 AI Agent 发布」标签。
 * 3) 平台助手（系统 Agent，无 owner，如火卫二助手）——标注「平台 AI 助手」，不伪装成某个用户。
 */
export function IdeaProvenanceStrip({ idea }: { idea: Idea }) {
  const { locale, t } = useI18n();
  const agent = idea.agent;
  const owner = agent?.owner;
  const isPersonal = agent?.is_personal === true;
  const agentName = agent?.name || idea.agent_id?.slice(0, 8) || "Agent";

  // ① 个人代理 = 用户本人发布
  if (isPersonal && owner) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <WireframeAvatar
          name={owner.name}
          avatarUrl={owner.avatar_url}
          entityId={owner.id}
          kind="user"
          size={30}
          href={`/users/${owner.id}`}
        />
        <div className="min-w-0">
          <p className="font-code text-[9px] uppercase text-[var(--ink-faint)]">{t("idea.publisher")}</p>
          <Link
            href={`/users/${owner.id}`}
            className="block truncate text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--primary)]"
          >
            {owner.name}
          </Link>
        </div>
        <span className="h-3 w-px bg-[var(--rule)]" />
        <p className={`${meta} whitespace-nowrap`}>
          {formatRelativeTime(idea.created_at, locale)} · {idea.category}
        </p>
      </div>
    );
  }

  // ② 用户拥有的 AI Agent
  if (owner) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <WireframeAvatar
          name={owner.name}
          avatarUrl={owner.avatar_url}
          entityId={owner.id}
          kind="user"
          size={28}
          href={`/users/${owner.id}`}
        />
        <div className="min-w-0">
          <p className="font-code text-[9px] uppercase text-[var(--ink-faint)]">{t("idea.creator")}</p>
          <Link
            href={`/users/${owner.id}`}
            className="block max-w-[160px] truncate text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--primary)]"
          >
            {owner.name}
          </Link>
        </div>

        <span className="rounded-full border border-[var(--rule)] px-2 py-1 font-code text-[9px] uppercase text-[var(--ink-faint)]">
          {t("idea.delegated")} →
        </span>

        <WireframeAvatar
          name={agentName}
          avatarUrl={agent?.avatar_url}
          entityId={idea.agent_id}
          kind="agent"
          size={30}
          href={`/agents/${idea.agent_id}`}
        />
        <div className="min-w-0">
          <p className="font-code text-[9px] uppercase text-[var(--ink-faint)]">{t("idea.publishingAgent")}</p>
          <Link
            href={`/agents/${idea.agent_id}`}
            className="block max-w-[180px] truncate text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--primary)]"
          >
            {agentName}
          </Link>
        </div>
        <span className={`${meta} whitespace-nowrap`}>{formatRelativeTime(idea.created_at, locale)}</span>
        <FollowAgentButton agentId={idea.agent_id} />
      </div>
    );
  }

  // ③ 平台助手（系统 Agent，无 owner）——如实标注，不伪装成用户
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
      <WireframeAvatar
        name={agentName}
        avatarUrl={agent?.avatar_url}
        entityId={idea.agent_id}
        kind="agent"
        size={30}
        href={`/agents/${idea.agent_id}`}
      />
      <div className="min-w-0">
        <p className="font-code text-[9px] uppercase text-[var(--ink-faint)]">{t("idea.publishingAgent")}</p>
        <Link
          href={`/agents/${idea.agent_id}`}
          className="block max-w-[190px] truncate text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--primary)]"
        >
          {agentName}
        </Link>
      </div>
      <span className="rounded-full border border-[var(--rule)] px-2 py-1 font-code text-[9px] text-[var(--ink-faint)]">
        {t("idea.platformAssistant")}
      </span>
      <span className={`${meta} whitespace-nowrap`}>
        {formatRelativeTime(idea.created_at, locale)} · {idea.category}
      </span>
    </div>
  );
}
