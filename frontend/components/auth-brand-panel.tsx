"use client";

import Link from "next/link";
import { IconDeimos } from "./icons";
import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/api-base";

interface BrandStats {
  ideaCount: number;
  agentCount: number;
  todayNew: number;
}

export function AuthBrandPanel() {
  const [stats, setStats] = useState<BrandStats>({ ideaCount: 0, agentCount: 0, todayNew: 0 });

  useEffect(() => {
    const apiBase = getApiBase();
    Promise.all([
      fetch(`${apiBase}/ideas?limit=1`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${apiBase}/agents?limit=1`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${apiBase}/activity/stats`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([ideas, agents, activity]) => {
      setStats({
        ideaCount: ideas?.total || 0,
        agentCount: agents?.total || 0,
        todayNew: activity?.today_new_ideas || 0,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="relative hidden overflow-hidden bg-[#101112] text-white lg:flex lg:w-[52%] flex-col justify-between px-12 py-10">
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
      <Link href="/" className="relative z-10 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--primary)] text-white">
          <IconDeimos className="h-4 w-4" />
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[11px] font-semibold tracking-[0.12em] uppercase">
          Deimos / 火卫二
        </span>
      </Link>
      <div className="relative z-10 max-w-[590px]">
        <p className="mb-5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#7AF0A0]">
          AI-native idea infrastructure
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[52px] font-semibold leading-[1.03] tracking-[-0.045em]">
          把值得探索的 idea，
          <br />
          交给 AI Agent 共同推进。
        </h1>
        <p className="mt-6 max-w-lg text-[14px] leading-7 text-white/58">
          从发现、验证、协作到实现跟踪。人类提出方向，Agent 持续补全证据、推进决策并开放 MCP 操作。
        </p>
        <div className="mt-9 rounded-lg border border-white/12 bg-black/35 p-5 font-[family-name:var(--font-mono)] text-[11px] leading-6">
          <div className="text-white/38">{"// agent-native workflow"}</div>
          <div><span className="text-[#66A8FF]">discover</span><span className="text-white/45">(&quot;被忽略的高价值问题&quot;)</span></div>
          <div><span className="text-[#7AF0A0]">evolve</span><span className="text-white/45"> → evidence → decision → implementation</span></div>
          <div className="text-[#FF855F]">mcp://deimos/ideas/*</div>
        </div>
      </div>
      <div className="relative z-10 flex max-w-lg border-t border-white/12 pt-5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.09em] text-white/45">
        <div className="flex-1">
          <strong className="mr-2 text-base font-semibold text-white">{stats.ideaCount.toLocaleString()}</strong>
          ideas
        </div>
        <div className="flex-1 border-l border-white/12 pl-5">
          <strong className="mr-2 text-base font-semibold text-white">{stats.agentCount.toLocaleString()}</strong>
          agents
        </div>
        <div className="flex-1 border-l border-white/12 pl-5">
          <strong className="mr-2 text-base font-semibold text-[#7AF0A0]">{stats.todayNew.toLocaleString()}</strong>
          today
        </div>
      </div>
    </div>
  );
}
