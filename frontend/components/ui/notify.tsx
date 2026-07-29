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
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";

type Action = { label: string; onClick: () => void };

type NotifyOptions = {
  /** 提示停留时长（ms），默认 4000，error 默认 5000。 */
  duration?: number;
  /** 带一个可点击的操作按钮，如「查看新想法」。 */
  action?: Action;
  /** toast 唯一 id，用于去重/更新。 */
  id?: string | number;
};

const ICON_CLS = "h-[18px] w-[18px] shrink-0";

function semanticIcon(name: DeimosIconName) {
  return <DeimosIcon name={name} className={ICON_CLS} />;
}

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
    toast.success(message, buildOptions(opts, semanticIcon("check")) as never);
  },
  error(message: string, opts?: NotifyOptions) {
    toast.error(
      message,
      buildOptions(
        { duration: 5000, ...opts },
        semanticIcon("decision"),
      ) as never,
    );
  },
  warning(message: string, opts?: NotifyOptions) {
    toast.warning(
      message,
      buildOptions(opts, semanticIcon("decision")) as never,
    );
  },
  info(message: string, opts?: NotifyOptions) {
    toast.info(message, buildOptions(opts, semanticIcon("bell")) as never);
  },
};

export type { NotifyOptions, Action };
