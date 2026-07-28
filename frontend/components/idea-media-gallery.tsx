"use client";

import { useState } from "react";
import type { Idea } from "@/lib/types";
import { normalizeStringArray } from "@/lib/types";
import { VideoCoverButton } from "./video-player";
import { DeimosIcon } from "./deimos-icon";

/**
 * Idea 媒体画廊:宣传视频(若有)+ 截图列表。
 * 视频项放最前,点击进入全屏播放;图片项点击可放大查看。
 * 对标 Product Hunt 的产品截图画廊。
 */
export function IdeaMediaGallery({ idea }: { idea: Idea }) {
  const hasVideo = Boolean(idea.video_url);
  const images = normalizeStringArray(idea.image_urls);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (!hasVideo && images.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="meta-label">媒体</h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          <div className="flex h-[140px] w-full items-center justify-center rounded-xl border border-dashed border-[var(--rule)] bg-[var(--bg-subtle)] text-center">
            <div className="px-4">
              <span className="mb-1.5 block text-[var(--ink-faint)]" aria-hidden>
                <DeimosIcon name="sparkles" className="mx-auto h-5 w-5" />
              </span>
              <p className="text-[12px] text-[var(--ink-faint)]">
                暂无封面图、视频或截图
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="meta-label">媒体</h3>
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
            aria-label={`图片 ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`截图 ${i + 1}`}
              className="h-full w-full object-cover transition-transform hover:scale-[1.02]"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {lightboxSrc ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            aria-label="关闭"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="放大查看"
            className="max-h-[85vh] max-w-[90vw] rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </section>
  );
}
