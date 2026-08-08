"use client";

import { useState } from "react";
import { modApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { DeimosIcon } from "@/components/deimos-icon";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/provider";

/**
 * BlockButton — 屏蔽/取消屏蔽用户，对接 POST/DELETE /users/:id/block。
 * 父组件可通过 GET /users/:id/block 注入双向屏蔽状态。
 */
export function BlockButton({
  userId,
  initialBlocked = false,
  className = "",
  iconOnly = false,
  onChange,
}: {
  userId: string;
  initialBlocked?: boolean;
  className?: string;
  iconOnly?: boolean;
  onChange?: (blocked: boolean) => void;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { t } = useI18n();

  async function doBlock() {
    setConfirmOpen(false);
    setLoading(true);
    try {
      await modApi.blockUser(userId);
      setBlocked(true);
      onChange?.(true);
      notify.success(t("block.blocked"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    if (blocked) {
      setLoading(true);
      try {
        await modApi.unblockUser(userId);
        setBlocked(false);
        onChange?.(false);
        notify.success(t("block.unblocked"));
      } catch (err) {
        notify.error(getErrorMessage(err, t("common.operationFailed")));
      } finally {
        setLoading(false);
      }
      return;
    }
    setConfirmOpen(true);
  }

  const trigger = iconOnly ? (
    <IconActionButton
      onClick={toggle}
      disabled={loading}
      label={blocked ? t("block.unblockUser") : t("block.blockUser")}
      tone={blocked ? "danger" : "default"}
      className={className}
      icon={<DeimosIcon name={blocked ? "check" : "shield"} className="h-[18px] w-[18px]" />}
    />
  ) : (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`btn-default disabled:opacity-50 ${className}`}
    >
      {loading
        ? t("block.processing")
        : blocked
          ? t("block.unblockUser")
          : t("block.blockUser")}
    </button>
  );

  return (
    <>
      {trigger}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doBlock}
        title={t("block.blockUser")}
        description={t("block.confirm")}
        confirmLabel={t("block.blockUser")}
        tone="danger"
        loading={loading}
      />
    </>
  );
}
