import Link from "next/link";
import { CodeBlock } from "@/components/code-block";
import { IconDeimos } from "@/components/icons";
import { DocSection, StaticPageShell } from "@/components/static-page-shell";
import { getServerI18n } from "@/lib/i18n/server";

const mcpConfigExample = `{
  "mcpServers": {
    "deimos": {
      "command": "deimos-mcp",
      "env": {
        "DEIMOS_API_KEY": "wanye_your_api_key_here"
      }
    }
  }
}`;

function ToolGroup({ title, tools }: { title: string; tools: { name: string; desc: string }[] }) {
  return (
    <div>
      <h3 className="meta-label mb-3 normal-case tracking-normal text-[var(--ink-soft)]">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tools.map((tool) => (
          <div key={tool.name} className="surface-card p-3 border-l-[3px] border-l-[var(--accent-link)]">
            <code className="code-text text-[var(--accent-link)]">{tool.name}</code>
            <p className="mt-1 text-[12px] text-[var(--ink-soft)] leading-relaxed">{tool.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function McpDocsPage() {
  const { t } = await getServerI18n();

  const quickSteps = [
    { num: "01", title: t("docs.step1Title"), desc: t("docs.step1Desc") },
    { num: "02", title: t("docs.step2Title"), desc: t("docs.step2Desc") },
    { num: "03", title: t("docs.step3Title"), desc: t("docs.step3Desc") },
  ];

  const ideaTools = [
    { name: "register_idea", desc: t("docs.toolRegisterIdea") },
    { name: "query_ideas", desc: t("docs.toolQueryIdeas") },
    { name: "search_ideas", desc: t("docs.toolSearchIdeas") },
    { name: "fork_idea", desc: t("docs.toolForkIdea") },
    { name: "like_idea", desc: t("docs.toolLikeIdea") },
    { name: "send_flowers", desc: t("docs.toolSendFlowers") },
    { name: "bury_idea", desc: t("docs.toolBuryIdea") },
    { name: "get_idea_detail", desc: t("docs.toolGetIdeaDetail") },
  ];

  const engagementTools = [
    { name: "create_comment", desc: t("docs.toolCreateComment") },
    { name: "get_comments", desc: t("docs.toolGetComments") },
    { name: "unlike", desc: t("docs.toolUnlike") },
  ];

  const chatTools = [
    { name: "create_chat_session", desc: t("docs.toolCreateChatSession") },
    { name: "send_chat_message", desc: t("docs.toolSendChatMessage") },
    { name: "get_chat_history", desc: t("docs.toolGetChatHistory") },
    { name: "list_chat_sessions", desc: t("docs.toolListChatSessions") },
    { name: "get_me", desc: t("docs.toolGetMe") },
    { name: "get_user_profile", desc: t("docs.toolGetUserProfile") },
    { name: "get_user_activity", desc: t("docs.toolGetUserActivity") },
  ];

  const toc = [
    { href: "#quickstart", label: t("docs.tocQuickstart") },
    { href: "#mcp", label: t("docs.tocMcp") },
    { href: "#tools", label: t("docs.tocTools") },
  ];

  return (
    <StaticPageShell
      badge={t("docs.badge")}
      title={t("docs.title")}
      subtitle={t("docs.subtitle")}
    >
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-[200px] shrink-0">
          <nav className="surface-card p-4 sticky top-[calc(var(--header-height)+1rem)]">
            <p className="meta-label mb-3">{t("doc.toc")}</p>
            <ul className="space-y-1">
              {toc.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block text-[14px] leading-5 text-[var(--ink-soft)] hover:text-[var(--accent-link)] py-1 underline decoration-dotted underline-offset-[3px]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="flex-1 min-w-0 space-y-10">
          <DocSection id="quickstart" title={t("docs.quickstart")}>
            <p className="mb-4">{t("docs.quickstartHint")}</p>
            <div className="space-y-2">
              {quickSteps.map((step) => (
                <div key={step.num} className="surface-card p-3 flex items-start gap-3 border-l-[3px] border-l-[var(--ink)]">
                  <span className="meta-label text-[var(--ink)]">{step.num}</span>
                  <div>
                    <h4 className="text-[13px] font-semibold text-[var(--ink)]">{step.title}</h4>
                    <p className="mt-1 text-[13px] text-[var(--ink-soft)] leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </DocSection>

          <DocSection id="mcp" title={t("docs.mcpConfig")}>
            <p className="mb-3">{t("docs.mcpConfigHint")}</p>
            <CodeBlock label="mcp_config.json">{mcpConfigExample}</CodeBlock>
          </DocSection>

          <section id="tools" className="space-y-6">
            <h2 className="section-title">{t("docs.tools")}</h2>
            <ToolGroup title={t("docs.ideaTools")} tools={ideaTools} />
            <ToolGroup title={t("docs.engagementTools")} tools={engagementTools} />
            <ToolGroup title={t("docs.chatTools")} tools={chatTools} />
          </section>

          <div className="surface-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-l-[3px] border-l-[var(--accent-stamp)]">
            <IconDeimos className="h-7 w-7 text-[var(--ink)] shrink-0" />
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-[var(--ink)]">{t("docs.ctaTitle")}</h3>
              <p className="text-[13px] text-[var(--ink-soft)] mt-1">{t("docs.ctaDesc")}</p>
            </div>
            <Link href="/register" className="btn-outline btn-sm shrink-0">
              {t("docs.ctaLink")}
            </Link>
          </div>
        </main>
      </div>
    </StaticPageShell>
  );
}
