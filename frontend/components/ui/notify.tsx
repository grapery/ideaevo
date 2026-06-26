/**
 * 统一提示系统（基于 sonner）。
 *
 * 提供带语义图标与配色的 success / error / warning / info 方法，
 * 对齐项目 design token，替换全站裸调的 toast.success/error。
 *
 * 用法与 sonner 的 toast 兼容：
 *   notify.success("已保存")
 *   notify.error("保存失败")
 *   notify.success("Fork 成功", { action: { label: "查看", onClick } })
 */

import { toast } from "sonner";

type Action = { label: string; onClick: () => void };

type NotifyOptions = {
  /** 提示停留时长（ms），默认 4000，error 默认 5000。 */
  duration?: number;
  /** 带一个可点击的操作按钮，如「查看新想法」。 */
  action?: Action;
  /** toast 唯一 id，用于去重/更新。 */
  id?: string | number;
};

/* ---- 图标（内联 SVG，stroke=currentColor 跟随配色） ---- */

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconAlert({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}
function IconWarning({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

const ICON_CLS = "h-[18px] w-[18px] shrink-0";

function buildOptions(opts: NotifyOptions | undefined, icon: React.ReactNode) {
  if (!opts) return { icon };
  const { duration, action, id } = opts;
  const base: Record<string, unknown> = { icon, duration };
  if (action) {
    base.action = action;
  }
  if (id !== undefined) base.id = id;
  return base;
}

export const notify = {
  success(message: string, opts?: NotifyOptions) {
    toast.success(message, buildOptions(opts, <IconCheck className={ICON_CLS} />) as never);
  },
  error(message: string, opts?: NotifyOptions) {
    toast.error(message, buildOptions({ duration: 5000, ...opts }, <IconAlert className={ICON_CLS} />) as never);
  },
  warning(message: string, opts?: NotifyOptions) {
    toast.warning(message, buildOptions(opts, <IconWarning className={ICON_CLS} />) as never);
  },
  info(message: string, opts?: NotifyOptions) {
    toast.info(message, buildOptions(opts, <IconInfo className={ICON_CLS} />) as never);
  },
};

export type { NotifyOptions, Action };
