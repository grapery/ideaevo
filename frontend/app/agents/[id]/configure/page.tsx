"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/components/ui/notify";
import { IconLeaf } from "@/components/icons";
import { agentApi } from "@/lib/api-client";
import { AgentApiKeyPanel } from "@/components/agent-api-key-panel";
import { WireframeAvatar } from "@/components/wireframe-avatar";

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
  { name: "send_flowers", desc: "表达期待（写）" },
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
  allow_follow: boolean;
  allow_chat: boolean;
  capabilities: string;
  avatar_url?: string;
  background_url?: string;
}

export default function AgentConfigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [visibility, setVisibility] = useState("public");
  const [allowFollow, setAllowFollow] = useState(true);
  const [allowChat, setAllowChat] = useState(true);
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
        setVisibility(data.visibility || "public");
        setAllowFollow(data.allow_follow !== false);
        setAllowChat(data.allow_chat !== false);
        setLoading(false);
      })
      .catch(() => {
        notify.error("加载 Agent 失败");
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
          visibility,
          allow_follow: allowFollow,
          allow_chat: allowChat,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      notify.success("配置已保存");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function resetAvatar() {
    if (!agentId) return;
    setUploading(true);
    try {
      const res = await agentApi.resetAvatar(agentId);
      setAgent((prev) => (prev ? { ...prev, avatar_url: res.avatar_url } : prev));
      notify.success("已恢复默认头像");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "重置失败");
    } finally {
      setUploading(false);
    }
  }

  async function resetBackground() {
    if (!agentId) return;
    setUploading(true);
    try {
      const res = await agentApi.resetBackground(agentId);
      setAgent((prev) => (prev ? { ...prev, background_url: res.background_url } : prev));
      notify.success("已恢复默认背景图");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "重置失败");
    } finally {
      setUploading(false);
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
      notify.success(kind === "avatar" ? "头像已更新" : "背景图已更新");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "上传失败");
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
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-[#f3f5f7]">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--rule)] pb-6">
          <div>
            <p className="meta-label mb-2">AGENT CONTROL PLANE / {agentId.slice(0, 8)}</p>
            <h1 className="page-title">配置 Agent — {agent.name}</h1>
          </div>
          <Link href={`/agents/${agentId}`} className="btn-default">
            ← 返回
          </Link>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6 rounded-lg border border-[var(--rule)] bg-white p-6">
          {/* 头像 & 背景图 */}
          <div className="space-y-4">
            {/* 背景图预览 + 上传 */}
            <div>
              <label className="block text-sm font-medium text-[var(--title)] mb-2">背景图</label>
              <div className="relative h-32 overflow-hidden rounded-md border border-[var(--divider)] bg-[var(--primary-soft)]">
                {agent.background_url ? (
                  <Image src={agent.background_url} alt="" fill unoptimized className="object-cover" />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className={`inline-block btn-default btn-sm cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
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
                {agent.background_url && (
                  <button
                    type="button"
                    onClick={() => void resetBackground()}
                    disabled={uploading}
                    className="btn-outline btn-sm disabled:opacity-50"
                  >
                    恢复默认
                  </button>
                )}
              </div>
            </div>

            {/* 头像预览 + 上传 */}
            <div className="flex items-center gap-4">
              <WireframeAvatar
                name={agent.name}
                avatarUrl={agent.avatar_url}
                entityId={agent.id}
                kind="agent"
                size={64}
              />
              <label className={`btn-default btn-sm cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
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
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={uploading}
                onClick={() => void resetAvatar()}
              >
                恢复默认
              </button>
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
              className="w-full resize-y rounded-md border border-[var(--divider)] bg-white px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs leading-6 text-[var(--text-secondary)] outline-none focus:border-[var(--ink)]"
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
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--divider)] text-[var(--text-secondary)] hover:border-[var(--ink)]"
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

          {/* 权限设置 */}
          <div>
            <h3 className="text-sm font-medium text-[var(--title)] mb-3">隐私与权限</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between rounded-lg border border-[var(--divider)] p-3.5 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-[var(--title)]">公开可见</div>
                  <div className="text-xs text-[var(--text-muted)]">关闭后，该 Agent 不出现在市场列表中</div>
                </div>
                <input
                  type="checkbox"
                  checked={visibility === "public"}
                  onChange={(e) => setVisibility(e.target.checked ? "public" : "private")}
                  className="h-5 w-5 accent-[var(--primary)]"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-[var(--divider)] p-3.5 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-[var(--title)]">允许他人关注</div>
                  <div className="text-xs text-[var(--text-muted)]">关闭后，他人主页不显示关注按钮</div>
                </div>
                <input
                  type="checkbox"
                  checked={allowFollow}
                  onChange={(e) => setAllowFollow(e.target.checked)}
                  className="h-5 w-5 accent-[var(--primary)]"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-[var(--divider)] p-3.5 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-[var(--title)]">允许他人发起对话</div>
                  <div className="text-xs text-[var(--text-muted)]">关闭后，他人无法与你的 Agent 对话或下发任务</div>
                </div>
                <input
                  type="checkbox"
                  checked={allowChat}
                  onChange={(e) => setAllowChat(e.target.checked)}
                  className="h-5 w-5 accent-[var(--primary)]"
                />
              </label>
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
              className="btn-default px-5 py-2"
            >
              取消
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存配置"}
            </button>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-[var(--rule)] bg-white p-6">
            <p className="meta-label mb-4">CREDENTIALS / MCP</p>
            <AgentApiKeyPanel agentId={agentId} agentName={agent.name} />
          </div>

          <div className="rounded-lg bg-[#101112] p-6 text-white">
            <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#7AF0A0]">A2A ENDPOINT / LIVE</p>
            <h3 className="mb-2 text-sm font-semibold">Agent-to-Agent 协议</h3>
            <p className="mb-3 text-xs leading-5 text-white/50">
              此 Agent 可被其他 Agent 发现、委派与调用：
            </p>
            <code className="block break-all rounded-md border border-white/10 bg-black/35 p-3 font-[family-name:var(--font-mono)] text-[10px] leading-5 text-[#66A8FF]">
              POST {typeof window !== "undefined" ? window.location.origin : ""}/api/../a2a/agents/{agentId}
            </code>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] leading-5 text-white/45">
              GET /a2a/agents/{agentId}/.well-known/agent.json
            </p>
          </div>
        </aside>
        </div>
      </div>
    </div>
  );
}
