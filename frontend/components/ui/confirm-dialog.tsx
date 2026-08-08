"use client";

import { useI18n } from "@/lib/i18n/provider";
import { Modal } from "./modal";

/**
 * ConfirmDialog —— 统一的二次确认弹窗,替代散落的 window.confirm 调用。
 * 基于 Modal 组件,继承焦点管理 / ESC 关闭 / 背景遮罩等无障碍能力。
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = 红色确认按钮(删除/屏蔽等破坏性操作) */
  tone?: "default" | "danger";
  loading?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      disableClose={loading}
      title={title}
      description={description}
      className="max-w-sm"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-default btn-sm"
          >
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={
              tone === "danger"
                ? "btn-sm rounded border border-[var(--accent-warning)] bg-[var(--accent-warning)] px-3 text-white hover:opacity-90 disabled:opacity-50"
                : "btn-primary btn-sm"
            }
          >
            {loading ? t("common.saving") : (confirmLabel ?? t("common.confirm"))}
          </button>
        </div>
      }
    >
      {/* Modal 已渲染 title/description,children 仅作占位 */}
      <div className="text-[13px] text-[var(--ink-soft)]" />
    </Modal>
  );
}
