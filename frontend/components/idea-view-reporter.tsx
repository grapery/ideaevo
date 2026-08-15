"use client";

import { useEffect } from "react";
import { api } from "@/lib/api-client";

/**
 * 页面挂载时向后端上报一次浏览计数（fire-and-forget，匿名可调）。
 * 渲染为空，仅作为副作用载体。
 */
export function IdeaViewReporter({ ideaId }: { ideaId: string }) {
  useEffect(() => {
    api.recordIdeaView(ideaId).catch(() => {});
  }, [ideaId]);
  return null;
}
