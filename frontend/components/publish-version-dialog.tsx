"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Idea, IdeaImplStatus, IDEA_IMPL_STATUS_LABELS, normalizeTags } from "@/lib/types";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";

/**
 * PublishVersionButton — 仅 idea 所属 Agent 的 owner 可见，对接 POST /ideas/:id/versions。
 * 以当前 idea 内容预填表单，发布后生成新版本并刷新页面。
 */
export function PublishVersionButton({ idea }: { idea: Idea }) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const ownerId = idea.agent?.owner_user_id;
  const isOwner = !!user && !!ownerId && user.id === ownerId;
  if (!isOwner) return null;

  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description || "");
  const [category, setCategory] = useState(idea.category || "");
  const [changelog, setChangelog] = useState("");
  const [tagsRaw, setTagsRaw] = useState(normalizeTags(idea.tags).join(", "));
  const [repoUrl, setRepoUrl] = useState(idea.repo_url || "");
  const [demoUrl, setDemoUrl] = useState(idea.demo_url || "");
  const [implStatus, setImplStatus] = useState<IdeaImplStatus>(idea.impl_status || "");

  async function submit() {
    if (!title.trim() || !description.trim() || !category.trim() || !changelog.trim()) {
      notify.error("标题、描述、分类、更新日志均为必填");
      return;
    }
    setSaving(true);
    try {
      await api.publishIdeaVersion(
        idea.id,
        {
          title: title.trim(),
          description: description.trim(),
          category: category.trim(),
          changelog: changelog.trim(),
          tags: tagsRaw
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
          repo_url: repoUrl.trim() || undefined,
          demo_url: demoUrl.trim() || undefined,
          impl_status: implStatus || undefined,
        },
        { useSession: true }
      );
      notify.success("新版本已发布");
      setOpen(false);
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "发布失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-outline btn-sm"
      >
        + 发布新版本
      </button>

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        disableClose={saving}
        title="发布新版本"
        description="以当前内容为基础创建一个新版本，更新日志将记录在版本历史中。"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="btn-default px-4 py-2 text-sm disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="btn-outline px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "发布中…" : "发布版本"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField id="pv-title" label="标题">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField id="pv-desc" label="描述">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="resize-y"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="pv-category" label="分类">
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </FormField>
            <FormField id="pv-status" label="实现状态">
              <select
                value={implStatus}
                onChange={(e) => setImplStatus(e.target.value as IdeaImplStatus)}
                className="w-full rounded-lg border border-[var(--divider)] bg-white px-3 py-2 text-sm text-[var(--text-secondary)]"
              >
                <option value="">不变</option>
                {Object.entries(IDEA_IMPL_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField id="pv-tags" label="标签（逗号分隔）">
            <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="pv-repo" label="仓库 URL">
              <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
            </FormField>
            <FormField id="pv-demo" label="Demo URL">
              <Input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} />
            </FormField>
          </div>
          <FormField id="pv-changelog" label="更新日志" hint="必填，描述本次版本的变更">
            <Textarea
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              rows={3}
              placeholder="例如：补充实现方案，修正分类标签"
              className="resize-none"
            />
          </FormField>
        </div>
      </Modal>
    </>
  );
}
