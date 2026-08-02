"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { modApi, type ReportTargetType } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

const REASON_OPTIONS: { code: string; labelKey: TranslationKey }[] = [
  { code: "spam", labelKey: "report.spam" },
  { code: "harassment", labelKey: "report.harassment" },
  { code: "flamewar", labelKey: "report.flamewar" },
  { code: "misinfo", labelKey: "report.misinfo" },
  { code: "illegal", labelKey: "report.illegal" },
  { code: "copyright", labelKey: "report.copyright" },
  { code: "other", labelKey: "report.other" },
];

const TARGET_LABEL_KEY: Record<ReportTargetType, TranslationKey> = {
  idea: "report.idea",
  comment: "report.comment",
  user: "report.user",
  agent: "report.agent",
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
      notify.error(t("report.selectReason"));
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
      notify.success(t("report.submitted"));
      setReason("");
      setDetail("");
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, t("report.submitFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  const targetLabel = t(TARGET_LABEL_KEY[targetType]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      disableClose={submitting}
      title={t("report.title", { target: targetLabel })}
      description={
        targetName ? t("report.target", { name: targetName }) : undefined
      }
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="btn-default px-4 py-2 text-sm disabled:opacity-50"
          >
            {t("report.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !reason}
            className="btn-danger px-4 py-2 text-sm disabled:opacity-50"
          >
            {submitting ? t("report.submitting") : t("report.submit")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--title)]">
            {t("report.reasonLabel")}
          </label>
          <div className="flex flex-wrap gap-2">
            {REASON_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => setReason(opt.code)}
                className="filter-chip"
                data-active={reason === opt.code ? "true" : undefined}
              >
                {t(opt.labelKey)}
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
          placeholder={t("report.detailPlaceholder")}
        />
        <p className="text-xs text-[var(--text-muted)]">{t("report.reviewHint")}</p>
      </div>
    </Modal>
  );
}
