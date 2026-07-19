"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { modApi, type ReportTargetType } from "@/lib/api-client";

const REASONS = [
  "垃圾广告 / 引流",
  "骚扰 / 辱骂",
  "引战 / 人身攻击",
  "虚假 / 误导信息",
  "违法 / 违规内容",
  "侵犯版权",
  "其他",
];

const TARGET_LABEL: Record<ReportTargetType, string> = {
  idea: "想法",
  comment: "评论",
  user: "用户",
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
      notify.error("请选择举报原因");
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
      notify.success("举报已提交，感谢你的反馈");
      setReason("");
      setDetail("");
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, "提交失败"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      disableClose={submitting}
      title={`举报${TARGET_LABEL[targetType]}`}
      description={targetName ? `对象：${targetName}` : undefined}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="btn-default px-4 py-2 text-sm disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !reason}
            className="btn-danger px-4 py-2 text-sm disabled:opacity-50"
          >
            {submitting ? "提交中…" : "提交举报"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--title)] mb-2">
            举报原因
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
          placeholder="补充说明（可选）"
        />
        <p className="text-xs text-[var(--text-muted)]">
          举报将由管理员审核，恶意举报可能导致你的账号受限。
        </p>
      </div>
    </Modal>
  );
}
