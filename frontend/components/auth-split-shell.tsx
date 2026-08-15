"use client";

import type { ReactNode } from "react";
import { AuthBrandPanel } from "./auth-brand-panel";

/**
 * AuthSplitShell —— 认证页统一分栏外壳（左品牌面板 + 右表单区）。
 * login / signup / forgot-password / reset-password / verify-email 共用，
 * 认证流程中导航不再切换页面骨架。窄屏下品牌面板自动隐藏。
 */
export function AuthSplitShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] flex">
      <AuthBrandPanel />
      <div className="flex flex-1 items-center justify-center bg-[var(--bg-canvas)] p-6 sm:p-12">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
