/**
 * float-liquid 背景光斑层。
 *
 * 固定定位的彩色光斑 (橙/蓝/绿, 取自 ardot 主题色柔和版),
 * 用 filter: blur(80px) 预模糊而非 backdrop-filter, 不随滚动重算, 性能稳定。
 * 玻璃卡片 (.glass-card) 透出这层色彩才显现玻璃质感。
 */
export function LiquidBackground() {
  return (
    <div className="liquid-orbs" aria-hidden="true">
      <div className="liquid-orb-extra" />
    </div>
  );
}
