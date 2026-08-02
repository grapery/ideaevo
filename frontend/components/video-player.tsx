"use client";

import { useState } from "react";
import { DeimosIcon } from "./deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

/**
 * 视频封面按钮:显示首帧缩略图 + 播放图标,点击弹出全屏模态播放器。
 * 用于 Idea 详情页的宣传视频展示。列表场景用此按钮避免预加载多个视频。
 */
export function VideoCoverButton({
  url,
  poster,
  className,
}: {
  url: string;
  poster?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative flex items-center justify-center overflow-hidden rounded-xl bg-[var(--fill,#f2f3f7)] ${className ?? ""}`}
        aria-label={t("common.playVideo")}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        <span className="absolute inset-0 bg-black/20 transition-opacity group-hover:bg-black/30" />
        <span className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
          <span className="ml-0.5 text-[var(--ink,#0f1b2d)]">
            <DeimosIcon name="play" className="h-5 w-5" />
          </span>
        </span>
      </button>

      {open ? <VideoModal url={url} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** 全屏视频播放器(HTML5 video,无需第三方库)。 */
function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        aria-label={t("common.close")}
      >
        <DeimosIcon name="close" className="h-5 w-5" />
      </button>
      <video
        src={url}
        controls
        autoPlay
        className="max-h-[85vh] max-w-[90vw] rounded-xl bg-black"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
