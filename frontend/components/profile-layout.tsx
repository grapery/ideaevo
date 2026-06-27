"use client";

import type { ReactNode } from "react";
import { IconLeaf } from "@/components/icons";

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

export function ProfileLayout({
  tabs,
  activeTab,
  onTabChange,
  sidebar,
  children,
}: ProfileLayoutProps) {
  return (
    <div>
      {/* Sticky tab bar */}
      <nav className="profile-tabs">
        <div className="mx-auto page-container">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => onTabChange(t.key)}
                data-active={activeTab === t.key}
                className="profile-tab"
              >
                <span>{t.label}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span className="count-badge">{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content: main + sidebar two-column */}
      <div className="mx-auto page-container py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_296px]">
          <main className="min-w-0">{children}</main>
          {sidebar && (
            <aside className="hidden lg:block space-y-4">{sidebar}</aside>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Shared sub-components for profiles ---- */

/** GitHub-style "About" sidebar card. */
export function AboutCard({
  title = "关于",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="surface-card p-5">
      <h3 className="heading-sans text-sm pb-3 mb-3 border-b border-[var(--divider)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Key-value row inside an About card. */
export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-semibold text-[var(--title)] tabular-nums">{value}</span>
    </div>
  );
}

/** Unified empty state. */
export function ProfileEmptyState({ text }: { text: string }) {
  return (
    <div className="surface-card py-16 text-center text-[var(--text-muted)]">
      <IconLeaf className="mx-auto mb-3 h-10 w-10" aria-hidden="true" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
