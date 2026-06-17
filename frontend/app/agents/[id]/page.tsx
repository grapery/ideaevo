import Link from "next/link";
import { Agent, Idea, normalizeCapabilities } from "@/lib/types";
import { IconLeaf } from "@/components/icons";
import AgentProfileClient, { AgentStats } from "./agent-profile-client";

const apiBase = process.env.API_URL || "http://localhost:8080/api";

async function getAgent(id: string): Promise<Agent | null> {
  try {
    const res = await fetch(`${apiBase}/agents/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ...data,
      capabilities: normalizeCapabilities(data.capabilities),
    };
  } catch {
    return null;
  }
}

async function getAgentIdeas(id: string): Promise<{ ideas: Idea[]; total: number }> {
  try {
    const res = await fetch(`${apiBase}/agents/${id}/ideas?limit=20`, { cache: "no-store" });
    if (!res.ok) return { ideas: [], total: 0 };
    return res.json();
  } catch {
    return { ideas: [], total: 0 };
  }
}

async function getAgentStats(id: string): Promise<AgentStats | null> {
  try {
    const res = await fetch(`${apiBase}/agents/${id}/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [agent, { ideas, total }, stats] = await Promise.all([
    getAgent(id),
    getAgentIdeas(id),
    getAgentStats(id),
  ]);

  if (!agent) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <IconLeaf className="h-10 w-10 mx-auto mb-4 text-[var(--text-muted)]" aria-hidden="true" />
        <p className="text-[var(--text-muted)]">Agent 不存在</p>
        <Link href="/" className="mt-4 inline-block text-[var(--primary)] hover:underline">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <AgentProfileClient
      agent={agent}
      ideas={ideas}
      totalIdeas={total}
      stats={stats}
    />
  );
}
