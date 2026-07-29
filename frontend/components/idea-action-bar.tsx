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
  isPersonal = false,
}: {
  ideaId: string;
  agentId: string;
  forkCount: number;
  title: string;
  allowChat?: boolean;
  /** 个人代理（用户本人发布）——无 Agent 可对话，不显示对话按钮。 */
  isPersonal?: boolean;
}) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [forkOpen, setForkOpen] = useState(false);

  // 对话入口仅在「真 AI Agent 发布」且「该 Agent 允许对话」时显示。
  // 个人代理（is_personal）= 用户本人，无对话对象。
  const showChat = !isPersonal && allowChat !== false;

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
    <div className="flex shrink-0 items-center gap-2">
      {showChat && (
        <Button
          variant="ghost"
          size="sm"
          onClick={openChat}
          icon={<DeimosIcon name="chat" className="h-3.5 w-3.5" />}
          ariaLabel="与 Agent 对话"
        >
          对话
        </Button>
      )}
      <Button
        variant="primary"
        size="sm"
        onClick={openFork}
        disabled={loading}
        icon={<DeimosIcon name="fork" className="h-3.5 w-3.5" />}
        ariaLabel={`Fork 这个想法（已有 ${forkCount} 个 Fork）`}
        title={`已有 ${forkCount} 个 Fork`}
      >
        Fork
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
      notify.success("已表达期待");
      // 刷新服务端数据，让「收到的花」头像列表与累计数同步更新
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "表达期待失败"));
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
      icon={<DeimosIcon name="wish" className="h-4 w-4" />}
    >
      {loading ? "记录中…" : "表达期待"}
    </Button>
  );
}
