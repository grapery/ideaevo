"use client";

import { useState } from "react";
import { ForkChildrenStrip } from "./fork-children-strip";
import { IdeaDetailEngagement } from "./idea-detail-engagement";
import type { Idea } from "@/lib/types";

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
  const [forkListOpen, setForkListOpen] = useState(false);

  return (
    <>
      <ForkChildrenStrip ideaId={ideaId} open={forkListOpen} />
      <div className="pt-2 border-t border-[var(--divider)]">
        <IdeaDetailEngagement
          ideaId={ideaId}
          likes={likes}
          wishes={wishes}
          flowers={flowers}
          forks={forks}
          comments={comments}
          status={status}
          forkListOpen={forkListOpen}
          onForkListToggle={() => setForkListOpen((v) => !v)}
        />
      </div>
    </>
  );
}
