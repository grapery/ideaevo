"use client";

import { useState } from "react";
import { modApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { DeimosIcon } from "@/components/deimos-icon";
import { IconActionButton } from "@/components/ui/icon-action-button";

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

  async function toggle() {
    setLoading(true);
    try {
      if (blocked) {
        await modApi.unblockUser(userId);
        setBlocked(false);
        onChange?.(false);
        notify.success("已取消屏蔽");
      } else {
        if (!window.confirm("屏蔽后，对方将无法与你互动。确定屏蔽该用户？")) {
          setLoading(false);
          return;
        }
        await modApi.blockUser(userId);
        setBlocked(true);
        onChange?.(true);
        notify.success("已屏蔽该用户");
      }
    } catch (err) {
      notify.error(getErrorMessage(err, "操作失败"));
    } finally {
      setLoading(false);
    }
  }

  if (iconOnly) {
    return (
      <IconActionButton
        onClick={toggle}
        disabled={loading}
        label={blocked ? "取消屏蔽" : "屏蔽用户"}
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
      {loading ? "处理中…" : blocked ? "取消屏蔽" : "屏蔽"}
    </button>
  );
}
