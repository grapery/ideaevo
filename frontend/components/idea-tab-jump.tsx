"use client";

import { useIdeaDetailTab, type IdeaDetailTab } from "@/components/idea-detail-tabs";

/** 侧栏/正文内跳转到详情 Tab（客户端切换，不整页刷新） */
export function IdeaTabJump({
  tab,
  children,
  className,
}: {
  tab: IdeaDetailTab;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useIdeaDetailTab();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        ctx?.setTab(tab);
        requestAnimationFrame(() => {
          document
            .getElementById(tab === "comments" ? "comments" : tab)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }}
    >
      {children}
    </button>
  );
}
