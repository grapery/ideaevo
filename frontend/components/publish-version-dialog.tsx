"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Idea, IdeaImplStatus, normalizeTags } from "@/lib/types";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { useI18n } from "@/lib/i18n/provider";

/**
 * PublishVersionButton — 仅 idea 所属 Agent 的 owner 可见，对接 POST /ideas/:id/versions。
 * 以当前 idea 内容预填表单，发布后生成新版本并刷新页面。
 */
export function PublishVersionButton({ idea }: { idea: Idea }) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
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

  const implStatusOptions: { value: IdeaImplStatus; label: string }[] = [
    { value: "concept", label: t("idea.concept") },
    { value: "in_progress", label: t("idea.inProgress") },
    { value: "implemented", label: t("idea.implemented") },
    { value: "paused", label: t("idea.paused") },
  ];

  async function submit() {
    if (!title.trim() || !description.trim() || !category.trim() || !changelog.trim()) {
      notify.error(t("idea.versionRequiredFields"));
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
            .map((tg) => tg.trim())
            .filter(Boolean),
          repo_url: repoUrl.trim() || undefined,
          demo_url: demoUrl.trim() || undefined,
          impl_status: implStatus || undefined,
        },
        { useSession: true },
      );
      notify.success(t("idea.versionPublished"));
      setOpen(false);
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.publishFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-outline btn-sm">
        {t("idea.publishNewVersion")}
      </button>

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        disableClose={saving}
        title={t("idea.publishVersionTitle")}
        description={t("idea.publishVersionDesc")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="btn-default px-4 py-2 text-sm disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="btn-outline px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? t("idea.publishing") : t("idea.publishVersionButton")}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField id="pv-title" label={t("fork.titleLabel")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField id="pv-desc" label={t("fork.descLabel")}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="resize-y"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="pv-category" label={t("idea.category")}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field w-full text-sm text-[var(--text-secondary)]"
              >
                <option value="tool">{t("market.catTool")}</option>
                <option value="service">{t("market.catService")}</option>
                <option value="integration">{t("market.catIntegration")}</option>
                <option value="automation">{t("market.catAutomation")}</option>
                <option value="creative">{t("market.catCreative")}</option>
                <option value="data">{t("market.catData")}</option>
                <option value="other">{t("market.catOther")}</option>
              </select>
            </FormField>
            <FormField id="pv-status" label={t("idea.implStatus")}>
              <select
                value={implStatus}
                onChange={(e) => setImplStatus(e.target.value as IdeaImplStatus)}
                className="input-field w-full text-sm text-[var(--text-secondary)]"
              >
                <option value="">{t("idea.unchanged")}</option>
                {implStatusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField id="pv-tags" label={t("idea.tagsComma")}>
            <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="pv-repo" label={t("idea.repoUrl")}>
              <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
            </FormField>
            <FormField id="pv-demo" label={t("idea.demoUrl")}>
              <Input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} />
            </FormField>
          </div>
          <FormField id="pv-changelog" label={t("idea.changelog")} hint={t("idea.changelogHint")}>
            <Textarea
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              rows={3}
              placeholder={t("idea.changelogPlaceholder")}
              className="resize-none"
            />
          </FormField>
        </div>
      </Modal>
    </>
  );
}
