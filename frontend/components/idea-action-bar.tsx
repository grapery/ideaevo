"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IDEA_AUTH_REQUIRED_MSG, ideaRequestJson } from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { ForkIdeaDialog } from "./fork-idea-dialog";
import { DeimosIcon } from "./deimos-icon";
import { Button } from "./ui/button";

export function IdeaActionBar({
  ideaId,
  agentId,
  forkCount,
  title,
  allowChat = true,
}: {
  ideaId: string;
  agentId: string;
  forkCount: number;
  title: string;
  allowChat?: boolean;
}) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [forkOpen, setForkOpen] = useState(false);

  const chatHref = `/chat?idea_id=${encodeURIComponent(ideaId)}&agent_id=${encodeURIComponent(agentId)}`;

  function openChat() {
    if (!user) {
      openAuthModal({ returnUrl: chatHref });
      return;
    }
    router.push(chatHref);
  }

  function openFork() {
    if (!canAct) {
      notify.error(IDEA_AUTH_REQUIRED_MSG);
      return;
    }
    setForkOpen(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      {/* 左侧：idea 信息（Fork 计数） */}
      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
        <DeimosIcon name="fork" className="h-3.5 w-3.5" />
        {forkCount} 次 Fork
      </span>
      <div className="flex-1" />
      {/* 右侧：操作按钮 */}
      <Button
        variant="ghost"
        size="md"
        onClick={openChat}
        className={allowChat === false ? "hidden" : ""}
        icon={<DeimosIcon name="chat" className="h-3.5 w-3.5" />}
      >
        与 Agent 对话
      </Button>
      <Button
        variant="primary"
        onClick={openFork}
        disabled={loading}
        icon={<DeimosIcon name="fork" className="h-4 w-4" />}
      >
        Fork 这个想法
      </Button>
      <ForkIdeaDialog
        open={forkOpen}
        onClose={() => setForkOpen(false)}
        ideaId={ideaId}
        sourceTitle={title}
      />
    </div>
  );
}

export function SendFlowerButton({ ideaId }: { ideaId: string }) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function sendFlower() {
    if (!canAct) {
      notify.error(IDEA_AUTH_REQUIRED_MSG);
      return;
    }
    setLoading(true);
    try {
      await ideaRequestJson(`/ideas/${ideaId}/flowers`, {
        method: "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      notify.success("鲜花已送出！");
      // 刷新服务端数据，让「收到的花」头像列表与累计数同步更新
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "送花失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="md"
      onClick={sendFlower}
      disabled={loading}
      icon={<DeimosIcon name="flower" className="h-4 w-4" />}
    >
      {loading ? "送出中…" : "送一朵花"}
    </Button>
  );
}
