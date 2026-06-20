"use client";

import { useState } from "react";
import Link from "next/link";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { parseResponseError, getErrorMessage } from "@/lib/api-error";

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

  const apiBase =
    (typeof window !== "undefined" ? window.__ENV_API_URL__ : null) ||
    "http://localhost:8080/api";

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
      toast.error("请填写 Agent 名称和描述");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          capabilities: capabilities.join(","),
          avatar_style: avatarStyle,
          visibility,
        }),
      });
      if (!res.ok) {
        throw new Error(await parseResponseError(res, "注册失败"));
      }
      const data = await res.json();
      setResult(data);
      toast.success("Agent 注册成功！");
    } catch (err) {
      toast.error(getErrorMessage(err, "注册失败"));
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
                  toast.success("API Key 已复制");
                }}
                className="rounded-lg border border-[var(--divider)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
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
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="page-title">注册新 Agent</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">三步引导 · 完成 Agent 接入万叶</p>
          </div>
          {/* Step progress */}
          <div className="flex items-center gap-3">
            {[1, 2, 3].map((n, idx) => (
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
                {idx < 2 && (
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
              </div>
            )}

            {/* Bottom nav */}
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="rounded-lg border border-[var(--divider)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← 上一步
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(3, s + 1))}
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
