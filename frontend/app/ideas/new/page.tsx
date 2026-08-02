"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { api, agentApi, ApiRequestError } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DeimosIcon } from "@/components/deimos-icon";
import type { Agent, Idea } from "@/lib/types";
import { useI18n } from "@/lib/i18n/provider";

const CATEGORIES = [
  { value: "tool", label: "market.catTool" as const },
  { value: "service", label: "market.catService" as const },
  { value: "integration", label: "market.catIntegration" as const },
  { value: "automation", label: "market.catAutomation" as const },
  { value: "creative", label: "market.catCreative" as const },
  { value: "data", label: "market.catData" as const },
  { value: "other", label: "market.catOther" as const },
];

type SimilarMatch = { idea: Idea; similarity: number };

export default function NewIdeaPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [agentId, setAgentId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loading, setLoading] = useState(false);
  const [similarIdeas, setSimilarIdeas] = useState<SimilarMatch[]>([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("deimos_idea_draft_from_chat");
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        title?: string;
        description?: string;
        agent_id?: string;
      };
      if (draft.title) setTitle(draft.title);
      if (draft.description) setDescription(draft.description);
      if (draft.agent_id) setAgentId(draft.agent_id);
      sessionStorage.removeItem("deimos_idea_draft_from_chat");
    } catch {
      // ignore malformed draft
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    agentApi
      .listMyAgents()
      .then((res) => {
        setAgents(res.agents);
        // 默认不选 Agent —— 后端会自动用本人个人 Agent 发布。
        // 仅当用户主动选择时才覆盖。
      })
      .catch(() => notify.error(t("dashboard.loadAgentsFailed")))
      .finally(() => setLoadingAgents(false));
  }, [user]);

  const selectedAgent = agents.find((a) => a.id === agentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      openAuthModal({ returnUrl: "/ideas/new" });
      return;
    }
    const titleValue = title.trim();
    const d = description.trim();
    if (!titleValue || !d) {
      notify.error(t("idea.errTitleDesc"));
      return;
    }
    setLoading(true);
    setSimilarIdeas([]);
    try {
      const idea = await api.createIdea({
        title: titleValue,
        description: d,
        category,
        agent_id: agentId || undefined,
      });
      notify.success(t("idea.publishedToast"));
      router.push(`/ideas/${idea.id}`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        const matches = err.body?.similar_ideas;
        if (Array.isArray(matches) && matches.length > 0) {
          setSimilarIdeas(matches as SimilarMatch[]);
        }
      }
      notify.error(getErrorMessage(err, t("idea.publishFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <p className="page-eyebrow">{t("idea.publishEyebrow")}</p>
        <h1 className="page-heading">{t("idea.publishTitle")}</h1>
        <p className="page-heading-desc">{t("idea.publishDesc")}</p>

        <div className="mt-6 app-grid-2 lg:grid-cols-[minmax(0,var(--content-main))_var(--content-aside)] lg:justify-center">
          <form onSubmit={handleSubmit} className="surface-card p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="new-agent" label={t("idea.publishPublisher")}>
                {loadingAgents ? (
                  <p className="text-[12px] text-[var(--ink-faint)]">{t("idea.loadingIdentities")}</p>
                ) : (
                  <select
                    value={agentId}
                    onChange={(event) => setAgentId(event.target.value)}
                    className="input-field h-9"
                  >
                    <option value="">{t("idea.humanOwnerOption")}</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField id="new-category" label={t("idea.publishCategory")}>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="input-field h-9"
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>{t(item.label)}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <p className="mt-2 font-code text-[10px] text-[var(--ink-faint)]">
              {selectedAgent
                ? t("idea.executorLine", { name: selectedAgent.name })
                : t("idea.ownerHumanLine")}
            </p>

            <div className="mt-5">
              <FormField id="new-title" label={t("idea.publishTitleField")} required>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("idea.titlePlaceholder")}
                  maxLength={500}
                  className="h-10"
                />
              </FormField>
            </div>

            <div className="mt-5">
              <FormField id="new-desc" label={t("idea.publishBodyField")} required>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t("idea.publishDescPlaceholder")}
                  rows={12}
                  className="w-full font-code text-[12px] leading-6"
                />
              </FormField>
            </div>

            {similarIdeas.length > 0 && (
              <section className="callout-primary mt-5 p-4">
                <p className="font-code text-[10px] font-medium text-[var(--primary)]">
                  {t("idea.similarityGuard")}
                </p>
                <ul className="mt-3 space-y-2">
                  {similarIdeas.map(({ idea, similarity }) => (
                    <li key={idea.id} className="flex items-center justify-between gap-4 text-[12px]">
                      <Link href={`/ideas/${idea.id}`} className="truncate text-[var(--ink)] hover:text-[var(--accent-link)]">
                        {idea.title}
                      </Link>
                      <span className="shrink-0 font-code text-[10px] text-[var(--primary)]">
                        {t("idea.matchPct", { pct: Math.round(similarity * 100) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--rule)] pt-4">
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                icon={<DeimosIcon name="send" className="h-4 w-4" />}
              >
                {loading ? t("idea.publishing") : t("idea.publishButton")}
              </Button>
              <Link href="/ideas" className="font-code text-[10px] text-[var(--ink-faint)] hover:text-[var(--ink)]">
                {t("idea.cancelLink")}
              </Link>
            </div>
          </form>

          <aside className="space-y-4">
            <section className="callout-primary p-4">
              <p className="font-code text-[10px] font-medium text-[var(--primary)]">
                {t("idea.similarityPreflight")}
              </p>
              <p className="mt-4 text-[13px] font-semibold text-[var(--ink)]">
                {t("idea.autoCheck")}
              </p>
              <div className="mt-4 space-y-2 font-code text-[10px] leading-5 text-[var(--ink-soft)]">
                <p>{t("idea.checkSemantic")}</p>
                <p>{t("idea.checkOverlap")}</p>
                <p>{t("idea.checkEvidence")}</p>
              </div>
            </section>

            <section className="panel-inverse p-4 font-code text-[10px] leading-6">
              <p className="panel-inverse-accent">{t("idea.aiNativePublish")}</p>
              <p className="mt-3 panel-inverse-muted">{t("idea.aiNativePublishHint")}</p>
              <Link href="/chat" className="mt-4 inline-flex panel-inverse-accent hover:underline">
                {t("idea.openWorkbench")}
              </Link>
            </section>

            <section className="callout-link p-4">
              <p className="font-code text-[10px] text-[var(--accent-link)]">
                {t("idea.whatGetsRecorded")}
              </p>
              <p className="mt-3 font-code text-[10px] leading-5 text-[var(--accent-link)]">
                {t("idea.whatGetsRecordedHint")}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
