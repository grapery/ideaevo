"use client";

import { useState } from "react";
import { useApiKey } from "@/lib/api-key-context";
import { toast } from "sonner";
import { parseResponseError, getErrorMessage } from "@/lib/api-error";

export function IdeaActions({ ideaId }: { ideaId: string }) {
  const { apiKey, isReady } = useApiKey();
  const [loading, setLoading] = useState<string | null>(null);

  const apiBase =
    (typeof window !== "undefined"
      ? window.__ENV_API_URL__
      : null) || "http://localhost:8080/api";

  async function doAction(action: string, method: string) {
    if (!apiKey) {
      toast.error("请先在「我的面板」输入 API Key");
      return;
    }
    setLoading(action);
    try {
      const res = await fetch(`${apiBase}/ideas/${ideaId}/${action}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
      });
      if (!res.ok) {
        throw new Error(await parseResponseError(res, "操作失败"));
      }
      toast.success(
        action === "like"
          ? "已点赞！"
          : action === "flowers"
            ? "鲜花已送出！"
            : "操作成功"
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "操作失败"));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-3 mt-4">
      <button
        onClick={() => doAction("like", "POST")}
        disabled={!!loading}
        className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
      >
        {loading === "like" ? "…" : "❤️ 点赞"}
      </button>
      <button
        onClick={() => doAction("flowers", "POST")}
        disabled={!!loading}
        className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
      >
        {loading === "flowers" ? "…" : "🌸 送花"}
      </button>
      <button
        onClick={() => {
          const title = prompt("Fork 标题:");
          if (!title) return;
          const desc = prompt("Fork 描述:") || "";
          const reason = prompt("Fork 原因:") || "";
          doFork(title, desc, reason);
        }}
        disabled={!!loading}
        className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
      >
        🍴 Fork
      </button>
      {!isReady && (
        <span className="text-xs text-[var(--text-muted)]">
          需要登录后操作
        </span>
      )}
    </div>
  );

  async function doFork(title: string, desc: string, reason: string) {
    if (!apiKey) {
      toast.error("请先在「我的面板」输入 API Key");
      return;
    }
    setLoading("fork");
    try {
      const res = await fetch(`${apiBase}/ideas/${ideaId}/fork`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ title, description: desc, reason }),
      });
      if (!res.ok) {
        throw new Error(await parseResponseError(res, "Fork 失败"));
      }
      const data = await res.json();
      toast.success(`Fork 成功！新想法 ID: ${data.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Fork 失败"));
    } finally {
      setLoading(null);
    }
  }
}
