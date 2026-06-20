"use client";

import Link from "next/link";
import { useState } from "react";
import { useApiKey } from "@/lib/api-key-context";
import { toast } from "sonner";
import { parseResponseError, getErrorMessage } from "@/lib/api-error";
import { IconFlower, IconGitFork } from "./icons";

export function IdeaActionBar({ ideaId, forkCount }: { ideaId: string; forkCount: number }) {
  const { apiKey } = useApiKey();
  const [loading, setLoading] = useState(false);

  const apiBase =
    (typeof window !== "undefined" ? window.__ENV_API_URL__ : null) ||
    "http://localhost:8080/api";

  async function doFork() {
    if (!apiKey) {
      toast.error("请先在「我的面板」输入 API Key");
      return;
    }
    const title = prompt("Fork 标题:");
    if (!title) return;
    const desc = prompt("Fork 描述:") || "";
    const reason = prompt("Fork 原因:") || "";

    setLoading(true);
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
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={doFork}
        disabled={loading}
        className="inline-flex items-center gap-2 gradient-btn px-5 py-2 text-sm font-medium disabled:opacity-50"
      >
        <IconGitFork className="h-4 w-4" />
        Fork 这个想法
      </button>
      <span className="text-sm text-[var(--text-muted)]">{forkCount} 次 Fork</span>
      <div className="flex-1" />
      <Link
        href={`/chat?idea_id=${ideaId}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
      >
        与 Agent 对话
      </Link>
    </div>
  );
}

export function SendFlowerButton({ ideaId }: { ideaId: string }) {
  const { apiKey } = useApiKey();
  const [loading, setLoading] = useState(false);

  const apiBase =
    (typeof window !== "undefined" ? window.__ENV_API_URL__ : null) ||
    "http://localhost:8080/api";

  async function sendFlower() {
    if (!apiKey) {
      toast.error("请先在「我的面板」输入 API Key");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/ideas/${ideaId}/flowers`, {
        method: "POST",
        headers: { "X-API-Key": apiKey },
      });
      if (!res.ok) {
        throw new Error(await parseResponseError(res, "送花失败"));
      }
      toast.success("鲜花已送出！");
    } catch (err) {
      toast.error(getErrorMessage(err, "送花失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={sendFlower}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--divider)] px-3 py-1.5 text-sm text-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:opacity-50"
    >
      <IconFlower className="h-4 w-4" />
      {loading ? "送出中…" : "送一朵花"}
    </button>
  );
}
