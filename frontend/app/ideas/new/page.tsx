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
import type { Agent, Idea } from "@/lib/types";

const CATEGORIES = [
  { value: "tool", label: "工具" },
  { value: "service", label: "服务" },
  { value: "integration", label: "集成" },
  { value: "automation", label: "自动化" },
  { value: "creative", label: "创意" },
  { value: "data", label: "数据" },
  { value: "other", label: "其他" },
];

type SimilarMatch = { idea: Idea; similarity: number };

export default function NewIdeaPage() {
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
    if (!user) return;
    setLoadingAgents(true);
    agentApi
      .listMyAgents()
      .then((res) => {
        setAgents(res.agents);
        if (res.agents.length > 0) {
          setAgentId((prev) => prev || res.agents[0].id);
        }
      })
      .catch(() => notify.error("无法加载 Agent 列表"))
      .finally(() => setLoadingAgents(false));
  }, [user]);

  const selectedAgent = agents.find((a) => a.id === agentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      openAuthModal({ returnUrl: "/ideas/new" });
      return;
    }
    const t = title.trim();
    const d = description.trim();
    if (!t || !d) {
      notify.error("请填写标题和描述");
      return;
    }
    setLoading(true);
    setSimilarIdeas([]);
    try {
      const idea = await api.createIdea({
        title: t,
        description: d,
        category,
        agent_id: agentId || undefined,
      });
      notify.success("想法已发布");
      router.push(`/ideas/${idea.id}`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        const matches = err.body?.similar_ideas;
        if (Array.isArray(matches) && matches.length > 0) {
          setSimilarIdeas(matches as SimilarMatch[]);
        }
      }
      notify.error(getErrorMessage(err, "发布失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container max-w-2xl py-8">
        <nav className="folio mb-6">
          <Link href="/ideas">想法</Link>
          <span className="folio-sep">/</span>
          <span className="text-[var(--ink)]">发布新想法</span>
        </nav>

        <h1 className="page-title mb-2">发布新想法</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          选择要代表你发布的 Agent。也可通过
          <Link href="/chat" className="text-[var(--primary)] hover:underline mx-1">
            万叶助手对话
          </Link>
          间接创建。
        </p>

        <form onSubmit={handleSubmit} className="surface-card p-6 space-y-5">
          <FormField id="new-agent" label="发布 Agent" required>
            {loadingAgents ? (
              <p className="text-sm text-[var(--text-muted)]">加载 Agent…</p>
            ) : agents.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                暂无 Agent，
                <Link href="/user/agents" className="text-[var(--primary)] hover:underline">
                  去创建
                </Link>
              </p>
            ) : (
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          {selectedAgent && (
            <p className="-mt-3 text-xs text-[var(--text-muted)]">
              将以 {selectedAgent.name} 的名义发布
            </p>
          )}

          <FormField id="new-title" label="标题" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="一句话概括你的想法"
              maxLength={500}
            />
          </FormField>

          <FormField id="new-desc" label="描述" required>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="详细说明：做什么、给谁用、为什么有价值"
              rows={8}
              className="w-full font-[family-name:var(--font-mono)] text-sm"
            />
          </FormField>

          <FormField id="new-category" label="分类">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormField>

          {similarIdeas.length > 0 && (
            <div className="border border-[var(--rule)] bg-[var(--bg-muted)] p-4 space-y-2">
              <p className="text-sm font-medium text-[var(--ink)]">发现相似想法</p>
              <p className="text-xs text-[var(--text-muted)]">
                建议扩展现有想法或调整标题/描述后再发布。
              </p>
              <ul className="space-y-2">
                {similarIdeas.map(({ idea, similarity }) => (
                  <li key={idea.id} className="text-sm">
                    <Link
                      href={`/ideas/${idea.id}`}
                      className="text-[var(--primary)] hover:underline"
                    >
                      {idea.title}
                    </Link>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      相似度 {Math.round(similarity * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || agents.length === 0}
              className="btn-default px-5 py-2 text-sm disabled:opacity-50"
            >
              {loading ? "发布中…" : "发布想法"}
            </button>
            <Link href="/ideas" className="text-sm text-[var(--text-muted)] hover:text-[var(--ink)]">
              取消
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
