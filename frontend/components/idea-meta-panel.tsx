"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Idea,
  IDEA_IMPL_STATUS_LABELS,
  normalizeLinks,
  safeUrl,
  type IdeaImplStatus,
} from "@/lib/types";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { ImplStatusBadge } from "@/components/impl-status-badge";
import { IdeaStatusActions } from "@/components/idea-status-actions";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

function formatRepoLabel(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\//, "").replace(/\.git$/, "");
    if (u.hostname === "github.com" && path) return path;
    return u.hostname + (path ? `/${path}` : "");
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}

export function IdeaMetaPanel({ idea }: { idea: Idea }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // 实现状态码 → i18n 标签（与 IDEA_IMPL_STATUS_LABELS 的 key 对应）
  const implStatusLabels: Record<string, string> = {
    concept: t("idea.concept"),
    in_progress: t("idea.inProgress"),
    implemented: t("idea.implemented"),
    paused: t("idea.paused"),
  };

  // links 后端可能返回 JSON 字符串或非数组值,这里归一化避免 .map 崩溃
  const links = useMemo(() => normalizeLinks(idea.links), [idea.links]);

  const canEdit = useMemo(() => {
    if (!user) return false;
    return idea.agent?.owner_user_id === user.id;
  }, [user, idea.agent?.owner_user_id]);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [implStatus, setImplStatus] = useState<IdeaImplStatus>(idea.impl_status || "");
  const [repoUrl, setRepoUrl] = useState(idea.repo_url || "");
  const [demoUrl, setDemoUrl] = useState(idea.demo_url || "");
  const [iconUrl, setIconUrl] = useState(idea.icon_url || "");

  const repo = safeUrl(idea.repo_url);
  const demo = safeUrl(idea.demo_url);

  const hasDisplay =
    !!idea.impl_status || !!repo || !!demo;

  // 即使无实现信息也渲染区块(显示占位 chip),保持页面结构完整。
  // 仅在访客模式 + 完全无数据时保持轻量占位。

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateIdeaMeta(idea.id, {
        impl_status: implStatus,
        repo_url: repoUrl.trim(),
        demo_url: demoUrl.trim(),
        icon_url: iconUrl.trim(),
      });
      notify.success(t("idea.metaSaved"));
      setEditing(false);
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleIconReset() {
    setUploading(true);
    try {
      const updated = await api.resetIdeaIcon(idea.id);
      setIconUrl(updated.icon_url || "");
      notify.success(t("idea.iconReset"));
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleIconUpload(file: File) {
    setUploading(true);
    try {
      const presign = await api.presignIdeaIcon(idea.id, file.type);
      const putRes = await fetch(presign.upload_url, { method: "PUT", body: file });
      if (!putRes.ok) throw new Error(t("idea.iconUploadFailed"));
      const url = presign.public_url;
      setIconUrl(url);
      await api.updateIdeaMeta(idea.id, { icon_url: url });
      notify.success(t("idea.iconSaved"));
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-6 border-t border-[var(--divider)] pt-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
          <DeimosIcon name="gear" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
          {t("idea.metaInfo")}
        </h3>
        {canEdit && (
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => {
              if (editing) {
                setImplStatus(idea.impl_status || "");
                setRepoUrl(idea.repo_url || "");
                setDemoUrl(idea.demo_url || "");
                setIconUrl(idea.icon_url || "");
              }
              setEditing((v) => !v);
            }}
          >
            {editing
              ? t("common.cancel")
              : hasDisplay
                ? t("common.edit")
                : "Add"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <label className="block">
            <span className="meta-label mb-1 block">{t("idea.implStatus")}</span>
            <select
              className="w-full border border-[var(--rule)] bg-[var(--bg-surface)] px-2 py-1.5 text-[13px]"
              value={implStatus}
              onChange={(e) => setImplStatus(e.target.value as IdeaImplStatus)}
            >
              <option value="">{t("common.notSet")}</option>
              {Object.entries(IDEA_IMPL_STATUS_LABELS).map(([k]) => (
                <option key={k} value={k}>
                  {implStatusLabels[k as keyof typeof IDEA_IMPL_STATUS_LABELS]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="meta-label mb-1 block">{t("idea.repoUrl")}</span>
            <input
              type="url"
              className="input-field w-full"
              placeholder="https://github.com/..."
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="meta-label mb-1 block">{t("idea.demoUrl")}</span>
            <input
              type="url"
              className="input-field w-full"
              placeholder="https://..."
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
            />
          </label>

          <div>
            <span className="meta-label mb-1 block">{t("idea.iconLabel")}</span>
            <div className="flex flex-wrap items-center gap-3">
              <WireframeAvatar
                name={idea.title}
                avatarUrl={iconUrl || idea.icon_url}
                entityId={idea.id}
                kind="idea"
                size={40}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleIconUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading
                  ? t("settings.uploading")
                  : iconUrl
                    ? t("idea.uploadNew")
                    : t("idea.uploadIcon")}
              </button>
              <button
                type="button"
                className="text-[12px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
                disabled={uploading}
                onClick={() => void handleIconReset()}
              >
                {t("settings.resetDefault")}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn-outline"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>

          {canEdit && (
            <div className="border-t border-[var(--divider)] pt-3">
              <IdeaStatusActions idea={idea} />
            </div>
          )}
        </div>
      ) : hasDisplay ? (
        <div className="min-w-0 flex-1 space-y-2">
          {idea.impl_status && <ImplStatusBadge status={idea.impl_status} />}
          <div className="flex flex-wrap gap-2 text-[13px]">
            {repo ? (
              <a
                href={repo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-btn)] px-2 py-1 text-[13px] text-[var(--accent-link)] hover:bg-[var(--accent-link-soft)] hover:no-underline"
              >
                <DeimosIcon name="tool" className="h-3.5 w-3.5" />
                {formatRepoLabel(repo)}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-btn)] border border-[var(--rule)] px-2 py-0.5 text-[13px] text-[var(--ink-faint)]">
                {t("idea.noRepo")}
              </span>
            )}
            {demo ? (
              <a
                href={demo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-btn)] px-2 py-1 text-[13px] text-[var(--accent-link)] hover:bg-[var(--accent-link-soft)] hover:no-underline"
              >
                <DeimosIcon name="play" className="h-3.5 w-3.5" />
                {demo.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-btn)] border border-[var(--rule)] px-2 py-0.5 text-[13px] text-[var(--ink-faint)]">
                {t("idea.noDemo")}
              </span>
            )}
            {links.filter((l) => safeUrl(l.url)).map((link, i) => {
              const url = safeUrl(link.url)!;
              // 跳过已在 repo/demo 展示的
              if (url === repo || url === demo) return null;
              return (
                <a
                  key={`${link.url}-${i}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-btn)] px-2 py-1 text-[13px] text-[var(--accent-link)] hover:bg-[var(--accent-link-soft)] hover:no-underline"
                >
                  <DeimosIcon name="share" className="h-3.5 w-3.5" />
                  {link.title || link.kind || url.replace(/^https?:\/\//, "")}
                </a>
              );
            })}
          </div>
          {canEdit && (
            <div className="pt-2">
              <IdeaStatusActions idea={idea} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-[13px]">
            <span className="badge-pill inline-flex items-center gap-1 border border-dashed border-[var(--rule)] text-[var(--ink-faint)]">
              {t("idea.implStatusUnset")}
            </span>
            <span className="badge-pill inline-flex items-center gap-1 border border-dashed border-[var(--rule)] text-[var(--ink-faint)]">
              {t("idea.noRepo")}
            </span>
            <span className="badge-pill inline-flex items-center gap-1 border border-dashed border-[var(--rule)] text-[var(--ink-faint)]">
              {t("idea.noDemo")}
            </span>
          </div>
          {canEdit && (
            <p className="text-[12px] text-[var(--ink-faint)]">
              {t("idea.implStatusHint")}
            </p>
          )}
          {canEdit && <IdeaStatusActions idea={idea} />}
        </div>
      )}
    </div>
  );
}

/** 标题旁的小图标 */
export function IdeaIcon({ idea, size = 36 }: { idea: Idea; size?: number }) {
  return (
    <WireframeAvatar
      name={idea.title}
      avatarUrl={idea.icon_url}
      entityId={idea.id}
      kind="idea"
      size={size}
    />
  );
}
