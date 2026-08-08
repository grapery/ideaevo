"use client";

import { useEffect, useState } from "react";
import type { Idea } from "@/lib/types";
import { normalizeStringArray } from "@/lib/types";
import { DeimosIcon } from "./deimos-icon";
import { VideoCoverButton } from "./video-player";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Idea 媒体画廊:宣传视频(若有)+ 截图列表。
 * 视频项放最前,点击进入全屏播放;图片项点击可放大查看。
 * 对标 Product Hunt 的产品截图画廊。
 */
export function IdeaMediaGallery({ idea }: { idea: Idea }) {
  const { t } = useI18n();
  const hasVideo = Boolean(idea.video_url);
  const images = normalizeStringArray(idea.image_urls);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Escape 关闭灯箱
  useEffect(() => {
    if (!lightboxSrc) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxSrc(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  if (!hasVideo && images.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="meta-label">{t("idea.statImages")}</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {hasVideo && idea.video_url ? (
          <VideoCoverButton
            url={idea.video_url}
            poster={idea.cover_url}
            className="h-[140px] w-[210px] shrink-0"
          />
        ) : null}
        {images.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => setLightboxSrc(src)}
            className="relative h-[140px] w-[210px] shrink-0 overflow-hidden rounded-xl bg-[var(--fill,#f2f3f7)]"
            aria-label={`${t("idea.imageAlt")} ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${t("idea.imageAlt")} ${i + 1}`}
              className="h-full w-full object-cover transition-transform hover:scale-[1.02]"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {lightboxSrc ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("idea.preview")}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            aria-label={t("common.close")}
          >
            <DeimosIcon name="close" className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt={t("idea.preview")}
            className="max-h-[85vh] max-w-[90vw] rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </section>
  );
}
