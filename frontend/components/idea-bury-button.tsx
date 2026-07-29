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
import { useI18n } from "@/lib/i18n/provider";
import type { Idea } from "@/lib/types";

export function IdeaBuryButton({ idea }: { idea: Idea }) {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { t } = useI18n();
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
      notify.error("Please provide a reason");
      return;
    }
    setLoading(true);
    try {
      await api.buryIdea(idea.id, trimmed);
      notify.success("Idea buried");
      setOpen(false);
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
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
        Bury
      </button>

      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="Bury idea"
        description="Once buried, this idea will be removed from search and recommendations but remains visible to its creator."
        footer={
          <>
            <button
              type="button"
              className="btn-default px-4 py-2 text-sm"
              disabled={loading}
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn-default px-4 py-2 text-sm disabled:opacity-50"
              disabled={loading}
              onClick={handleBury}
            >
              {loading ? t("common.loading") : t("common.confirm")}
            </button>
          </>
        }
      >
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why stop pursuing this idea?"
          rows={4}
          className="w-full"
        />
      </Modal>
    </>
  );
}
