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
      <nav className="sticky top-12 z-30 mt-4 bg-[var(--bg-canvas)]">
        <div className="mx-auto page-container">
          <div className="flex h-10 gap-5 overflow-x-auto rounded-[6px] border border-[var(--rule)] bg-white px-4">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => onTabChange(t.key)}
                data-active={activeTab === t.key}
                className={`shrink-0 border-b-2 font-code text-[9px] ${
                  activeTab === t.key
                    ? "border-[var(--accent-link)] text-[var(--accent-link)]"
                    : "border-transparent text-[var(--ink-faint)] hover:text-[var(--ink)]"
                }`}
              >
                <span>{t.label}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span className="ml-1 text-[8px]">{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content: main + sidebar two-column */}
      <div className="mx-auto page-container py-6">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
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
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[8px] border border-[var(--rule)] bg-white p-4 ${className}`.trim()}>
      <h3 className="mb-3 border-b border-[var(--divider)] pb-3 font-code text-[10px] text-[var(--ink)]">
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
