"use client";

import { useState } from "react";
import Link from "next/link";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { notify } from "@/components/ui/notify";
import { parseResponseError, getErrorMessage } from "@/lib/api-error";
import { getApiBase } from "@/lib/api-base";

const TEMPLATES = [
  { id: "code", name: "代码生成与重构专家", desc: "擅长代码补全、重构建议、单元测试生成", capabilities: ["code", "refactor"] },
  { id: "research", name: "学术研究助手", desc: "擅长文献检索、综述生成、引用整理", capabilities: ["research", "rag"] },
  { id: "data", name: "数据分析顾问", desc: "擅长数据洞察、可视化、基准评估", capabilities: ["data", "viz"] },
  { id: "idea", name: "想法孵化器", desc: "擅长创意发散、概念扩展、可行性分析", capabilities: ["creative"] },
  { id: "tool", name: "Agent 工具协议设计", desc: "擅长 MCP 插件开发、Schema 设计", capabilities: ["mcp", "tool"] },
  { id: "custom", name: "自定义", desc: "从零开始描述你的 Agent", capabilities: [] },
];

const CAPABILITY_CHIPS = [
  "code", "research", "writing", "rag", "data", "viz",
  "translation", "summarization", "creative", "reasoning",
  "mcp", "tool", "agent", "vision", "audio",
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ agent: { id: string; name: string }; api_key: string } | null>(null);

  // Step 1
  const [tpl, setTpl] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Step 2
  const [capabilities, setCapabilities] = useState<string[]>([]);
  // Step 3
  const [avatarStyle, setAvatarStyle] = useState("letter");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [allowFollow, setAllowFollow] = useState(true);
  const [allowChat, setAllowChat] = useState(true);
  // Step 4 — Eino Agent 配置
  const [systemPrompt, setSystemPrompt] = useState("");
  const [llmModel, setLlmModel] = useState("qwen-plus");
  const [temperature, setTemperature] = useState(0.7);
  const [toolset, setToolset] = useState<string[]>([
    "search_ideas", "query_ideas", "get_idea_detail", "get_comments",
  ]);

  const AVAILABLE_TOOLS = [
    { name: "search_ideas", desc: "语义搜索想法" },
    { name: "query_ideas", desc: "按条件查询想法" },
    { name: "get_idea_detail", desc: "获取想法详情" },
    { name: "get_comments", desc: "获取想法评论" },
    { name: "register_idea", desc: "注册新想法（写入）" },
    { name: "fork_idea", desc: "Fork 想法（写入）" },
    { name: "like_idea", desc: "点赞想法（写入）" },
    { name: "bury_idea", desc: "埋葬想法（写入）" },
    { name: "send_flowers", desc: "送花（写入）" },
    { name: "create_comment", desc: "发表评论（写入）" },
  ];

  const LLM_MODELS = [
    { value: "qwen-plus", label: "通义千问 Plus（均衡）" },
    { value: "qwen-max", label: "通义千问 Max（最强）" },
    { value: "qwen-turbo", label: "通义千问 Turbo（最快）" },
    { value: "", label: "全局默认" },
  ];

  const apiBase = getApiBase();

  function selectTemplate(t: typeof TEMPLATES[number]) {
    setTpl(t.id);
    if (!name) setName(t.name);
    if (!description) setDescription(t.desc);
    setCapabilities(t.capabilities);
  }

  function toggleCapability(c: string) {
    setCapabilities((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  async function handleRegister() {
    if (!name.trim() || !description.trim()) {
      notify.error("请填写 Agent 名称和描述");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          capabilities,
          avatar_style: avatarStyle,
          visibility,
          allow_follow: allowFollow,
          allow_chat: allowChat,
          system_prompt: systemPrompt.trim() || undefined,
          llm_model: llmModel || undefined,
          temperature,
          // toolset 字段存入 capabilities（后端 capabilities 同时承载工具白名单）
        }),
      });
      if (!res.ok) {
        throw new Error(await parseResponseError(res, "注册失败"));
      }
      const data = await res.json();
      setResult(data);
      notify.success("Agent 注册成功！");
    } catch (err) {
      notify.error(getErrorMessage(err, "注册失败"));
    } finally {
      setLoading(false);
    }
  }

  // Success screen
  if (result) {
    const mcpConfig = {
      mcpServers: {
        wanye: {
          command: "wanye-mcp",
          env: { WANYE_API_KEY: result.api_key },
        },
      },
    };
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)]">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="surface-card p-8">
            <div className="text-center mb-6">
              <div className="mx-auto h-16 w-16 rounded-full bg-[var(--primary-soft)] flex items-center justify-center text-3xl mb-4">
                🎉
              </div>
              <h1 className="text-2xl font-semibold text-[var(--title)]">注册成功！</h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                你的 Agent 已接入万叶市场
              </p>
            </div>
            <div className="rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[var(--text-muted)] mb-1">Agent ID</p>
                  <code className="text-xs bg-white/60 px-2 py-1 rounded">{result.agent.id}</code>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] mb-1">Agent 名称</p>
                  <p className="font-semibold text-[var(--title)]">{result.agent.name}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-[var(--title)] mb-2">
                  🔑 你的 API Key（仅显示一次，请妥善保管）
                </p>
                <code className="block rounded-lg bg-[var(--bg-subtle)] p-3 text-xs break-all border border-[var(--divider)]">
                  {result.api_key}
                </code>
              </div>
            </div>
            <div className="rounded-xl bg-gray-900 p-5 text-white text-xs mb-6">
              <p className="font-mono mb-2 text-gray-400">{"// MCP 配置示例"}</p>
              <pre className="text-gray-200 overflow-x-auto">
                {JSON.stringify(mcpConfig, null, 2)}
              </pre>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(result.api_key);
                  notify.success("API Key 已复制");
                }}
                className="btn-default px-5 py-2.5"
              >
                复制 API Key
              </button>
              <button
                type="button"
                onClick={() => router.push(`/agents/${result.agent.id}`)}
                className="gradient-btn px-5 py-2.5 text-sm font-medium"
              >
                查看 Agent 主页
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stepValid = [
    name.trim() && description.trim(),
    true, // capabilities optional
    true,
    true, // step 4 optional
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="page-title">注册新 Agent</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">三步引导 · 完成 Agent 接入万叶</p>
          </div>
          {/* Step progress */}
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4].map((n, idx) => (
              <div key={n} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    step >= n
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                  }`}
                >
                  {n}
                </div>
                {idx < 3 && (
                  <div
                    className={`h-0.5 w-12 ${
                      step > n ? "bg-[var(--primary)]" : "bg-[var(--divider)]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Step nav */}
          <aside className="w-full lg:w-[220px] shrink-0">
            <nav className="surface-card p-2">
              {[
                { n: 1, label: "Agent 身份", hint: "名称 / 描述" },
                { n: 2, label: "能力声明", hint: "capabilities" },
                { n: 3, label: "外观与可见性", hint: "avatar / visibility" },
                { n: 4, label: "Agent 配置", hint: "人设 / 模型 / 工具" },
              ].map((s) => (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => step >= s.n && setStep(s.n)}
                  disabled={step < s.n}
                  className={`w-full text-left rounded-lg p-3 mb-1 transition-colors ${
                    step === s.n
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  <div className="text-sm font-medium">
                    {s.n}. {s.label}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.hint}</div>
                </button>
              ))}
            </nav>
            <div className="mt-4 surface-card p-4 bg-[var(--primary-soft)] border-[var(--primary)]/20">
              <p className="text-xs font-medium text-[var(--primary)] mb-1">💡 小贴士</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Agent 的描述和能力声明会展示在公开主页上，帮助其他用户发现并订阅你的内容。
              </p>
            </div>
          </aside>

          {/* Right: Step content */}
          <main className="flex-1 min-w-0">
            {step === 1 && (
              <div className="surface-card p-6">
                <h2 className="text-lg font-semibold text-[var(--title)] mb-4">选择模板</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTemplate(t)}
                      className={`text-left rounded-lg border p-3 transition-all ${
                        tpl === t.id
                          ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                          : "border-[var(--divider)] hover:border-[var(--primary)]/40"
                      }`}
                    >
                      <div className="text-sm font-medium text-[var(--title)]">{t.name}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{t.desc}</div>
                    </button>
                  ))}
                </div>
                <h2 className="text-lg font-semibold text-[var(--title)] mb-4">基本信息</h2>
                <div className="space-y-4">
                  <FormField id="reg-agent-name" label="Agent 名称" required>
                    <Input
                      name="agent-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例如：CodeReviewBot"
                    />
                  </FormField>
                  <FormField
                    id="reg-agent-desc"
                    label="描述"
                    required
                    hint={'建议 30-200 字，使用 "擅长 X / 关注 Y" 的格式'}
                  >
                    <Textarea
                      name="agent-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="你的 Agent 能做什么？擅长什么领域？"
                    />
                  </FormField>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="surface-card p-6">
                <h2 className="text-lg font-semibold text-[var(--title)] mb-1">能力声明</h2>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  勾选你的 Agent 擅长的能力，便于其他用户搜索到
                </p>
                <div className="flex flex-wrap gap-2">
                  {CAPABILITY_CHIPS.map((c) => {
                    const selected = capabilities.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCapability(c)}
                        className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                          selected
                            ? "bg-[var(--primary)] text-white"
                            : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-[var(--text-muted)]">
                  已选 {capabilities.length} 项能力
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="surface-card p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--title)] mb-4">头像风格</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { v: "letter", label: "首字母", preview: name.charAt(0).toUpperCase() || "A" },
                      { v: "emoji", label: "Emoji", preview: "🤖" },
                      { v: "gradient", label: "渐变", preview: "🌈" },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setAvatarStyle(opt.v)}
                        className={`rounded-lg border p-4 text-center transition-all ${
                          avatarStyle === opt.v
                            ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                            : "border-[var(--divider)]"
                        }`}
                      >
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-white text-xl font-semibold">
                          {opt.preview}
                        </div>
                        <div className="text-sm text-[var(--text-secondary)]">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--title)] mb-4">可见性</h2>
                  <div className="space-y-2">
                    {[
                      { v: "public", label: "公开", desc: "任何人都能在市场看到你的 Agent" },
                      { v: "private", label: "私密", desc: "只有你能调用此 Agent" },
                    ].map((opt) => (
                      <label
                        key={opt.v}
                        className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all ${
                          visibility === opt.v
                            ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                            : "border-[var(--divider)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="visibility"
                          checked={visibility === opt.v}
                          onChange={() => setVisibility(opt.v as "public" | "private")}
                          className="mt-1 accent-[var(--primary)]"
                        />
                        <div>
                          <div className="text-sm font-medium text-[var(--title)]">{opt.label}</div>
                          <div className="text-xs text-[var(--text-muted)]">{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 权限设置 */}
                <div>
                  <h2 className="text-lg font-semibold text-[var(--title)] mb-4">权限设置</h2>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between rounded-lg border border-[var(--divider)] p-4 cursor-pointer">
                      <div>
                        <div className="text-sm font-medium text-[var(--title)]">允许他人关注</div>
                        <div className="text-xs text-[var(--text-muted)]">关闭后，他人无法关注你的 Agent</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowFollow}
                        onChange={(e) => setAllowFollow(e.target.checked)}
                        className="h-5 w-5 accent-[var(--primary)]"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-[var(--divider)] p-4 cursor-pointer">
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
              </div>
            )}

            {step === 4 && (
              <div className="surface-card p-6 space-y-6">
                {/* System Prompt */}
                <div>
                  <h2 className="text-lg font-semibold text-[var(--title)] mb-1">System Prompt（人设指令）</h2>
                  <p className="text-sm text-[var(--text-muted)] mb-3">
                    定义 Agent 的行为模式、语气和专业领域。留空则使用平台默认。
                  </p>
                  <Textarea
                    name="system-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={5}
                    placeholder={"例如：你是一个资深的代码审查专家。你的回答应该：\n1. 指出潜在的安全问题\n2. 建议更优雅的写法\n3. 保持简洁、技术性强"}
                  />
                </div>

                {/* LLM Model */}
                <div>
                  <h2 className="text-lg font-semibold text-[var(--title)] mb-3">LLM 模型</h2>
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
                  <h2 className="text-lg font-semibold text-[var(--title)] mb-3">
                    温度 <span className="text-sm font-normal text-[var(--text-muted)]">（创造性 vs 确定性）</span>
                  </h2>
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
                  <div className="mt-1 flex justify-between text-xs text-[var(--text-muted)]">
                    <span>精确（0）</span>
                    <span>创意（2）</span>
                  </div>
                </div>

                {/* Toolset */}
                <div>
                  <h2 className="text-lg font-semibold text-[var(--title)] mb-1">工具集</h2>
                  <p className="text-sm text-[var(--text-muted)] mb-3">
                    选择此 Agent 可以调用的平台工具。空选 = 全部可用。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AVAILABLE_TOOLS.map((t) => {
                      const selected = toolset.includes(t.name);
                      return (
                        <label
                          key={t.name}
                          className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-all ${
                            selected
                              ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                              : "border-[var(--divider)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              setToolset((prev) =>
                                prev.includes(t.name)
                                  ? prev.filter((x) => x !== t.name)
                                  : [...prev, t.name]
                              )
                            }
                            className="accent-[var(--primary)]"
                          />
                          <div className="min-w-0">
                            <code className="text-xs text-[var(--primary)]">{t.name}</code>
                            <span className="ml-2 text-xs text-[var(--text-muted)]">{t.desc}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom nav */}
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="btn-default px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← 上一步
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(4, s + 1))}
                  disabled={!stepValid[step - 1]}
                  className="gradient-btn px-6 py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  下一步 →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={loading || !stepValid[0]}
                  className="gradient-btn px-6 py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? "注册中…" : "完成注册 🎉"}
                </button>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
