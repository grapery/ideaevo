/** 首页 Hero 插画占位 — 后续可替换为真实漫画/插画资源 */
export function HeroIllustrationPlaceholder() {
  return (
    <div
      className="hero-illustration relative w-full overflow-hidden border border-[var(--rule)] bg-[var(--bg-surface)]"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 320 280"
        className="w-full h-auto"
        role="img"
        aria-label="插画占位"
      >
        {/* 天空渐变 */}
        <defs>
          <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8efe9" />
            <stop offset="100%" stopColor="#fbf8f5" />
          </linearGradient>
          <linearGradient id="hero-ground" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e8e4df" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f5f5f7" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        <rect width="320" height="280" fill="url(#hero-sky)" />

        {/* 远山 */}
        <ellipse cx="80" cy="200" rx="90" ry="28" fill="#d4ddd5" opacity="0.6" />
        <ellipse cx="240" cy="210" rx="110" ry="32" fill="#c5d4c7" opacity="0.5" />

        {/* 飘落的叶子 */}
        <g fill="#5b7b5e" opacity="0.55">
          <path d="M48 72c8-14 22-10 18 4-6 2-12-2-18-4z" transform="rotate(-18 57 74)" />
          <path d="M260 48c7-12 18-8 15 3-5 2-10-1-15-3z" transform="rotate(24 267 50)" />
          <path d="M200 100c6-10 16-7 13 3-4 1-9-1-13-3z" transform="rotate(-8 206 101)" />
        </g>

        {/* Agent 剪影 — 简约人形 */}
        <g transform="translate(118 88)">
          {/* 身体 */}
          <ellipse cx="42" cy="108" rx="38" ry="10" fill="#000" opacity="0.06" />
          <path
            d="M42 52c-18 0-28 14-28 32v36c0 8 6 14 14 14h28c8 0 14-6 14-14V84c0-18-10-32-28-32z"
            fill="#6b8cae"
            opacity="0.85"
          />
          {/* 头部 */}
          <circle cx="42" cy="36" r="22" fill="#d4a04a" opacity="0.9" />
          {/* 头发 */}
          <path
            d="M20 34c2-16 18-24 22-24s20 8 22 24c-6-4-14-6-22-6s-16 2-22 6z"
            fill="#9a7b4f"
            opacity="0.85"
          />
          {/* 手持叶子 */}
          <path
            d="M78 70c12-8 20 2 14 14-8 4-16-2-14-14z"
            fill="#5b7b5e"
          />
          <line x1="72" y1="78" x2="84" y2="66" stroke="#5b7b5e" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* 对话气泡 */}
        <g transform="translate(196 56)">
          <rect x="0" y="0" width="88" height="44" rx="12" fill="#fff" stroke="#e8e4df" strokeWidth="1.5" />
          <polygon points="12,44 4,56 24,44" fill="#fff" stroke="#e8e4df" strokeWidth="1.5" strokeLinejoin="round" />
          <text x="44" y="28" textAnchor="middle" fill="#6e6e73" fontSize="11" fontFamily="system-ui, sans-serif">
            新想法？
          </text>
        </g>

        {/* 地面 */}
        <rect x="0" y="220" width="320" height="60" fill="url(#hero-ground)" />

        {/* 像素小机器人装饰 */}
        <g transform="translate(24 228)" className="pixel-accent" opacity="0.45">
          <rect x="0" y="8" width="4" height="4" fill="#5b7b5e" />
          <rect x="4" y="4" width="4" height="4" fill="#5b7b5e" />
          <rect x="8" y="0" width="4" height="4" fill="#5b7b5e" />
          <rect x="8" y="8" width="4" height="4" fill="#6b8cae" />
          <rect x="4" y="12" width="4" height="4" fill="#6b8cae" />
          <rect x="0" y="12" width="4" height="4" fill="#6b8cae" />
        </g>
      </svg>

      {/* 底部柔和渐隐 */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--bg-surface))",
        }}
      />

      <p className="absolute bottom-2 left-0 right-0 text-center meta-label">
        插画占位
      </p>
    </div>
  );
}
