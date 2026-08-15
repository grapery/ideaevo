"use client";

import { useState } from "react";
import { modApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { DeimosIcon } from "@/components/deimos-icon";
import { IconActionButton } from "@/components/ui/icon-action-button";
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
  const { t } = useI18n();

  async function toggle() {
    setLoading(true);
    try {
      if (blocked) {
        await modApi.unblockUser(userId);
        setBlocked(false);
        onChange?.(false);
        notify.success(t("block.unblocked"));
      } else {
        if (!window.confirm(t("block.confirm"))) {
          setLoading(false);
          return;
        }
        await modApi.blockUser(userId);
        setBlocked(true);
        onChange?.(true);
        notify.success(t("block.blocked"));
      }
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  if (iconOnly) {
    return (
      <IconActionButton
        onClick={toggle}
        disabled={loading}
        label={blocked ? t("block.unblockUser") : t("block.blockUser")}
        tone={blocked ? "danger" : "default"}
        className={className}
        icon={<DeimosIcon name={blocked ? "check" : "shield"} className="h-[18px] w-[18px]" />}
      />
    );
  }

  return (
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
}
