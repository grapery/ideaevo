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
import { DeimosIcon } from "./deimos-icon";
import { useI18n } from "@/lib/i18n/provider";
import type { Idea } from "@/lib/types";

type StatusAction = "bury" | "archive" | "implement" | "reactivate";

export function IdeaStatusActions({ idea }: { idea: Idea }) {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { t } = useI18n();
  const router = useRouter();
  const [action, setAction] = useState<StatusAction | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const isOwner = !!user && idea.agent?.owner_user_id === user.id;
  if (!isOwner) return null;

  const needsReason =
    action === "bury" || action === "archive" || action === "implement";

  async function submit() {
    if (!action) return;
    const trimmed = reason.trim();
    if (needsReason && !trimmed) {
      notify.error(t("idea.statusReasonRequired"));
      return;
    }
    setLoading(true);
    try {
      if (action === "bury") await api.buryIdea(idea.id, trimmed);
      if (action === "archive") await api.archiveIdea(idea.id, trimmed);
      if (action === "implement") await api.implementIdea(idea.id, trimmed);
      if (action === "reactivate") await api.reactivateIdea(idea.id);
      notify.success(t("idea.statusUpdated"));
      setAction(null);
      setReason("");
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  function open(next: StatusAction) {
    if (!user) {
      openAuthModal();
      return;
    }
    setReason("");
    setAction(next);
  }

  const modalTitle =
    action === "bury"
      ? t("idea.buryTitle")
      : action === "archive"
        ? t("idea.archiveTitle")
        : action === "implement"
          ? t("idea.implementTitle")
          : t("idea.reactivateTitle");

  const modalDesc =
    action === "bury"
      ? t("idea.buryDesc")
      : action === "archive"
        ? t("idea.archiveDesc")
        : action === "implement"
          ? t("idea.implementDesc")
          : t("idea.reactivateDesc");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {idea.status === "active" && (
          <>
            <button
              type="button"
              onClick={() => open("implement")}
              className="btn-outline btn-sm"
            >
              <DeimosIcon name="check" className="h-3.5 w-3.5" />
              {t("idea.markImplemented")}
            </button>
            <button
              type="button"
              onClick={() => open("archive")}
              className="btn-outline btn-sm text-[var(--text-muted)]"
            >
              {t("idea.markArchived")}
            </button>
            <button
              type="button"
              onClick={() => open("bury")}
              className="btn-outline btn-sm text-[var(--text-muted)]"
            >
              <IconLeaf className="h-3.5 w-3.5" />
              {t("idea.markBuried")}
            </button>
          </>
        )}
        {idea.status !== "active" && (
          <button
            type="button"
            onClick={() => open("reactivate")}
            className="btn-outline btn-sm"
          >
            {t("idea.reactivate")}
          </button>
        )}
      </div>

      <Modal
        open={action !== null}
        onClose={() => !loading && setAction(null)}
        title={modalTitle}
        description={modalDesc}
        footer={
          <>
            <button
              type="button"
              className="btn-default px-4 py-2 text-sm"
              disabled={loading}
              onClick={() => setAction(null)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              disabled={loading}
              onClick={() => void submit()}
            >
              {loading ? t("common.loading") : t("common.confirm")}
            </button>
          </>
        }
      >
        {needsReason && (
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("idea.statusReasonPlaceholder")}
            rows={4}
            className="w-full"
          />
        )}
      </Modal>
    </>
  );
}

/** @deprecated Use IdeaStatusActions */
export function IdeaBuryButton({ idea }: { idea: Idea }) {
  return <IdeaStatusActions idea={idea} />;
}
