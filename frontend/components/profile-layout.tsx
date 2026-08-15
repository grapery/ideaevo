"use client";

import type { ReactNode } from "react";
import { DeimosIcon, type DeimosIconName } from "./deimos-icon";
import { IconLeaf } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";

/**
 * ProfileLayout —— 统一的主页主体（sticky Tab + 主列/侧栏两栏）。
 * 借鉴 GitHub profile/repo 页：Tab 吸顶、主列 + About 侧栏。
 * Agent 页和两个用户页共用。
 */

export interface ProfileTab {
  key: string;
  label: string;
  count?: number;
}

export interface ProfileLayoutProps {
  tabs: ProfileTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  sidebar?: ReactNode;
  children: ReactNode;
}

// profile tab 语义图标
function profileTabIcon(key: string): DeimosIconName {
  switch (key) {
    case "overview": return "sparkles";
    case "ideas": return "document";
    case "agents": return "agent";
    case "activity": return "pulse";
    case "followers": return "users";
    case "following": return "follow";
    case "sessions": return "chat";
    case "api": return "key";
    default: return "leaf";
  }
}

export function ProfileLayout({
  tabs,
  activeTab,
  onTabChange,
  sidebar,
  children,
}: ProfileLayoutProps) {
  return (
    <div>
      <nav className="tabbar sticky-tabbar z-30 mt-4">
        <div className="page-container overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              data-active={activeTab === t.key ? "true" : undefined}
              className="tabbar-tab"
            >
              <span className="hidden sm:inline-flex">
                <DeimosIcon name={profileTabIcon(t.key)} className="h-3.5 w-3.5" />
              </span>
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className="count-badge">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="page-container py-6">
        <div className="app-grid-2">
          <main className="min-w-0">{children}</main>
          {sidebar && (
            <aside className="space-y-4 lg:block">{sidebar}</aside>
          )}
        </div>
      </div>
    </div>
  );
}

/** GitHub-style "About" sidebar card. */
export function AboutCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={`surface-card p-4 ${className}`.trim()}>
      <h3 className="mb-3 border-b border-[var(--rule)] pb-3 text-[12px] font-semibold text-[var(--ink)]">
        {title ?? t("agents.aboutAgent")}
      </h3>
      {children}
    </div>
  );
}

/** Key-value row inside an About card. */
export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-[var(--ink-faint)]">{label}</span>
      <span className="font-semibold tabular-nums text-[var(--ink)]">{value}</span>
    </div>
  );
}

/** Unified empty state. */
export function ProfileEmptyState({ text }: { text: string }) {
  return (
    <div className="surface-card py-16 text-center text-[var(--ink-faint)]">
      <IconLeaf className="mx-auto mb-3 h-10 w-10" aria-hidden="true" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
