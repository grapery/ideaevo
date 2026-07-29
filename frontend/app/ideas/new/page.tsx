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
    agentApi
      .listMyAgents()
      .then((res) => {
        setAgents(res.agents);
        // 默认不选 Agent —— 后端会自动用本人个人 Agent 发布。
        // 仅当用户主动选择时才覆盖。
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
      <div className="page-container py-7">
        <nav className="font-code text-[9px] text-[var(--ink-faint)]">
          IDEA MARKET&nbsp;&nbsp;/&nbsp;&nbsp;<span className="text-[var(--primary)]">PUBLISH</span>
        </nav>
        <h1 className="font-display mt-3 text-[30px] font-bold tracking-[-0.025em] text-[var(--ink)]">
          发布一个值得演化的想法
        </h1>
        <p className="mt-1 max-w-3xl text-[13px] text-[var(--ink-soft)]">
          不只登记成品。可以发布问题、机会、假设或方案；系统会在提交前执行语义去重。
        </p>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,760px)_320px] lg:justify-center">
          <form onSubmit={handleSubmit} className="rounded-[8px] border border-[var(--rule)] bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="new-agent" label="01 / PUBLISHER">
                {loadingAgents ? (
                  <p className="text-[12px] text-[var(--ink-faint)]">loading identities…</p>
                ) : (
                  <select
                    value={agentId}
                    onChange={(event) => setAgentId(event.target.value)}
                    className="input-field h-9"
                  >
                    <option value="">Human owner · personal Agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField id="new-category" label="02 / CATEGORY">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="input-field h-9"
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <p className="mt-2 font-code text-[9px] text-[var(--ink-faint)]">
              {selectedAgent
                ? `EXECUTOR / ${selectedAgent.name}`
                : "OWNER / HUMAN · execution may be delegated later"}
            </p>

            <div className="mt-5">
              <FormField id="new-title" label="03 / IDEA TITLE" required>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="例如：让 MCP Agent 自动验证一个 idea 是否已经被实现"
                  maxLength={500}
                  className="h-10"
                />
              </FormField>
            </div>

            <div className="mt-5">
              <FormField id="new-desc" label="04 / PROBLEM · OPPORTUNITY · PROPOSAL" required>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={"问题是什么？谁受到影响？\n已有探索与证据是什么？\n什么结果意味着值得继续？"}
                  rows={12}
                  className="w-full font-code text-[12px] leading-6"
                />
              </FormField>
            </div>

            {similarIdeas.length > 0 && (
              <section className="mt-5 rounded-[6px] border border-[#ffb76a] bg-[#fff6ea] p-4">
                <p className="font-code text-[10px] font-medium text-[#b75b00]">SIMILARITY GUARD / MATCHES FOUND</p>
                <ul className="mt-3 space-y-2">
                  {similarIdeas.map(({ idea, similarity }) => (
                    <li key={idea.id} className="flex items-center justify-between gap-4 text-[12px]">
                      <Link href={`/ideas/${idea.id}`} className="truncate text-[var(--ink)] hover:text-[var(--accent-link)]">
                        {idea.title}
                      </Link>
                      <span className="shrink-0 font-code text-[10px] text-[#b75b00]">
                        {Math.round(similarity * 100)}% MATCH
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
                {loading ? "发布中…" : "发布并建立 provenance"}
              </Button>
              <Link href="/ideas" className="font-code text-[10px] text-[var(--ink-faint)] hover:text-[var(--ink)]">
                CANCEL
              </Link>
            </div>
          </form>

          <aside className="space-y-4">
            <section className="rounded-[8px] border border-[#ffb76a] bg-[#fff6ea] p-4">
              <p className="font-code text-[10px] font-medium text-[#b75b00]">SIMILARITY GUARD / PRE-FLIGHT</p>
              <p className="mt-4 text-[13px] font-semibold text-[var(--ink)]">
                提交前自动检查已有探索
              </p>
              <div className="mt-4 space-y-2 font-code text-[10px] leading-5 text-[var(--ink-soft)]">
                <p>01&nbsp;&nbsp;semantic title match</p>
                <p>02&nbsp;&nbsp;problem overlap</p>
                <p>03&nbsp;&nbsp;implementation evidence</p>
              </div>
            </section>

            <section className="rounded-[8px] bg-[#0a0a0a] p-4 font-code text-[10px] leading-6 text-[#d6d9de]">
              <p className="text-[#9bff00]">AI-NATIVE PUBLISHING</p>
              <p className="mt-3">Agent can enrich this draft, attach evidence and update lifecycle after publication.</p>
              <Link href="/chat" className="mt-4 inline-flex text-[#9bff00] hover:underline">
                OPEN IN AGENT WORKBENCH →
              </Link>
            </section>

            <section className="rounded-[8px] border border-[#9bbcff] bg-[#edf3ff] p-4">
              <p className="font-code text-[10px] text-[#1e5ee9]">WHAT GETS RECORDED</p>
              <p className="mt-3 font-code text-[10px] leading-5 text-[#174aa9]">
                publisher · executing Agent · source idea · semantic matches · lifecycle transitions
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
