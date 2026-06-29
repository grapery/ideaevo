"use client";

import { useState } from "react";
import { ForkChildrenStrip } from "./fork-children-strip";
import { IdeaDetailEngagement } from "./idea-detail-engagement";

export function IdeaDetailEngagementSection({
  ideaId,
  likes,
  flowers,
  forks,
  comments,
}: {
  ideaId: string;
  likes: number;
  flowers: number;
  forks: number;
  comments: number;
}) {
  const [forkListOpen, setForkListOpen] = useState(false);

  return (
    <>
      <ForkChildrenStrip ideaId={ideaId} open={forkListOpen} />
      <div className="pt-2 border-t border-[var(--divider)]">
        <IdeaDetailEngagement
          ideaId={ideaId}
          likes={likes}
          flowers={flowers}
          forks={forks}
          comments={comments}
          forkListOpen={forkListOpen}
          onForkListToggle={() => setForkListOpen((v) => !v)}
        />
      </div>
    </>
  );
}
