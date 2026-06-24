"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api-error";
import {
  IDEA_AUTH_REQUIRED_MSG,
  ideaRequestJson,
} from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { useAuth } from "@/lib/auth-context";
import { IconFlower, IconGitFork, IconShare } from "./icons";

export function IdeaActionBar({
  ideaId,
  agentId,
  forkCount,
}: {
  ideaId: string;
  agentId: string;
  forkCount: number;
}) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const chatHref = `/chat?idea_id=${encodeURIComponent(ideaId)}&agent_id=${encodeURIComponent(agentId)}`;

  function openChat() {
    if (!user) {
      router.push("/login");
      return;
    }
    router.push(chatHref);
  }

  async function doFork() {
    if (!canAct) {
      toast.error(IDEA_AUTH_REQUIRED_MSG);
      return;
    }
    const title = prompt("Fork 标题:");
    if (!title) return;
    const desc = prompt("Fork 描述:") || "";
    const reason = prompt("Fork 原因:") || "";

    setLoading(true);
    try {
      const data = await ideaRequestJson<{ id: string }>(
        `/ideas/${ideaId}/fork`,
        {
          method: "POST",
          apiKey: useSession ? undefined : apiKey,
          useSession,
          body: JSON.stringify({ title, description: desc, reason }),
        }
      );
      toast.success(`Fork 成功！新想法 ID: ${data.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Fork 失败"));
    } finally {
      setLoading(false);
    }
  }

  async function doShare() {
    if (!canAct) {
      toast.error(IDEA_AUTH_REQUIRED_MSG);
      return;
    }
    setLoading(true);
    try {
      await ideaRequestJson(`/ideas/${ideaId}/share`, {
        method: "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      toast.success("已分享到动态");
    } catch (err) {
      toast.error(getErrorMessage(err, "分享失败"));
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
      <button
        type="button"
        onClick={doShare}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--divider)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
      >
        <IconShare className="h-4 w-4" />
        分享
      </button>
      <span className="text-sm text-[var(--text-muted)]">{forkCount} 次 Fork</span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={openChat}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
      >
        与 Agent 对话
      </button>
    </div>
  );
}

export function SendFlowerButton({ ideaId }: { ideaId: string }) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const [loading, setLoading] = useState(false);

  async function sendFlower() {
    if (!canAct) {
      toast.error(IDEA_AUTH_REQUIRED_MSG);
      return;
    }
    setLoading(true);
    try {
      await ideaRequestJson(`/ideas/${ideaId}/flowers`, {
        method: "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
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
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--divider)] bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:opacity-50"
    >
      <IconFlower className="h-4 w-4" />
      {loading ? "送出中…" : "送一朵花"}
    </button>
  );
}
