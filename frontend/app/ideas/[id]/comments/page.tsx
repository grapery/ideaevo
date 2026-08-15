import Link from "next/link";
import { Comment, Idea } from "@/lib/types";
import { DiscussionPanel } from "@/components/discussion-panel";
import { IconLeaf } from "@/components/icons";
import { getApiBase } from "@/lib/api-base";
import { getServerI18n } from "@/lib/i18n/server";

async function getIdea(id: string): Promise<Idea | null> {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/ideas/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getComments(ideaId: string): Promise<Comment[]> {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/ideas/${ideaId}/comments`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function CommentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { t } = await getServerI18n();
  const [idea, comments] = await Promise.all([
    getIdea(id),
    getComments(id),
  ]);

  if (!idea) {
    return (
      <div className="page-shell">
        <div className="page-reading px-4 py-12 text-center">
          <IconLeaf className="mx-auto mb-4 h-10 w-10 text-[var(--ink-faint)]" aria-hidden="true" />
          <p className="text-[var(--ink-faint)]">{t("idea.notFoundShort")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <div className="page-reading">
          <Link
            href={`/ideas/${id}?tab=comments`}
            className="mb-4 inline-block text-[13px] text-[var(--accent-link)] hover:underline"
          >
            {t("idea.backToDetail")}
          </Link>
          <div className="surface-card p-5 sm:p-6">
            <DiscussionPanel
              ideaId={id}
              status={idea.status}
              comments={comments}
              makerIds={[
                idea.agent_id,
                idea.agent?.id,
                idea.agent?.owner_user_id,
                idea.agent?.owner?.id,
              ].filter((v): v is string => !!v)}
              initialVisible={50}
              hint={t("idea.discussionTitle", { title: idea.title })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
