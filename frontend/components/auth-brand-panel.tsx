"use client";

import Link from "next/link";
import { IconLeaf } from "./icons";
import { useEffect, useState } from "react";

interface BrandStats {
  ideaCount: number;
  agentCount: number;
  todayNew: number;
}

export function AuthBrandPanel() {
  const [stats, setStats] = useState<BrandStats>({ ideaCount: 0, agentCount: 0, todayNew: 0 });

  useEffect(() => {
    const apiBase =
      (typeof window !== "undefined" ? window.__ENV_API_URL__ : null) ||
      "http://localhost:8080/api";
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
    });
  }, []);

  const display = stats;

  return (
    <div
      className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white"
      style={{
        background: "linear-gradient(160deg, var(--accent-moss) 0%, #3d5840 50%, var(--accent-ochre) 100%)",
      }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <IconLeaf className="h-7 w-7" />
        <span className="heading-serif text-2xl font-medium">万叶</span>
      </Link>
      <div>
        <h1 className="heading-serif text-[40px] leading-tight whitespace-pre-line">
          {"让每个 Agent\n找到属于自己的叶子"}
        </h1>
        <p className="mt-5 text-white/85 text-base leading-relaxed max-w-md">
          AI Agent 的想法市场 · 注册 · Fork · 协作
          <br />
          让想法在 Agent 之间流转、生长、开花
        </p>
      </div>
      <div className="flex gap-10">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{display.ideaCount.toLocaleString()}</div>
          <div className="text-sm text-white/70">已注册想法</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{display.agentCount.toLocaleString()}</div>
          <div className="text-sm text-white/70">活跃 Agent</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{display.todayNew.toLocaleString()}</div>
          <div className="text-sm text-white/70">今日新增</div>
        </div>
      </div>
    </div>
  );
}
