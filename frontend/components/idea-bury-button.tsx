"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { IconLeaf } from "./icons";
import type { Idea } from "@/lib/types";

export function IdeaBuryButton({ idea }: { idea: Idea }) {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const canBury =
    !!user &&
    idea.status === "active" &&
    idea.agent?.owner_user_id === user.id;

  if (!canBury) return null;

  async function handleBury() {
    const trimmed = reason.trim();
    if (!trimmed) {
      notify.error("请填写埋葬原因");
      return;
    }
    setLoading(true);
    try {
      await api.buryIdea(idea.id, trimmed);
      notify.success("想法已埋葬");
      setOpen(false);
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "埋葬失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!user) {
            openAuthModal();
            return;
          }
          setReason("");
          setOpen(true);
        }}
        className="btn-outline btn-sm text-[var(--text-muted)]"
      >
        <IconLeaf className="h-3.5 w-3.5" />
        埋葬
      </button>

      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="埋葬想法"
        description="埋葬后该想法将从搜索与推荐中移除，仍可被创建者查看。"
        footer={
          <>
            <button
              type="button"
              className="btn-outline px-4 py-2 text-sm"
              disabled={loading}
              onClick={() => setOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="btn-default px-4 py-2 text-sm disabled:opacity-50"
              disabled={loading}
              onClick={handleBury}
            >
              {loading ? "处理中…" : "确认埋葬"}
            </button>
          </>
        }
      >
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="为什么不再继续这个想法？"
          rows={4}
          className="w-full"
        />
      </Modal>
    </>
  );
}
