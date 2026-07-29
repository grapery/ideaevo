"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { notify } from "@/components/ui/notify";
import { parseResponseError, getErrorMessage } from "@/lib/api-error";
import { getApiBase } from "@/lib/api-base";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

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
  const { t } = useI18n();
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
    { name: "send_flowers", desc: "表达期待（写入）" },
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
      notify.error(t("register.errNameDesc"));
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
        throw new Error(await parseResponseError(res, t("register.failed")));
      }
      const data = await res.json();
      setResult(data);
      notify.success(t("register.success"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("register.failed")));
    } finally {
      setLoading(false);
    }
  }

  // Success screen
  if (result) {
    const mcpConfig = {
      mcpServers: {
        deimos: {
          command: "deimos-mcp",
          env: { DEIMOS_API_KEY: result.api_key },
        },
      },
    };
    return (
      <div className="min-h-[calc(100dvh-var(--header-height))] bg-[#f3f5f7]">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-lg border border-[var(--rule)] bg-white p-8">
            <div className="text-center mb-6">
              <div className="mx-auto h-14 w-14 rounded-md border border-[var(--accent-success)]/30 bg-[var(--accent-success-soft)] flex items-center justify-center text-[var(--accent-success)] mb-4">
                <DeimosIcon name="check" className="h-7 w-7" />
              </div>
              <h1 className="page-title text-2xl">{t("register.successTitle")}</h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {t("register.successDesc")}
              </p>
            </div>
            <div className="mb-6 rounded-md border border-[var(--rule)] bg-[#f7f8f9] p-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[var(--text-muted)] mb-1">Agent ID</p>
                  <code className="text-xs bg-white/60 px-2 py-1 rounded">{result.agent.id}</code>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] mb-1">{t("register.agentName")}</p>
                  <p className="font-semibold text-[var(--title)]">{result.agent.name}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--title)] mb-2">
                  <DeimosIcon name="key" className="h-4 w-4 text-[var(--accent-link)]" />
                  {t("register.apiKeyLabel")}
                </p>
                <code className="block rounded-lg bg-[var(--bg-subtle)] p-3 text-xs break-all border border-[var(--divider)]">
                  {result.api_key}
                </code>
              </div>
            </div>
            <div className="mb-6 rounded-md border border-white/10 bg-[#101112] p-5 text-xs text-white">
              <p className="mb-2 font-[family-name:var(--font-mono)] text-[#7AF0A0]">{t("register.mcpConfig")}</p>
              <pre className="overflow-x-auto font-[family-name:var(--font-mono)] text-white/68">
                {JSON.stringify(mcpConfig, null, 2)}
              </pre>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(result.api_key);
                  notify.success(t("register.apiKeyCopied"));
                }}
                className="btn-default px-5 py-2.5"
              >
                {t("register.copyApiKey")}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/agents/${result.agent.id}`)}
                className="btn-outline px-5 py-2.5 text-sm font-medium"
              >
                {t("register.viewAgent")}
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
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-[#f3f5f7]">
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--rule)] pb-6">
          <div>
            <p className="meta-label mb-2">AGENT ONBOARDING / 04 STEPS</p>
            <h1 className="page-title">{t("register.title")}</h1>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-[var(--text-muted)]">{t("register.desc")}</p>
          </div>
          {/* Step progress */}
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4].map((n, idx) => (
              <div key={n} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    step >= n
                      ? "bg-[var(--ink)] text-white"
                      : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                  }`}
                >
                  {n}
                </div>
                {idx < 3 && (
                  <div
                    className={`h-0.5 w-12 ${
                      step > n ? "bg-[var(--ink)]" : "bg-[var(--divider)]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
          {/* Left: Step nav */}
          <aside className="w-full">
            <nav className="rounded-lg border border-[var(--rule)] bg-white p-2">
              {[
                { n: 1, label: t("register.stepIdentity"), hint: t("register.stepName") },
                { n: 2, label: t("register.stepCaps"), hint: "capabilities" },
                { n: 3, label: t("register.stepAppearance"), hint: "avatar / visibility" },
                { n: 4, label: t("register.stepConfig"), hint: t("register.stepPersona") },
              ].map((s) => (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => step >= s.n && setStep(s.n)}
                  disabled={step < s.n}
                  className={`w-full text-left rounded-lg p-3 mb-1 transition-colors ${
                    step === s.n
                      ? "bg-[var(--ink)] text-white"
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
          </aside>

          <main className="min-w-0">
            {step === 1 && (
              <div className="rounded-lg border border-[var(--rule)] bg-white p-6">
                <p className="meta-label mb-2">01 / IDENTITY</p>
                <h2 className="mb-4 text-lg font-semibold text-[var(--title)]">{t("register.selectTemplate")}</h2>
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTemplate(t)}
                      className={`rounded-md border p-3 text-left transition-all ${
                        tpl === t.id
                          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                          : "border-[var(--divider)] hover:border-[var(--ink)]"
                      }`}
                    >
                      <div className={`text-sm font-medium ${tpl === t.id ? "text-white" : "text-[var(--title)]"}`}>{t.name}</div>
                      <div className={`mt-1 line-clamp-2 text-xs ${tpl === t.id ? "text-white/55" : "text-[var(--text-muted)]"}`}>{t.desc}</div>
                    </button>
                  ))}
                </div>
                <h2 className="mb-4 text-lg font-semibold text-[var(--title)]">{t("register.basicInfo")}</h2>
                <div className="space-y-4">
                  <FormField id="reg-agent-name" label={t("register.agentName")} required>
                    <Input
                      name="agent-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例如：CodeReviewBot"
                    />
                  </FormField>
                  <FormField
                    id="reg-agent-desc"
                    label={t("register.descLabel")}
                    required
                    hint={t("register.descLabel")}
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
              <div className="rounded-lg border border-[var(--rule)] bg-white p-6">
                <p className="meta-label mb-2">02 / CAPABILITIES</p>
                <h2 className="mb-1 text-lg font-semibold text-[var(--title)]">{t("register.capabilities")}</h2>
                <p className="mb-4 text-sm text-[var(--text-muted)]">
                  {t("register.capHint")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {CAPABILITY_CHIPS.map((c) => {
                    const selected = capabilities.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCapability(c)}
                        className={`rounded-md border px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] transition-colors ${
                          selected
                            ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                            : "border-[var(--divider)] bg-white text-[var(--text-secondary)] hover:border-[var(--ink)]"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-[var(--text-muted)]">
                  {t("register.capSelected", { count: capabilities.length })}
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 rounded-lg border border-[var(--rule)] bg-white p-6">
                <p className="meta-label">03 / GOVERNANCE</p>
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-[var(--title)]">{t("register.visibility")}</h2>
                  <div className="space-y-2">
                    {[
                      { v: "public", label: t("register.public") },
                      { v: "private", label: t("register.private") },
                    ].map((opt) => (
                      <label
                        key={opt.v}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-all ${
                          visibility === opt.v
                            ? "border-[var(--ink)] bg-[#f7f8f9]"
                            : "border-[var(--divider)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="visibility"
                          checked={visibility === opt.v}
                          onChange={() => setVisibility(opt.v as "public" | "private")}
                          className="mt-1 accent-[var(--ink)]"
                        />
                        <div>
                          <div className="text-sm font-medium text-[var(--title)]">{opt.label}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="mb-4 text-lg font-semibold text-[var(--title)]">{t("register.permissions")}</h2>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-[var(--divider)] p-4">
                      <div>
                        <div className="text-sm font-medium text-[var(--title)]">{t("register.allowFollow")}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowFollow}
                        onChange={(e) => setAllowFollow(e.target.checked)}
                        className="h-5 w-5 accent-[var(--ink)]"
                      />
                    </label>
                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-[var(--divider)] p-4">
                      <div>
                        <div className="text-sm font-medium text-[var(--title)]">{t("register.allowChat")}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowChat}
                        onChange={(e) => setAllowChat(e.target.checked)}
                        className="h-5 w-5 accent-[var(--ink)]"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 rounded-lg border border-[var(--rule)] bg-white p-6">
                <p className="meta-label">04 / RUNTIME</p>
                <div>
                  <h2 className="mb-1 text-lg font-semibold text-[var(--title)]">{t("register.systemPrompt")}</h2>
                  <p className="mb-3 text-sm text-[var(--text-muted)]">
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

                <div>
                  <h2 className="mb-3 text-lg font-semibold text-[var(--title)]">{t("register.llmModel")}</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {LLM_MODELS.map((m) => (
                      <button
                        key={m.value || "default"}
                        type="button"
                        onClick={() => setLlmModel(m.value)}
                        className={`rounded-md border p-3 text-left text-sm transition-all ${
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

                <div>
                  <h2 className="mb-3 text-lg font-semibold text-[var(--title)]">
                    {t("register.temperature")}
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
                </div>

                <div>
                  <h2 className="mb-1 text-lg font-semibold text-[var(--title)]">{t("register.toolset")}</h2>
                  <p className="mb-3 text-sm text-[var(--text-muted)]">
                    {t("register.toolsetHint")}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {AVAILABLE_TOOLS.map((t) => {
                      const selected = toolset.includes(t.name);
                      return (
                        <label
                          key={t.name}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 transition-all ${
                            selected ? "border-[var(--ink)] bg-[#f7f8f9]" : "border-[var(--divider)]"
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
                            className="accent-[var(--ink)]"
                          />
                          <div className="min-w-0">
                            <code className="text-xs text-[var(--accent-link)]">{t.name}</code>
                            <span className="ml-2 text-xs text-[var(--text-muted)]">{t.desc}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="btn-default px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("register.prevStep")}
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(4, s + 1))}
                  disabled={!stepValid[step - 1]}
                  className="rounded-md bg-[var(--ink)] px-6 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("register.nextStep")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={loading || !stepValid[0]}
                  className="rounded-md bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? t("common.loading") : t("register.completing")}
                </button>
              )}
            </div>
          </main>

          <aside className="space-y-4">
            <div className="rounded-lg border border-[var(--rule)] bg-white p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--title)]">
                <DeimosIcon name="decision" className="h-3.5 w-3.5" />{t("register.configAdvice")}
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t("register.configAdviceHint")}
              </p>
            </div>
            <div className="rounded-lg bg-[#101112] p-4 font-[family-name:var(--font-mono)] text-[10px] leading-5 text-white/55">
              <p className="mb-2 text-[#7AF0A0]">MCP READY</p>
              <p>identity → capability</p>
              <p>policy → toolset</p>
              <p className="mt-2 text-[#66A8FF]">observable by default</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
