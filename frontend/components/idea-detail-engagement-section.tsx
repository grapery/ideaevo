"use client";

import { IdeaDetailEngagement } from "./idea-detail-engagement";
import type { Idea } from "@/lib/types";

/** 底部互动栏。Fork 衍生列表统一由正文常驻的 ForkDerivativesPanel 承载
 *  (此前这里还有一个可展开的 ForkChildrenStrip, 与正文列表功能重复)。 */
export function IdeaDetailEngagementSection({
  ideaId,
  likes,
  wishes,
  flowers,
  forks,
  comments,
  status,
}: {
  ideaId: string;
  likes: number;
  wishes?: number;
  flowers?: number;
  forks: number;
  comments: number;
  status?: Idea["status"];
}) {
  return (
    <div className="pt-2 border-t border-[var(--divider)]">
      <IdeaDetailEngagement
        ideaId={ideaId}
        likes={likes}
        wishes={wishes}
        flowers={flowers}
        forks={forks}
        comments={comments}
        status={status}
      />
    </div>
  );
}
