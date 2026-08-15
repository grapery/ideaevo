"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DeimosIcon } from "@/components/deimos-icon";
import { EmptyState } from "@/components/empty-state";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { api } from "@/lib/api-client";
import { ideaRequestJson } from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useI18n } from "@/lib/i18n/provider";
import type { Idea, IdeaSuggestionView } from "@/lib/types";

const MAX_IMAGES = 4;

/** 上传一张建议图片：presign → PUT → public URL（与描述插图同一存储约定）。 */
async function uploadSuggestionImage(ideaId: string, file: File): Promise<string> {
  const presign = await api.presignSuggestionImage(ideaId, file.type);
  const res = await fetch(presign.upload_url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) throw new Error("upload failed");
  return presign.public_url;
}

/**
 * SuggestionComposer —— 建议提交表单：文字（必填）+ 图片（可选，最多 4 张）。
 * 认证门与只读提示沿用 comment-form 的模式。
 */
function SuggestionComposer({
  ideaId,
  status,
  onCreated,
}: {
  ideaId: string;
  status?: Idea["status"];
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (status === "buried") {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--rule)] px-4 py-5 text-sm text-[var(--ink-faint)]">
        {t("idea.readonlyHint")}
      </div>
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      notify.error(t("idea.suggestionImageLimit"));
      return;
    }
    if (!user) {
      openAuthModal();
      return;
    }
    setUploading(true);
    try {
      const picked = Array.from(files).slice(0, remaining);
      for (const file of picked) {
        // 逐张累积：中途失败不丢弃已上传成功的图片
        const url = await uploadSuggestionImage(ideaId, file);
        setImages((prev) => [...prev, url].slice(0, MAX_IMAGES));
      }
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.suggestionUploadFailed")));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    if (!canAct) {
      if (!user) openAuthModal();
      else notify.error(t("idea.authRequired"));
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await ideaRequestJson(`/ideas/${ideaId}/suggestions`, {
        method: "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
        body: JSON.stringify({ content: content.trim(), image_urls: images }),
      });
      notify.success(t("idea.suggestionCreated"));
      setContent("");
      setImages([]);
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err, t("idea.suggestionCreateFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-start gap-3">
        <WireframeAvatar
          name={user?.name || t("common.anonymous")}
          avatarUrl={user?.avatar_url}
          entityId={user?.id}
          kind="user"
          size={36}
        />
        <div className="min-w-0 flex-1">
          <div className="rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-surface)] transition-colors focus-within:border-[var(--ink)]">
            <textarea
              name="suggestion"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setError("");
              }}
              placeholder={t("idea.suggestionPlaceholder")}
              rows={3}
              className="w-full resize-y rounded-[var(--radius-card)] bg-transparent px-3.5 py-2.5 text-[14px] leading-6 text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
            />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-[var(--rule-light)] px-3 py-2">
                {images.map((url) => (
                  <div key={url} className="relative h-16 w-16 overflow-hidden rounded-[var(--radius-btn)] border border-[var(--rule)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                      className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label={t("common.delete")}
                    >
                      <DeimosIcon name="close" className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--rule-light)] px-3 py-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || images.length >= MAX_IMAGES}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <DeimosIcon name="plus" className="h-3.5 w-3.5" />
                {uploading ? t("idea.suggestionUploading") : t("idea.suggestionAddImage")}
              </button>
              {images.length >= MAX_IMAGES && (
                <span className="text-[11px] text-[var(--ink-faint)]">
                  {t("idea.suggestionImageLimit")}
                </span>
              )}
              <button
                type="submit"
                disabled={submitting || uploading || !content.trim()}
                className="ml-auto rounded-full bg-[var(--primary)] px-4 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? t("idea.suggestionSubmitting") : t("idea.suggestionSubmit")}
              </button>
            </div>
          </div>
          {error && <p className="mt-1.5 text-xs text-[var(--coral)]">{error}</p>}
        </div>
      </div>
    </form>
  );
}

/** SuggestionCard —— 单条建议：作者 / 内容 / 图片 / 投票 / 采纳状态与操作。 */
function SuggestionCard({
  suggestion,
  isOwner,
  busy,
  voting,
  viewerId,
  onVote,
  onSelect,
  onDelete,
  onPreview,
}: {
  suggestion: IdeaSuggestionView;
  isOwner: boolean;
  busy: boolean;
  voting: boolean;
  viewerId?: string;
  onVote: (s: IdeaSuggestionView) => void;
  onSelect: (s: IdeaSuggestionView) => void;
  onDelete: (s: IdeaSuggestionView) => void;
  onPreview: (url: string) => void;
}) {
  const { t, locale } = useI18n();
  const canDelete = !!viewerId && viewerId === suggestion.user_id;
  const authorName =
    suggestion.author_name || suggestion.user_id.slice(0, 8) || t("activity.user");

  return (
    <article
      className={`surface-card p-4 sm:p-5 ${
        suggestion.selected ? "border-[var(--accent-success)]/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <WireframeAvatar
            name={authorName}
            avatarUrl={suggestion.author_avatar}
            entityId={suggestion.user_id}
            kind={suggestion.author_type === "agent" ? "agent" : "user"}
            size={28}
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-[var(--ink)]">
              {authorName}
              {suggestion.author_type === "agent" && (
                <span className="ml-1.5 rounded-full bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                  AI
                </span>
              )}
            </p>
            <p className="text-[11px] text-[var(--ink-faint)]">
              {new Date(suggestion.created_at).toLocaleDateString(
                locale === "en" ? "en-US" : "zh-CN",
              )}
            </p>
          </div>
        </div>
        {suggestion.selected && (
          <span className="badge-pill badge-active">
            <DeimosIcon name="check" className="mr-1 inline h-3 w-3" />
            {t("idea.suggestionSelected")}
          </span>
        )}
        {suggestion.selected && suggestion.job_status && (
          <span className={`badge-pill ${
            suggestion.job_status === "done"
              ? "badge-implemented"
              : suggestion.job_status === "failed"
                ? "badge-buried"
                : "badge-outline"
          } ml-1.5`}>
            {t(
              suggestion.job_status === "done"
                ? "idea.suggestionJobDone"
                : suggestion.job_status === "failed"
                  ? "idea.suggestionJobFailed"
                  : suggestion.job_status === "in_progress"
                    ? "idea.suggestionJobInProgress"
                    : "idea.suggestionJobPending",
            )}
          </span>
        )}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-[var(--ink-soft)]">
        {suggestion.content}
      </p>

      {suggestion.image_urls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.image_urls.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => onPreview(url)}
              className="h-20 w-20 overflow-hidden rounded-[var(--radius-btn)] border border-[var(--rule)] transition-opacity hover:opacity-85"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--rule)] pt-3">
        <button
          type="button"
          onClick={() => onVote(suggestion)}
          disabled={suggestion.selected || voting}
          aria-pressed={suggestion.voted}
          title={suggestion.selected ? undefined : suggestion.voted ? t("idea.suggestionVoted") : t("idea.suggestionVote")}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium tabular-nums transition-all active:scale-[0.96] ${
            suggestion.voted
              ? "border-[var(--accent-link)]/30 bg-[var(--accent-link-soft)] text-[var(--accent-link)]"
              : "border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <DeimosIcon name="wish" className="h-3.5 w-3.5" />
          {suggestion.vote_count}
        </button>

        {isOwner && !suggestion.selected && (
          <button
            type="button"
            onClick={() => onSelect(suggestion)}
            disabled={busy}
            className="btn-primary btn-sm ml-auto disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DeimosIcon name="check" className="h-3.5 w-3.5" />
            {t("idea.suggestionSelect")}
          </button>
        )}
        {suggestion.selected && (
          <span className="ml-auto text-[11px] text-[var(--ink-faint)]">
            {suggestion.selected_at
              ? t("idea.suggestionSelectedAt", {
                  date: new Date(suggestion.selected_at).toLocaleString(
                    locale === "en" ? "en-US" : "zh-CN",
                  ),
                })
              : t("idea.suggestionSelectedHint")}
          </span>
        )}
        {canDelete && !suggestion.selected && (
          <button
            type="button"
            onClick={() => onDelete(suggestion)}
            disabled={busy}
            className="px-2 py-1 text-[12px] text-[var(--ink-faint)] hover:text-[var(--coral)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("idea.suggestionDelete")}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * SuggestionPanel —— 建议池 Tab 主面板。
 * 服务端预取 initialSuggestions；写操作后客户端重取列表，保持 voted/selected 状态准确。
 */
export function SuggestionPanel({
  ideaId,
  status,
  initialSuggestions = [],
  ownerUserId,
}: {
  ideaId: string;
  status?: Idea["status"];
  initialSuggestions?: IdeaSuggestionView[];
  ownerUserId?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { openAuthModal } = useAuthModal();
  const [items, setItems] = useState<IdeaSuggestionView[]>(initialSuggestions);
  const [syncedInitial, setSyncedInitial] = useState(initialSuggestions);
  const [busy, setBusy] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isOwner = !!user && !!ownerUserId && user.id === ownerUserId;

  // 服务端数据变化时同步本地列表（如 router.refresh 后）。
  // 渲染期调整 state 的官方模式，避免 effect 内同步 setState。
  if (initialSuggestions !== syncedInitial) {
    setSyncedInitial(initialSuggestions);
    setItems(initialSuggestions);
  }

  async function refreshList() {
    try {
      const data = await ideaRequestJson<{ suggestions: IdeaSuggestionView[] }>(
        `/ideas/${ideaId}/suggestions`,
        // 与其他写操作同一认证口径：会话用户带 cookie，Agent Key 带 X-API-Key
        { apiKey: useSession ? undefined : apiKey, useSession },
      );
      setItems(data.suggestions || []);
    } catch {
      // 列表刷新失败不阻断操作反馈
    }
    router.refresh();
  }

  function requireActor(): boolean {
    if (canAct) return true;
    if (!user) openAuthModal();
    else notify.error(t("idea.authRequired"));
    return false;
  }

  async function handleVote(s: IdeaSuggestionView) {
    if (!requireActor()) return;
    // 双击防护：同一建议的投票请求进行中忽略后续点击
    if (votingId === s.id) return;
    setVotingId(s.id);
    try {
      if (s.voted) {
        // 乐观回滚式取消
        setItems((prev) =>
          prev.map((it) =>
            it.id === s.id
              ? { ...it, voted: false, vote_count: Math.max(0, it.vote_count - 1) }
              : it,
          ),
        );
        try {
          await ideaRequestJson(`/ideas/${ideaId}/suggestions/${s.id}/vote`, {
            method: "DELETE",
            apiKey: useSession ? undefined : apiKey,
            useSession,
          });
        } catch {
          setItems((prev) => prev.map((it) => (it.id === s.id ? s : it)));
          notify.error(t("idea.suggestionVoteFailed"));
        }
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === s.id ? { ...it, voted: true, vote_count: it.vote_count + 1 } : it,
        ),
      );
      try {
        await ideaRequestJson(`/ideas/${ideaId}/suggestions/${s.id}/vote`, {
          method: "POST",
          apiKey: useSession ? undefined : apiKey,
          useSession,
        });
      } catch {
        setItems((prev) => prev.map((it) => (it.id === s.id ? s : it)));
        notify.error(t("idea.suggestionVoteFailed"));
      }
    } finally {
      setVotingId(null);
    }
  }

  async function handleSelect(s: IdeaSuggestionView) {
    // 采纳不可逆（创建实现任务 + 推进 idea 状态），先确认
    if (!window.confirm(t("idea.suggestionSelectConfirm"))) return;
    setBusy(true);
    try {
      await ideaRequestJson(`/ideas/${ideaId}/suggestions/${s.id}/select`, {
        method: "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      notify.success(t("idea.suggestionSelected"));
      await refreshList();
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.suggestionSelectFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(s: IdeaSuggestionView) {
    // 删除不可逆且可能带着他人投票，先确认
    if (!window.confirm(t("idea.suggestionDeleteConfirm"))) return;
    setBusy(true);
    try {
      await ideaRequestJson(`/ideas/${ideaId}/suggestions/${s.id}`, {
        method: "DELETE",
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      setItems((prev) => prev.filter((it) => it.id !== s.id));
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.suggestionDeleteFailed")));
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = items.filter((s) => s.selected).length;
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // 灯箱打开时：聚焦关闭按钮 + 锁定背景滚动；关闭时恢复
  useEffect(() => {
    if (!previewUrl) return;
    closeBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [previewUrl]);

  return (
    <section id="suggestions" className="scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-[var(--ink)]">
            <DeimosIcon name="decision" className="h-4 w-4 text-[var(--accent-link)]" />
            {t("idea.suggestions")}
            {items.length > 0 && (
              <span className="ml-2 font-code text-[14px] font-normal tabular-nums text-[var(--ink-faint)]">
                {items.length}
                {selectedCount > 0 && ` · ${selectedCount} ✓`}
              </span>
            )}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            {t("idea.suggestionsHint")}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <SuggestionComposer
          ideaId={ideaId}
          status={status}
          onCreated={() => void refreshList()}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title={t("idea.suggestionEmpty")}
          hint={t("idea.suggestionEmptyHint")}
          variant="dashed"
        />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              isOwner={isOwner}
              busy={busy}
              voting={votingId === s.id}
              viewerId={user?.id}
              onVote={(item) => void handleVote(item)}
              onSelect={(item) => void handleSelect(item)}
              onDelete={(item) => void handleDelete(item)}
              onPreview={setPreviewUrl}
            />
          ))}
        </div>
      )}

      {previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("idea.suggestionPreview")}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => setPreviewUrl(null)}
            aria-label={t("common.cancel")}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
          >
            <DeimosIcon name="close" className="h-4 w-4" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={t("idea.suggestionPreview")}
            className="max-h-[85vh] max-w-full rounded-[var(--radius-card)] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
