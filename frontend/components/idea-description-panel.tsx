"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Idea, type IdeaVersionSummary } from "@/lib/types";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { MarkdownContent } from "@/components/markdown-content";
import {
  imageFileFromClipboard,
  imageFileFromDataTransfer,
  insertAtTextareaCursor,
  markdownImageSnippet,
  uploadIdeaDescriptionImage,
} from "@/lib/idea-image-upload";

function formatVersionTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IdeaDescriptionPanel({ idea }: { idea: Idea }) {
  const { user } = useAuth();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const canEdit = useMemo(() => {
    if (!user) return false;
    return idea.agent?.owner_user_id === user.id;
  }, [user, idea.agent?.owner_user_id]);

  const [versions, setVersions] = useState<IdeaVersionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState(idea.description);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(idea.description);
  const [changelog, setChangelog] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);

  const currentVersion = versions.find((v) => v.is_current);
  const isViewingCurrent = !selectedId || selectedId === currentVersion?.id;
  const selectedSummary = versions.find((v) => v.id === selectedId) ?? currentVersion;

  const loadVersions = useCallback(async () => {
    try {
      const res = await api.getIdeaVersions(idea.id);
      setVersions(res.versions);
      const current = res.versions.find((v) => v.is_current) ?? res.versions[res.versions.length - 1];
      if (current) {
        setSelectedId(current.id);
      }
    } catch {
      // 降级：无版本 API 时用 idea.description
    }
  }, [idea.id]);

  const loadVersionContent = useCallback(
    async (versionId: string) => {
      setLoadingVersion(true);
      try {
        const v = await api.getIdeaVersion(idea.id, versionId);
        setContent(v.description);
      } catch (err) {
        notify.error(getErrorMessage(err));
      } finally {
        setLoadingVersion(false);
      }
    },
    [idea.id]
  );

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  useEffect(() => {
    if (!selectedId) {
      setContent(idea.description);
      return;
    }
    if (selectedId === currentVersion?.id) {
      setContent(idea.description);
      return;
    }
    void loadVersionContent(selectedId);
  }, [selectedId, currentVersion?.id, idea.description, loadVersionContent]);

  useEffect(() => {
    if (editing && isViewingCurrent) {
      setDraft(idea.description);
    }
  }, [editing, isViewingCurrent, idea.description]);

  async function handleSave() {
    const text = draft.trim();
    if (!text) {
      notify.error("描述不能为空");
      return;
    }
    setSaving(true);
    try {
      await api.updateIdeaDescription(idea.id, {
        description: text,
        changelog: changelog.trim(),
      });
      notify.success("描述已保存");
      setEditing(false);
      setChangelog("");
      router.refresh();
      await loadVersions();
      setContent(text);
    } catch (err) {
      notify.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function insertImage(file: File) {
    if (!file.type.startsWith("image/")) {
      notify.error("仅支持 JPEG、PNG、WebP 图片");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadIdeaDescriptionImage(idea.id, file);
      const alt = file.name.replace(/\.[^.]+$/, "") || "配图";
      const snippet = markdownImageSnippet(url, alt);
      const { next, cursor } = insertAtTextareaCursor(draft, snippet, textareaRef.current);
      setDraft(next);
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(cursor, cursor);
        }
      });
      notify.success("图片已插入");
    } catch (err) {
      notify.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleImageUpload(file: File) {
    await insertImage(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const file = imageFileFromClipboard(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    void insertImage(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = imageFileFromDataTransfer(e.dataTransfer);
    if (file) void insertImage(file);
  }

  return (
    <div className="mt-6 border-t border-[var(--divider)] pt-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--ink)]">想法描述</h2>
        {canEdit && isViewingCurrent && !editing && (
          <button type="button" className="btn-outline btn-sm" onClick={() => setEditing(true)}>
            编辑
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => {
                setEditing(false);
                setDraft(idea.description);
                setChangelog("");
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "保存中…" : "保存新版本"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {versions.length > 0 && (
          <nav className="lg:w-48 shrink-0" aria-label="描述版本时间线">
            <div className="relative pl-3">
              <div
                className="absolute left-[5px] top-1 bottom-1 w-px bg-[var(--rule)]"
                aria-hidden="true"
              />
              <ul className="space-y-0">
                {versions.map((v) => {
                  const active = v.id === (selectedId ?? currentVersion?.id);
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(v.id);
                          setEditing(false);
                        }}
                        className={`group relative flex w-full flex-col items-start py-2.5 pl-4 text-left transition-colors ${
                          active ? "text-[var(--ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                        }`}
                      >
                        <span
                          className={`absolute left-0 top-[13px] h-2.5 w-2.5 rounded-full border-2 ${
                            active
                              ? "border-[var(--accent-link)] bg-[var(--accent-link)]"
                              : "border-[var(--rule)] bg-[var(--bg-surface)] group-hover:border-[var(--ink-faint)]"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="text-[13px] font-medium leading-snug">
                          v{v.version}
                          {v.is_current && (
                            <span className="ml-1.5 font-[family-name:var(--font-mono)] text-[9px] font-normal uppercase tracking-wider text-[var(--accent-link)]">
                              当前
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 line-clamp-1 text-[12px] leading-snug text-[var(--ink-faint)]">
                          {v.changelog || `版本 ${v.version}`}
                        </span>
                        <span className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-[var(--ink-faint)]">
                          {formatVersionTime(v.created_at)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        )}

        <div className="min-w-0 flex-1">
          {editing && isViewingCurrent ? (
            <div className="space-y-3">
              <div
                className="grid gap-4 lg:grid-cols-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="meta-label">Markdown 源码</span>
                    <span className="text-[10px] text-[var(--ink-faint)]">可拖拽或粘贴图片</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onPaste={handlePaste}
                    rows={16}
                    className="w-full resize-y border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] leading-relaxed font-[family-name:var(--font-mono)] text-[var(--ink)]"
                    placeholder="支持 Markdown 文本与图片：![说明](url)"
                  />
                </div>
                {previewOpen && (
                  <div className="min-w-0 border border-[var(--rule)] bg-[var(--bg-subtle)] p-4">
                    <div className="mb-2 meta-label">预览</div>
                    {draft.trim() ? (
                      <MarkdownContent content={draft} />
                    ) : (
                      <p className="text-[12px] text-[var(--ink-faint)]">输入 Markdown 后在此预览图文效果</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImageUpload(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={uploading}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {uploading ? "上传中…" : "插入图片"}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm lg:hidden"
                  onClick={() => setPreviewOpen((v) => !v)}
                >
                  {previewOpen ? "隐藏预览" : "显示预览"}
                </button>
                <span className="text-[11px] text-[var(--ink-faint)]">
                  图片上传至 OSS 后以 Markdown 插图保存
                </span>
              </div>
              <label className="block">
                <span className="meta-label mb-1 block">版本说明（可选）</span>
                <input
                  type="text"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  className="w-full border border-[var(--rule)] bg-[var(--bg-surface)] px-2 py-1.5 text-[13px]"
                  placeholder="例如：补充实现细节、更新配图"
                />
              </label>
            </div>
          ) : loadingVersion ? (
            <p className="text-[13px] text-[var(--ink-faint)]">加载版本中…</p>
          ) : (
            <>
              {selectedSummary && !isViewingCurrent && (
                <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
                  查看历史版本 · v{selectedSummary.version} · {formatVersionTime(selectedSummary.created_at)}
                </p>
              )}
              <MarkdownContent content={content} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
