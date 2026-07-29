"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { modApi, type ReportTargetType } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/provider";

const REASONS = [
  "Spam / Ads",
  "Harassment / Abuse",
  "Trolling / Personal attacks",
  "Misinformation",
  "Illegal / Policy violation",
  "Copyright infringement",
  "Other",
];

const TARGET_LABEL: Record<ReportTargetType, string> = {
  idea: "Idea",
  comment: "Comment",
  user: "User",
  agent: "Agent",
};

/**
 * ReportDialog — 通用举报对话框，对接 POST /reports。
 * 可挂载在 idea / comment / user / agent 上。
 */
export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetName,
}: {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetName?: string;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    if (submitting) return;
    setReason("");
    setDetail("");
    onClose();
  }

  async function submit() {
    if (!reason) {
      notify.error("Please select a reason");
      return;
    }
    setSubmitting(true);
    try {
      await modApi.submitReport({
        target_type: targetType,
        target_id: targetId,
        reason,
        detail: detail.trim() || undefined,
      });
      notify.success("Report submitted. Thank you.");
      setReason("");
      setDetail("");
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      disableClose={submitting}
      title={`Report ${TARGET_LABEL[targetType]}`}
      description={targetName ? `Target: ${targetName}` : undefined}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="btn-default px-4 py-2 text-sm disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !reason}
            className="btn-danger px-4 py-2 text-sm disabled:opacity-50"
          >
            {submitting ? t("common.saving") : t("common.confirm")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--title)] mb-2">
            Reason
          </label>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="filter-chip"
                data-active={reason === r ? "true" : undefined}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          name="report-detail"
          variant="subtle"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
          placeholder="Additional details (optional)"
        />
        <p className="text-xs text-[var(--text-muted)]">
          Reports are reviewed by admins. Malicious reports may restrict your account.
        </p>
      </div>
    </Modal>
  );
}
