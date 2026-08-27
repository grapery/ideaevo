"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";
import { normalizeLinks, type Idea, type IdeaImplStatus, type IdeaLink } from "@/lib/types";

const IMPL_OPTIONS: IdeaImplStatus[] = [
  "concept",
  "in_progress",
  "implemented",
  "paused",
];

export function ChatIdeaWritebackModal({
  open,
  ideaId,
  onClose,
  onSaved,
}: {
  open: boolean;
  ideaId: string;
  onClose: () => void;
  onSaved?: (idea: Idea) => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [implStatus, setImplStatus] = useState<IdeaImplStatus>("in_progress");
  const [repoURL, setRepoURL] = useState("");
  const [demoURL, setDemoURL] = useState("");
  const [evidenceURL, setEvidenceURL] = useState("");
  const [evidenceTitle, setEvidenceTitle] = useState("");

  useEffect(() => {
    if (!open || !ideaId) return;
    let cancelled = false;
    setFetching(true);
    api
      .getIdea(ideaId)
      .then((idea) => {
        if (cancelled) return;
        setImplStatus((idea.impl_status as IdeaImplStatus) || "in_progress");
        setRepoURL(idea.repo_url || "");
        setDemoURL(idea.demo_url || "");
        setEvidenceURL("");
        setEvidenceTitle("");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, ideaId]);

  async function submit() {
    setLoading(true);
    try {
      const current = await api.getIdea(ideaId);
      const links: IdeaLink[] = [...normalizeLinks(current.links)];
      const trimmedEvidence = evidenceURL.trim();
      if (trimmedEvidence) {
        links.push({
          kind: "reference",
          title: evidenceTitle.trim() || t("chat.evidenceLink"),
          url: trimmedEvidence,
        });
      }
      const updated = await api.updateIdeaMeta(ideaId, {
        impl_status: implStatus,
        repo_url: repoURL.trim(),
        demo_url: demoURL.trim(),
        links,
      });
      // 新增了证据链接 = 一次引用，落 reference_count 埋点（失败不打扰用户）
      if (trimmedEvidence) {
        api.recordIdeaReference(ideaId).catch(() => {});
      }
      notify.success(t("chat.writebackSaved"));
      onSaved?.(updated);
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={t("chat.writebackTitle")}
      description={t("chat.writebackDesc")}
      footer={
        <>
          <button
            type="button"
            className="btn-default px-4 py-2 text-sm"
            disabled={loading}
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            disabled={loading || fetching}
            onClick={() => void submit()}
          >
            {loading ? t("common.saving") : t("chat.writebackConfirm")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="meta-label mb-1 block">{t("idea.implStatus")}</span>
          <select
            value={implStatus}
            onChange={(e) => setImplStatus(e.target.value as IdeaImplStatus)}
            className="w-full rounded border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--ink)]"
          >
            {IMPL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "concept"
                  ? t("idea.concept")
                  : opt === "in_progress"
                    ? t("idea.inProgress")
                    : opt === "implemented"
                      ? t("idea.implemented")
                      : t("idea.paused")}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="meta-label mb-1 block">{t("idea.repoUrl")}</span>
          <Input
            value={repoURL}
            onChange={(e) => setRepoURL(e.target.value)}
            placeholder="https://github.com/..."
          />
        </label>
        <label className="block">
          <span className="meta-label mb-1 block">{t("idea.demoUrl")}</span>
          <Input
            value={demoURL}
            onChange={(e) => setDemoURL(e.target.value)}
            placeholder="https://..."
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block sm:col-span-1">
            <span className="meta-label mb-1 block">{t("chat.evidenceLink")}</span>
            <Input
              value={evidenceURL}
              onChange={(e) => setEvidenceURL(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="block sm:col-span-1">
            <span className="meta-label mb-1 block">{t("chat.evidenceTitle")}</span>
            <Input
              value={evidenceTitle}
              onChange={(e) => setEvidenceTitle(e.target.value)}
              placeholder={t("chat.evidenceTitlePlaceholder")}
            />
          </label>
        </div>
      </div>
    </Modal>
  );
}

export function ChatRelatedIdeas({
  query,
  excludeIdeaId,
}: {
  query: string;
  excludeIdeaId?: string;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<{ idea: Idea; similarity: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      api
        .searchIdeas(trimmed, 1)
        .then((res) => {
          if (cancelled) return;
          const next = (res.results || [])
            .filter((row) => row.idea?.id && row.idea.id !== excludeIdeaId)
            .slice(0, 4);
          setItems(next);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed, excludeIdeaId]);

  const emptyHint = useMemo(() => {
    if (trimmed.length < 2) return t("chat.relatedIdeasHint");
    if (loading) return t("common.loading");
    if (items.length === 0) return t("chat.relatedIdeasEmpty");
    return null;
  }, [trimmed, loading, items.length, t]);

  return (
    <section>
      <div className="rounded-[6px] border border-[var(--rule)] bg-[var(--bg-canvas)] p-4">
        <p className="font-code text-[12px] text-[var(--title)]">
          {t("chat.relatedBranches")}
        </p>
        <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
          {t("chat.relatedBranchesHint")}
        </p>
        {emptyHint ? (
          <p className="mt-3 text-[12px] text-[var(--text-muted)]">{emptyHint}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map(({ idea, similarity }) => (
              <li key={idea.id}>
                <Link
                  href={`/ideas/${idea.id}`}
                  className="block rounded border border-[var(--rule-light)] bg-[var(--bg-surface)] px-3 py-2 hover:border-[var(--accent-link)]"
                >
                  <p className="truncate text-[13px] font-medium text-[var(--title)]">
                    {idea.title}
                  </p>
                  <p className="mt-0.5 font-code text-[11px] text-[var(--text-muted)]">
                    {t("chat.similarity", {
                      score: Math.round(similarity * 100),
                    })}
                    {idea.status ? ` · ${idea.status}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
