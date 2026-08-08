"use client";

import type { Idea } from "@/lib/types";
import { VideoCoverButton } from "./video-player";

/**
 * Idea 详情页封面 hero(对标 Product Hunt 的首屏产品大图)。
 * - 有 cover_url:显示大图 + 底部渐变(让后续文字可读)
 * - 有 video_url:在封面右上叠加播放入口;无封面时单独显示视频封面
 * - 都没有:不渲染(由调用方控制)
 */
export function IdeaCoverHero({ idea }: { idea: Idea }) {
  const cover = idea.cover_url;
  const video = idea.video_url;

  // 有封面图:大图 hero + 视频入口叠加
  if (cover) {
    return (
      <div className="relative mb-4 h-[220px] w-full overflow-hidden rounded-2xl bg-[var(--fill,#f2f3f7)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt={idea.title}
          className="h-full w-full object-cover"
          // 详情页首屏 LCP 图,提示浏览器优先加载
          fetchPriority="high"
        />
        {/* 底部渐变,让标题/status 文字在任意背景可读 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
        {/* 视频入口:右上角 */}
        {video ? (
          <div className="absolute right-3 top-3">
            <VideoCoverButton
              url={video}
              poster={cover}
              className="h-12 w-20 border border-white/40"
            />
          </div>
        ) : null}
      </div>
    );
  }

  // 无封面但有视频:单独显示视频封面
  if (video) {
    return (
      <div className="mb-4">
        <VideoCoverButton url={video} className="h-[220px] w-full" />
      </div>
    );
  }

  return null;
}
