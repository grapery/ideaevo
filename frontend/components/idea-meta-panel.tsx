"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Idea,
  IDEA_IMPL_STATUS_LABELS,
  safeUrl,
  type IdeaImplStatus,
} from "@/lib/types";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { ImplStatusBadge } from "@/components/impl-status-badge";

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
  const { user } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

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

  if (!hasDisplay && !canEdit) return null;

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
    <div className="mt-5 border-t border-[var(--divider)] pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-[var(--ink)]">实现信息</h3>
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
            {editing ? "取消" : hasDisplay ? "编辑" : "添加"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <label className="block">
            <span className="meta-label mb-1 block">实现状态</span>
            <select
              className="w-full border border-[var(--rule)] bg-[var(--bg-surface)] px-2 py-1.5 text-[13px]"
              value={implStatus}
              onChange={(e) => setImplStatus(e.target.value as IdeaImplStatus)}
            >
              <option value="">未设置</option>
              {Object.entries(IDEA_IMPL_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="meta-label mb-1 block">GitHub / 仓库地址</span>
            <input
              type="url"
              className="w-full border border-[var(--rule)] bg-[var(--bg-surface)] px-2 py-1.5 text-[13px]"
              placeholder="https://github.com/..."
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="meta-label mb-1 block">演示 / 产品网址</span>
            <input
              type="url"
              className="w-full border border-[var(--rule)] bg-[var(--bg-surface)] px-2 py-1.5 text-[13px]"
              placeholder="https://..."
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
            />
          </label>

          <div>
            <span className="meta-label mb-1 block">想法图标</span>
            <div className="flex items-center gap-3">
              {iconUrl && safeUrl(iconUrl) ? (
                <img src={safeUrl(iconUrl)!} alt="" className="h-10 w-10 border border-[var(--rule)] object-cover" />
              ) : (
                <div className="btn-icon h-10 w-10 text-xs text-[var(--ink-faint)]">—</div>
              )}
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
                {uploading ? "上传中…" : iconUrl ? "更换图标" : "上传图标"}
              </button>
              {iconUrl && (
                <button
                  type="button"
                  className="text-[12px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
                  onClick={() => setIconUrl("")}
                >
                  移除
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn-outline"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      ) : hasDisplay ? (
        <div className="min-w-0 flex-1 space-y-2">
          {idea.impl_status && <ImplStatusBadge status={idea.impl_status} />}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {repo && (
              <a
                href={repo}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-link)] hover:underline"
              >
                {formatRepoLabel(repo)}
              </a>
            )}
            {demo && (
              <a
                href={demo}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-link)] hover:underline"
              >
                {demo.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-[var(--ink-faint)]">
          可补充实现状态、仓库、演示链接与图标（均为可选）
        </p>
      )}
    </div>
  );
}

/** 标题旁的小图标 */
export function IdeaIcon({ idea }: { idea: Idea }) {
  const icon = safeUrl(idea.icon_url);
  if (!icon) return null;
  return (
    <img
      src={icon}
      alt=""
      className="h-9 w-9 shrink-0 border border-[var(--rule)] object-cover"
    />
  );
}
