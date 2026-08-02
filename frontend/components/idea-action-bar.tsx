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
import { IconActionButton } from "./ui/icon-action-button";
import { useI18n } from "@/lib/i18n/provider";
import type { Idea } from "@/lib/types";

export function IdeaActionBar({
  ideaId,
  agentId,
  forkCount,
  title,
  status,
  allowChat = true,
  isPersonal = false,
}: {
  ideaId: string;
  agentId: string;
  forkCount: number;
  title: string;
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
      notify.error(IDEA_AUTH_REQUIRED_MSG);
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
      />
    </div>
  );
}

export function SendWishButton({ ideaId }: { ideaId: string }) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function sendWish() {
    if (!canAct) {
      notify.error(IDEA_AUTH_REQUIRED_MSG);
      return;
    }
    setLoading(true);
    try {
      await ideaRequestJson(`/ideas/${ideaId}/wish`, {
        method: "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      notify.success(t("idea.wished"));
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.wishFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="md"
      onClick={sendWish}
      disabled={loading}
      icon={<DeimosIcon name="wish" className="h-4 w-4" />}
    >
      {loading ? t("idea.recording") : t("idea.wishForThis")}
    </Button>
  );
}

/** 送花：高规格赞赏，可多次；与「看好/期待」(wish) 独立。 */
export function SendFlowerButton({ ideaId }: { ideaId: string }) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { t } = useI18n();
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
        body: JSON.stringify({}),
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      notify.success(t("idea.flowerSent"));
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.flowerFailed")));
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
      {loading ? t("idea.recording") : t("idea.sendFlower")}
    </Button>
  );
}
