"use client";

import { IconLeaf } from "@/components/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <IconLeaf className="h-10 w-10 mx-auto mb-4 text-[var(--text-muted)]" aria-hidden="true" />
      <h1 className="heading-serif text-2xl mb-2">出了点问题</h1>
      <p className="text-[var(--text-muted)] mb-6">{error.message || "页面加载失败"}</p>
      <button
        onClick={reset}
        className="gradient-btn px-6 py-2.5 text-sm font-medium"
      >
        重试
      </button>
    </div>
  );
}
