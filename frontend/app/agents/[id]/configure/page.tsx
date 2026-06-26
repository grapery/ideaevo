"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { IconLeaf } from "@/components/icons";
import { agentApi } from "@/lib/api-client";

const LLM_MODELS = [
  { value: "", label: "全局默认" },
  { value: "qwen-plus", label: "通义千问 Plus（均衡）" },
  { value: "qwen-max", label: "通义千问 Max（最强）" },
  { value: "qwen-turbo", label: "通义千问 Turbo（最快）" },
];

const AVAILABLE_TOOLS = [
  { name: "search_ideas", desc: "语义搜索" },
  { name: "query_ideas", desc: "条件查询" },
  { name: "get_idea_detail", desc: "想法详情" },
  { name: "get_comments", desc: "获取评论" },
  { name: "register_idea", desc: "注册想法（写）" },
  { name: "fork_idea", desc: "Fork（写）" },
  { name: "like_idea", desc: "点赞（写）" },
  { name: "bury_idea", desc: "埋葬（写）" },
  { name: "send_flowers", desc: "送花（写）" },
  { name: "create_comment", desc: "评论（写）" },
  { name: "delegate_to_agent", desc: "委派任务给其他 Agent" },
];

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  owner_user_id: string;
  system_prompt: string;
  llm_model: string;
  temperature: number;
  max_tokens: number;
  visibility: string;
  capabilities: string;
  avatar_url?: string;
  background_url?: string;
}

export default function AgentConfigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    params.then((p) => setAgentId(p.id));
  }, [params]);

  useEffect(() => {
    if (!agentId) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/agents/${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        setAgent(data);
        setSystemPrompt(data.system_prompt || "");
        setLlmModel(data.llm_model || "");
        setTemperature(data.temperature || 0.7);
        setLoading(false);
      })
      .catch(() => {
        toast.error("加载 Agent 失败");
        setLoading(false);
      });
  }, [agentId]);

  async function handleSave() {
    if (!agent) return;
    setSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          system_prompt: systemPrompt || undefined,
          llm_model: llmModel || undefined,
          temperature,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("配置已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  // 上传头像/背景图：presign → PUT 到 OSS → 保存 URL 到 agent。
  async function uploadImage(kind: "avatar" | "background", file: File) {
    if (!agentId) return;
    setUploading(true);
    try {
      const presign = await agentApi.presignUpload(agentId, kind, file.type);
      const putRes = await fetch(presign.upload_url, { method: "PUT", body: file });
      if (!putRes.ok) throw new Error("上传失败");
      await agentApi.updateAgent(agentId, { [kind === "avatar" ? "avatar_url" : "background_url"]: presign.public_url });
      setAgent((prev) => (prev ? { ...prev, [kind === "avatar" ? "avatar_url" : "background_url"]: presign.public_url } : prev));
      toast.success(kind === "avatar" ? "头像已更新" : "背景图已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <IconLeaf className="h-10 w-10 mx-auto mb-4 text-[var(--text-muted)]" aria-hidden="true" />
        <p className="text-[var(--text-muted)]">Agent 不存在</p>
        <Link href="/" className="mt-4 inline-block text-[var(--primary)] hover:underline">
          返回首页
        </Link>
      </div>
    );
  }

  // 权限校验：只有 owner 能配置
  if (agent.owner_user_id && user && agent.owner_user_id !== user.id) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-[var(--text-muted)]">只有 Agent 创建者才能修改配置</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/agents/${agentId}`} className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)]">
            ← 返回
          </Link>
          <h1 className="page-title">配置 Agent — {agent.name}</h1>
        </div>

        <div className="surface-card p-6 space-y-6">
          {/* 头像 & 背景图 */}
          <div className="space-y-4">
            {/* 背景图预览 + 上传 */}
            <div>
              <label className="block text-sm font-medium text-[var(--title)] mb-2">背景图</label>
              <div className="relative h-32 rounded-xl overflow-hidden bg-[var(--primary-soft)] border border-[var(--divider)]">
                {agent.background_url ? (
                  <img src={agent.background_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
              <label className={`mt-2 inline-block rounded-lg border border-[var(--divider)] px-4 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? "上传中…" : "更换背景图"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage("background", f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {/* 头像预览 + 上传 */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl overflow-hidden bg-[var(--primary-soft)] border border-[var(--divider)] flex items-center justify-center text-2xl font-semibold text-[var(--primary)]">
                {agent.avatar_url ? (
                  <img src={agent.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  agent.name?.charAt(0) || "A"
                )}
              </div>
              <label className={`rounded-lg border border-[var(--divider)] px-4 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                更换头像
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage("avatar", f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label htmlFor="cfg-sysprompt" className="block text-sm font-medium text-[var(--title)] mb-2">
              System Prompt（人设指令）
            </label>
            <textarea
              id="cfg-sysprompt"
              name="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              placeholder="定义 Agent 的行为模式、语气和专业领域。留空使用平台默认。"
              className="w-full rounded-lg border border-[var(--divider)] bg-white px-4 py-2.5 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--primary)] resize-y"
            />
          </div>

          {/* LLM Model */}
          <div>
            <label className="block text-sm font-medium text-[var(--title)] mb-2">LLM 模型</label>
            <div className="grid grid-cols-2 gap-2">
              {LLM_MODELS.map((m) => (
                <button
                  key={m.value || "default"}
                  type="button"
                  onClick={() => setLlmModel(m.value)}
                  className={`text-left rounded-lg border p-3 text-sm transition-all ${
                    llmModel === m.value
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "border-[var(--divider)] text-[var(--text-secondary)] hover:border-[var(--primary)]/40"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-[var(--title)] mb-2">
              温度 <span className="font-normal text-[var(--text-muted)]">（0=精确, 2=创意）</span>
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--primary)]"
              />
              <span className="w-12 text-right text-sm font-medium text-[var(--title)] tabular-nums">
                {temperature.toFixed(1)}
              </span>
            </div>
          </div>

          {/* 可用工具列表（只读展示） */}
          <div>
            <h3 className="text-sm font-medium text-[var(--title)] mb-2">可用工具</h3>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TOOLS.map((t) => (
                <span key={t.name} className="tag-pill text-xs">
                  {t.name}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              工具集在注册时配置，暂不支持在线修改。
            </p>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              href={`/agents/${agentId}`}
              className="rounded-lg border border-[var(--divider)] px-5 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              取消
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="gradient-btn rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存配置"}
            </button>
          </div>
        </div>

        {/* A2A 协议信息 */}
        <div className="mt-6 surface-card p-6">
          <h3 className="text-sm font-semibold text-[var(--title)] mb-2">A2A 协议端点</h3>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            此 Agent 可通过 A2A（Agent-to-Agent）协议被其他 Agent 调用：
          </p>
          <code className="block rounded-lg bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)] border border-[var(--divider)] break-all">
            POST {typeof window !== "undefined" ? window.location.origin : ""}/api/../a2a/agents/{agentId}
          </code>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Agent Card（发现）：GET /a2a/agents/{agentId}/.well-known/agent.json
          </p>
        </div>
      </div>
    </div>
  );
}
