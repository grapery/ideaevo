"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { userApi } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { DeimosIcon } from "@/components/deimos-icon";
import { SystemPageHeader } from "@/components/system-page-header";
import { EmptyState } from "@/components/empty-state";
import type { ImplementationJobView } from "@/lib/types";

type JobStatus = ImplementationJobView["status"];
type Filter = "all" | "pending" | "in_progress" | "done" | "failed";

const statusTone: Record<JobStatus, string> = {
  pending: "border-[var(--rule)] bg-[var(--bg-subtle)] text-[var(--ink-soft)]",
  in_progress: "border-[var(--accent-link)]/30 bg-[var(--accent-link-soft)] text-[var(--accent-link)]",
  done: "border-[var(--accent-success)]/30 bg-[var(--accent-success-soft)] text-[var(--accent-success)]",
  failed: "border-[var(--accent-warning)]/30 bg-[var(--accent-warning-soft)] text-[var(--accent-warning)]",
};

const statusLabelKey: Record<JobStatus, "jobs.pending" | "jobs.inProgress" | "jobs.done" | "jobs.failed"> = {
  pending: "jobs.pending",
  in_progress: "jobs.inProgress",
  done: "jobs.done",
  failed: "jobs.failed",
};

export default function ImplementationJobsPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<ImplementationJobView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?returnUrl=/user/jobs");
      return;
    }
    let cancelled = false;
    setLoading(true);
    userApi
      .listImplementationJobs()
      .then((data) => {
        if (!cancelled) setJobs(data.jobs || []);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  const updateJob = useCallback(
    async (job: ImplementationJobView, status: "in_progress" | "done" | "failed") => {
      let note = "";
      if (status === "done") {
        const input = window.prompt(t("jobs.notePrompt"));
        if (input === null) return; // 取消
        note = input.trim();
      }
      setBusyId(job.id);
      try {
        await userApi.updateImplementationJob(job.id, {
          status,
          ...(note ? { note } : {}),
        });
        if (status === "done") notify.success(t("idea.suggestionJobDone"));
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, status, ...(note ? { note } : {}) } : j)),
        );
      } catch (err) {
        notify.error(getErrorMessage(err, t("jobs.updateFailed")));
      } finally {
        setBusyId(null);
      }
    },
    [t],
  );

  if (!authLoading && !user) return null;

  const openCount = jobs.filter((j) => j.status === "pending" || j.status === "in_progress").length;
  const filtered = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: t("jobs.all"), count: jobs.length },
    { value: "pending", label: t("jobs.pending"), count: jobs.filter((j) => j.status === "pending").length },
    { value: "in_progress", label: t("jobs.inProgress"), count: jobs.filter((j) => j.status === "in_progress").length },
    { value: "done", label: t("jobs.done"), count: jobs.filter((j) => j.status === "done").length },
    { value: "failed", label: t("jobs.failed"), count: jobs.filter((j) => j.status === "failed").length },
  ];

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <SystemPageHeader
          eyebrow={t("jobs.eyebrow")}
          title={t("jobs.title")}
          description={t("jobs.desc")}
          icon="lifecycle"
          actions={
            <span className="meta-label rounded-full border border-[var(--rule)] px-3 py-1.5">
              {t("jobs.countBadge", { count: openCount })}
            </span>
          }
        />

        {/* 状态筛选 */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                filter === f.value
                  ? "border-[var(--accent-link)]/30 bg-[var(--accent-link-soft)] text-[var(--accent-link)]"
                  : "border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]"
              }`}
            >
              {f.label}
              <span className="ml-1.5 font-mono tabular-nums text-[11px] text-[var(--ink-faint)]">{f.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
          </div>
        ) : loadError ? (
          <div className="mt-4">
            <EmptyState title={t("jobs.loadFailed")} variant="dashed" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="lifecycle"
              title={t("jobs.empty")}
              hint={t("jobs.emptyHint")}
              variant="dashed"
              action={
                <Link href={`/users/${user?.id}`} className="btn-primary btn-sm">
                  {t("jobs.goIdeas")}
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filtered.map((job) => (
              <article key={job.id} className="surface-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone[job.status]}`}>
                        {t(statusLabelKey[job.status])}
                      </span>
                      <Link
                        href={`/ideas/${job.idea_id}`}
                        className="truncate text-[15px] font-semibold text-[var(--ink)] hover:text-[var(--accent-link)]"
                      >
                        {job.idea_title}
                      </Link>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                      <DeimosIcon name="decision" className="h-3 w-3" />
                      {t("jobs.fromSuggestion")}
                    </p>
                    <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[var(--ink-soft)]">
                      {job.suggestion_content}
                    </p>
                    {job.note && (
                      <p className="mt-2 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] px-3 py-2 text-[12px] text-[var(--ink-soft)]">
                        {job.note}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {job.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => void updateJob(job, "in_progress")}
                        disabled={busyId === job.id}
                        className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <DeimosIcon name="play" className="h-3.5 w-3.5" />
                        {t("jobs.start")}
                      </button>
                    )}
                    {(job.status === "pending" || job.status === "in_progress") && (
                      <>
                        <button
                          type="button"
                          onClick={() => void updateJob(job, "done")}
                          disabled={busyId === job.id}
                          className="btn-outline btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <DeimosIcon name="check" className="h-3.5 w-3.5" />
                          {t("jobs.markDone")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateJob(job, "failed")}
                          disabled={busyId === job.id}
                          className="px-2 py-1 text-[12px] text-[var(--ink-faint)] hover:text-[var(--coral)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t("jobs.markFailed")}
                        </button>
                      </>
                    )}
                    <Link
                      href={`/ideas/${job.idea_id}?tab=suggestions`}
                      className="px-2 py-1 text-[12px] text-[var(--ink-faint)] hover:text-[var(--accent-link)]"
                    >
                      {t("jobs.openIdea")}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
            {filtered.length === 0 && (
              <EmptyState title={t("jobs.empty")} variant="dashed" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
