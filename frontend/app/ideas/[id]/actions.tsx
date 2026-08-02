"use client";

import { useState } from "react";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { ideaRequestJson } from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

export function IdeaActions({ ideaId }: { ideaId: string }) {
  const { t } = useI18n();
  const { apiKey, canAct, useSession, isReady } = useIdeaActionAuth();
  const [loading, setLoading] = useState<string | null>(null);

  async function doAction(action: string, method: string) {
    if (!canAct) {
      notify.error(t("idea.authRequired"));
      return;
    }
    setLoading(action);
    try {
      await ideaRequestJson(`/ideas/${ideaId}/${action}`, {
        method,
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      notify.success(
        action === "like"
          ? t("idea.statLikes")
          : action === "flowers"
            ? t("idea.statWishes")
            : t("common.operationFailed")
      );
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-3 mt-4">
      <button
        onClick={() => doAction("like", "POST")}
        disabled={!!loading}
        className="btn-default btn-sm disabled:opacity-50"
      >
        {loading === "like" ? "…" : (
          <><DeimosIcon name="heart" className="h-3.5 w-3.5" />{t("idea.statLikes")}</>
        )}
      </button>
      <button
        onClick={() => doAction("flowers", "POST")}
        disabled={!!loading}
        className="btn-default btn-sm disabled:opacity-50"
      >
        {loading === "flowers" ? "…" : (
          <><DeimosIcon name="wish" className="h-3.5 w-3.5" />{t("idea.statWishes")}</>
        )}
      </button>
      <button
        onClick={() => {
          const title = prompt(t("fork.promptTitle"));
          if (!title) return;
          const desc = prompt(t("fork.promptDesc")) || "";
          const reason = prompt(t("fork.promptReason")) || "";
          doFork(title, desc, reason);
        }}
        disabled={!!loading}
        className="btn-default btn-sm disabled:opacity-50"
      >
        <DeimosIcon name="fork" className="h-3.5 w-3.5" />{t("idea.statForks")}
      </button>
      {!isReady && !canAct && (
        <span className="text-xs text-[var(--text-muted)]">
          {t("notif.loginRequired")}
        </span>
      )}
    </div>
  );

  async function doFork(title: string, desc: string, reason: string) {
    if (!canAct) {
      notify.error(t("idea.authRequired"));
      return;
    }
    setLoading("fork");
    try {
      const data = await ideaRequestJson<{ id: string }>(
        `/ideas/${ideaId}/fork`,
        {
          method: "POST",
          apiKey: useSession ? undefined : apiKey,
          useSession,
          body: JSON.stringify({ title, description: desc, reason }),
        }
      );
      notify.success(t("fork.successWithId", { id: data.id }));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(null);
    }
  }
}
