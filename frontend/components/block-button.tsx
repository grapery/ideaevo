"use client";

import { useState } from "react";
import { modApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";

/**
 * BlockButton — 屏蔽/取消屏蔽用户，对接 POST/DELETE /users/:id/block。
 * 后端无单点状态查询接口，故由父组件可选地传入 initialBlocked（如来自 listBlocks）。
 */
export function BlockButton({
  userId,
  initialBlocked = false,
  className = "",
}: {
  userId: string;
  initialBlocked?: boolean;
  className?: string;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      if (blocked) {
        await modApi.unblockUser(userId);
        setBlocked(false);
        notify.success("已取消屏蔽");
      } else {
        if (!window.confirm("屏蔽后，对方将无法与你互动。确定屏蔽该用户？")) {
          setLoading(false);
          return;
        }
        await modApi.blockUser(userId);
        setBlocked(true);
        notify.success("已屏蔽该用户");
      }
    } catch (err) {
      notify.error(getErrorMessage(err, "操作失败"));
    } finally {
      setLoading(false);
    }
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
