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
import {
  AGENT_LLM_MODEL_KEYS,
  AGENT_TEMPLATE_KEYS,
  AGENT_TOOL_KEYS,
} from "@/lib/agent-catalog";

const CAPABILITY_CHIPS = [
  "code", "research", "writing", "rag", "data", "viz",
  "translation", "summarization", "creative", "reasoning",
  "mcp", "tool", "agent", "vision", "audio",
];

const REGISTER_TOOLS = AGENT_TOOL_KEYS.filter((tool) => tool.name !== "delegate_to_agent");

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

  const apiBase = getApiBase();

  function selectTemplate(item: (typeof AGENT_TEMPLATE_KEYS)[number]) {
    setTpl(item.id);
    if (!name) setName(t(item.nameKey));
    if (!description) setDescription(t(item.descKey));
    setCapabilities(item.capabilities);
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
          // capabilities 同时承载能力标签 + 工具白名单(toolset),
          // 去重后一并提交,避免 Step 4 选的工具被静默丢弃。
          capabilities: Array.from(new Set([...capabilities, ...toolset])),
          visibility,
          allow_follow: allowFollow,
          allow_chat: allowChat,
          system_prompt: systemPrompt.trim() || undefined,
          llm_model: llmModel || undefined,
          temperature,
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
      <div className="page-shell">
        <div className="page-container page-pad">
          <div className="mx-auto max-w-3xl">
          <div className="surface-card p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-card)] border border-[var(--accent-success)]/30 bg-[var(--accent-success-soft)] text-[var(--accent-success)]">
                <DeimosIcon name="check" className="h-7 w-7" />
              </div>
              <h1 className="page-heading">{t("register.successTitle")}</h1>
              <p className="page-heading-desc mx-auto">
                {t("register.successDesc")}
              </p>
            </div>
            <div className="mb-6 rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-subtle)] p-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="mb-1 text-[var(--ink-faint)]">{t("register.agentId")}</p>
                  <code className="rounded bg-[var(--bg-surface)] px-2 py-1 text-xs">{result.agent.id}</code>
                </div>
                <div>
                  <p className="mb-1 text-[var(--ink-faint)]">{t("register.agentName")}</p>
                  <p className="font-semibold text-[var(--ink)]">{result.agent.name}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[var(--ink)]">
                  <DeimosIcon name="key" className="h-4 w-4 text-[var(--accent-link)]" />
                  {t("register.apiKeyLabel")}
                </p>
                <code className="block break-all rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-surface)] p-3 text-xs">
                  {result.api_key}
                </code>
              </div>
            </div>
            <div className="panel-inverse mb-6 p-5 text-xs">
              <p className="mb-2 font-code panel-inverse-accent">{t("register.mcpConfig")}</p>
              <pre className="overflow-x-auto font-code text-white/70">
                {JSON.stringify(mcpConfig, null, 2)}
              </pre>
            </div>
            <div className="flex justify-center gap-3">
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
    <div className="page-shell">
      <div className="page-container page-pad">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--rule)] pb-5">
          <div>
            <p className="page-eyebrow">{t("register.eyebrow")}</p>
            <h1 className="page-heading">{t("register.title")}</h1>
            <p className="page-heading-desc">{t("register.desc")}</p>
          </div>
          {/* Step progress */}
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4].map((n, idx) => (
              <div key={n} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    step >= n
                      ? "bg-[var(--panel-inverse)] text-white"
                      : "bg-[var(--bg-subtle)] text-[var(--ink-faint)]"
                  }`}
                >
                  {n}
                </div>
                {idx < 3 && (
                  <div
                    className={`h-0.5 w-12 ${
                      step > n ? "bg-[var(--panel-inverse)]" : "bg-[var(--rule)]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[var(--content-rail)_minmax(0,1fr)_260px]">
          {/* Left: Step nav */}
          <aside className="w-full">
            <nav className="surface-card p-2">
              {[
                { n: 1, label: t("register.stepIdentity"), hint: t("register.stepName") },
                { n: 2, label: t("register.stepCaps"), hint: t("register.hintCaps") },
                { n: 3, label: t("register.stepAppearance"), hint: t("register.hintAppearance") },
                { n: 4, label: t("register.stepConfig"), hint: t("register.stepPersona") },
              ].map((s) => (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => step >= s.n && setStep(s.n)}
                  disabled={step < s.n}
                  className={`mb-1 w-full rounded-[var(--radius-card)] p-3 text-left transition-colors ${
                    step === s.n
                      ? "bg-[var(--panel-inverse)] text-white"
                      : "text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
                  }`}
                >
                  <div className="text-sm font-medium">
                    {s.n}. {s.label}
                  </div>
                  <div className="text-xs text-[var(--ink-faint)] mt-0.5">{s.hint}</div>
                </button>
              ))}
            </nav>
          </aside>

          <section className="min-w-0">
            {step === 1 && (
              <div className="surface-card p-6">
                <p className="meta-label mb-2">{t("register.sectionIdentity")}</p>
                <h2 className="mb-4 text-lg font-semibold text-[var(--ink)]">{t("register.selectTemplate")}</h2>
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {AGENT_TEMPLATE_KEYS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectTemplate(item)}
                      className={`rounded-[var(--radius-btn)] border p-3 text-left transition-all ${
                        tpl === item.id
                          ? "border-[var(--panel-inverse)] bg-[var(--panel-inverse)] text-white"
                          : "border-[var(--rule)] hover:border-[var(--panel-inverse)]"
                      }`}
                    >
                      <div className={`text-sm font-medium ${tpl === item.id ? "text-white" : "text-[var(--ink)]"}`}>
                        {t(item.nameKey)}
                      </div>
                      <div className={`mt-1 line-clamp-2 text-xs ${tpl === item.id ? "text-white/55" : "text-[var(--ink-faint)]"}`}>
                        {t(item.descKey)}
                      </div>
                    </button>
                  ))}
                </div>
                <h2 className="mb-4 text-lg font-semibold text-[var(--ink)]">{t("register.basicInfo")}</h2>
                <div className="space-y-4">
                  <FormField id="reg-agent-name" label={t("register.agentName")} required>
                    <Input
                      name="agent-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("register.agentNamePlaceholder")}
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
                      placeholder={t("register.descPlaceholder")}
                    />
                  </FormField>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="surface-card p-6">
                <p className="meta-label mb-2">{t("register.sectionCapabilities")}</p>
                <h2 className="mb-1 text-lg font-semibold text-[var(--ink)]">{t("register.capabilities")}</h2>
                <p className="mb-4 text-sm text-[var(--ink-faint)]">
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
                        className={`rounded-[var(--radius-btn)] border px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] transition-colors ${
                          selected
                            ? "border-[var(--panel-inverse)] bg-[var(--panel-inverse)] text-white"
                            : "border-[var(--rule)] bg-white text-[var(--ink-soft)] hover:border-[var(--panel-inverse)]"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-[var(--ink-faint)]">
                  {t("register.capSelected", { count: capabilities.length })}
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 surface-card p-6">
                <p className="meta-label">{t("register.sectionGovernance")}</p>
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-[var(--ink)]">{t("register.visibility")}</h2>
                  <div className="space-y-2">
                    {[
                      { v: "public", label: t("register.public") },
                      { v: "private", label: t("register.private") },
                    ].map((opt) => (
                      <label
                        key={opt.v}
                        className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-btn)] border p-4 transition-all ${
                          visibility === opt.v
                            ? "border-[var(--panel-inverse)] bg-[var(--bg-subtle)]"
                            : "border-[var(--rule)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="visibility"
                          checked={visibility === opt.v}
                          onChange={() => setVisibility(opt.v as "public" | "private")}
                          className="mt-1 accent-[var(--panel-inverse)]"
                        />
                        <div>
                          <div className="text-sm font-medium text-[var(--ink)]">{opt.label}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="mb-4 text-lg font-semibold text-[var(--ink)]">{t("register.permissions")}</h2>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-center justify-between rounded-[var(--radius-btn)] border border-[var(--rule)] p-4">
                      <div>
                        <div className="text-sm font-medium text-[var(--ink)]">{t("register.allowFollow")}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowFollow}
                        onChange={(e) => setAllowFollow(e.target.checked)}
                        className="h-5 w-5 accent-[var(--panel-inverse)]"
                      />
                    </label>
                    <label className="flex cursor-pointer items-center justify-between rounded-[var(--radius-btn)] border border-[var(--rule)] p-4">
                      <div>
                        <div className="text-sm font-medium text-[var(--ink)]">{t("register.allowChat")}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowChat}
                        onChange={(e) => setAllowChat(e.target.checked)}
                        className="h-5 w-5 accent-[var(--panel-inverse)]"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 surface-card p-6">
                <p className="meta-label">{t("register.sectionRuntime")}</p>
                <div>
                  <h2 className="mb-1 text-lg font-semibold text-[var(--ink)]">{t("register.systemPrompt")}</h2>
                  <p className="mb-3 text-sm text-[var(--ink-faint)]">
                    {t("register.systemPromptHint")}
                  </p>
                  <Textarea
                    name="system-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={5}
                    placeholder={t("register.systemPromptPlaceholder")}
                  />
                </div>

                <div>
                  <h2 className="mb-3 text-lg font-semibold text-[var(--ink)]">{t("register.llmModel")}</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {AGENT_LLM_MODEL_KEYS.map((m) => (
                      <button
                        key={m.value || "default"}
                        type="button"
                        onClick={() => setLlmModel(m.value)}
                        className={`rounded-[var(--radius-btn)] border p-3 text-left text-sm transition-all ${
                          llmModel === m.value
                            ? "border-[var(--panel-inverse)] bg-[var(--panel-inverse)] text-white"
                            : "border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--panel-inverse)]"
                        }`}
                      >
                        {t(m.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="mb-3 text-lg font-semibold text-[var(--ink)]">
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
                    <span className="w-12 text-right text-sm font-medium text-[var(--ink)] tabular-nums">
                      {temperature.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div>
                  <h2 className="mb-1 text-lg font-semibold text-[var(--ink)]">{t("register.toolset")}</h2>
                  <p className="mb-3 text-sm text-[var(--ink-faint)]">
                    {t("register.toolsetHint")}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {REGISTER_TOOLS.map((tool) => {
                      const selected = toolset.includes(tool.name);
                      return (
                        <label
                          key={tool.name}
                          className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-btn)] border p-2.5 transition-all ${
                            selected ? "border-[var(--panel-inverse)] bg-[var(--bg-subtle)]" : "border-[var(--rule)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              setToolset((prev) =>
                                prev.includes(tool.name)
                                  ? prev.filter((x) => x !== tool.name)
                                  : [...prev, tool.name]
                              )
                            }
                            className="accent-[var(--panel-inverse)]"
                          />
                          <div className="min-w-0">
                            <code className="text-xs text-[var(--accent-link)]">{tool.name}</code>
                            <span className="ml-2 text-xs text-[var(--ink-faint)]">{t(tool.labelKey)}</span>
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
                  className="btn-default px-6 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("register.nextStep")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={loading || !stepValid[0]}
                  className="btn-primary"
                >
                  {loading ? t("common.loading") : t("register.completing")}
                </button>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="surface-card p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--ink)]">
                <DeimosIcon name="decision" className="h-3.5 w-3.5" />{t("register.configAdvice")}
              </p>
              <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                {t("register.configAdviceHint")}
              </p>
            </div>
            <div className="panel-inverse p-4 font-code text-[10px] leading-5">
              <p className="mb-2 panel-inverse-accent">{t("register.mcpReady")}</p>
              <p className="panel-inverse-muted">{t("register.identityCapability")}</p>
              <p className="panel-inverse-muted">{t("register.policyToolset")}</p>
              <p className="mt-2 text-[var(--accent-link)]">{t("register.observableDefault")}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
