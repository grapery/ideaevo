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
import { IdeaBuryButton } from "@/components/idea-bury-button";
import { WireframeAvatar } from "@/components/wireframe-avatar";
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
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const { user } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

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
      notify.success("已保存附加信息");
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
      notify.success("已恢复默认图标");
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
      if (!putRes.ok) throw new Error("图标上传失败");
      const url = presign.public_url;
      setIconUrl(url);
      await api.updateIdeaMeta(idea.id, { icon_url: url });
      notify.success("图标已保存");
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
        <h3 className="text-[13px] font-semibold text-[var(--ink)]">{zh ? "实现信息" : "Implementation"}</h3>
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
              ? (zh ? "取消" : "Cancel")
              : hasDisplay
                ? (zh ? "编辑" : "Edit")
                : (zh ? "添加" : "Add")}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <label className="block">
            <span className="meta-label mb-1 block">{zh ? "实现状态" : "Implementation status"}</span>
            <select
              className="w-full border border-[var(--rule)] bg-[var(--bg-surface)] px-2 py-1.5 text-[13px]"
              value={implStatus}
              onChange={(e) => setImplStatus(e.target.value as IdeaImplStatus)}
            >
              <option value="">{zh ? "未设置" : "Not set"}</option>
              {Object.entries(IDEA_IMPL_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {zh ? label : ({
                    concept: "Concept",
                    in_progress: "In progress",
                    implemented: "Implemented",
                    paused: "Paused",
                  } as Record<string, string>)[k]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="meta-label mb-1 block">{zh ? "GitHub / 仓库地址" : "GitHub / Repository URL"}</span>
            <input
              type="url"
              className="w-full border border-[var(--rule)] bg-[var(--bg-surface)] px-2 py-1.5 text-[13px]"
              placeholder="https://github.com/..."
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="meta-label mb-1 block">{zh ? "演示 / 产品网址" : "Demo / Product URL"}</span>
            <input
              type="url"
              className="w-full border border-[var(--rule)] bg-[var(--bg-surface)] px-2 py-1.5 text-[13px]"
              placeholder="https://..."
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
            />
          </label>

          <div>
            <span className="meta-label mb-1 block">{zh ? "想法图标" : "Idea icon"}</span>
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
                  ? (zh ? "上传中…" : "Uploading…")
                  : iconUrl
                    ? (zh ? "更换图标" : "Change icon")
                    : (zh ? "上传图标" : "Upload icon")}
              </button>
              <button
                type="button"
                className="text-[12px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
                disabled={uploading}
                onClick={() => void handleIconReset()}
              >
                {zh ? "恢复默认" : "Restore default"}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn-outline"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? (zh ? "保存中…" : "Saving…") : (zh ? "保存" : "Save")}
          </button>

          {idea.status === "active" && (
            <div className="border-t border-[var(--divider)] pt-3">
              <IdeaBuryButton idea={idea} />
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
                className="inline-flex items-center gap-1 text-[var(--accent-link)] hover:underline"
              >
                {formatRepoLabel(repo)}
              </a>
            ) : (
              <span className="badge-pill inline-flex items-center gap-1 border border-dashed border-[var(--rule)] text-[var(--ink-faint)]">
                {zh ? "无仓库" : "No repository"}
              </span>
            )}
            {demo ? (
              <a
                href={demo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--accent-link)] hover:underline"
              >
                {demo.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="badge-pill inline-flex items-center gap-1 border border-dashed border-[var(--rule)] text-[var(--ink-faint)]">
                {zh ? "无演示" : "No demo"}
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
                  className="inline-flex items-center gap-1 text-[var(--accent-link)] hover:underline"
                >
                  {link.title || link.kind || url.replace(/^https?:\/\//, "")}
                </a>
              );
            })}
          </div>
          {canEdit && idea.status === "active" && (
            <div className="pt-2">
              <IdeaBuryButton idea={idea} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-[13px]">
            <span className="badge-pill inline-flex items-center gap-1 border border-dashed border-[var(--rule)] text-[var(--ink-faint)]">
              {zh ? "未设置实现状态" : "Implementation status not set"}
            </span>
            <span className="badge-pill inline-flex items-center gap-1 border border-dashed border-[var(--rule)] text-[var(--ink-faint)]">
              {zh ? "无仓库" : "No repository"}
            </span>
            <span className="badge-pill inline-flex items-center gap-1 border border-dashed border-[var(--rule)] text-[var(--ink-faint)]">
              {zh ? "无演示" : "No demo"}
            </span>
          </div>
          {canEdit && (
            <p className="text-[12px] text-[var(--ink-faint)]">
              {zh
                ? "可补充实现状态、仓库、演示链接与图标（均为可选）"
                : "You can add an implementation status, repository, demo, and icon."}
            </p>
          )}
          {canEdit && idea.status === "active" && <IdeaBuryButton idea={idea} />}
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
