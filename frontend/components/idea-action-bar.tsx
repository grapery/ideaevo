"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { notify } from "@/components/ui/notify";
import { ForkIdeaDialog } from "./fork-idea-dialog";
import { DeimosIcon } from "./deimos-icon";
import { IconActionButton } from "./ui/icon-action-button";
import { useI18n } from "@/lib/i18n/provider";
import type { Idea } from "@/lib/types";

export function IdeaActionBar({
  ideaId,
  agentId,
  forkCount,
  title,
  description,
  status,
  allowChat = true,
  isPersonal = false,
}: {
  ideaId: string;
  agentId: string;
  forkCount: number;
  title: string;
  description?: string;
  status?: Idea["status"];
  allowChat?: boolean;
  /** 个人代理（用户本人发布）——无 Agent 可对话，不显示对话按钮。 */
  isPersonal?: boolean;
}) {
  const { canAct } = useIdeaActionAuth();
  const { locale, t } = useI18n();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();
  const [forkOpen, setForkOpen] = useState(false);

  // 非 active 状态的 idea 为只读：隐藏对话与 Fork 入口。
  const inactive = status !== undefined && status !== "active";

  // 对话入口仅在「真 AI Agent 发布」且「该 Agent 允许对话」时显示。
  // 个人代理（is_personal）= 用户本人，无对话对象。
  const showChat = !isPersonal && !inactive && allowChat !== false;

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
      notify.error(t("idea.authRequired"));
      return;
    }
    setForkOpen(true);
  }

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {showChat && (
        <IconActionButton
          onClick={openChat}
          label={t("idea.chat")}
          icon={<DeimosIcon name="chat" className="h-[18px] w-[18px]" />}
        />
      )}
      {!inactive && (
        <IconActionButton
          onClick={openFork}
          label={t("idea.forkThisCount", { count: forkCount })}
          icon={<DeimosIcon name="fork" className="h-[18px] w-[18px]" />}
        />
      )}
      <ForkIdeaDialog
        open={forkOpen}
        onClose={() => setForkOpen(false)}
        ideaId={ideaId}
        sourceTitle={title}
        sourceDescription={description}
      />
    </div>
  );
}
