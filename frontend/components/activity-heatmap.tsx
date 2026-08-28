"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBase } from "@/lib/api-base";
import { ActivityList, type ActivityLog } from "@/components/activity-list";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

interface HeatmapDay {
  date: string;
  count: number;
}

const WEEKS = 53;
const CELL = 11;
const GAP = 3;

/** 本地时区的 YYYY-MM-DD（toISOString 会转 UTC，不能用）。 */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 计数 → 0-4 级（按最大值的分位），GitHub contributions 同款分档。 */
function levelOf(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const q = count / max;
  if (q <= 0.25) return 1;
  if (q <= 0.5) return 2;
  if (q <= 0.75) return 3;
  return 4;
}

/** 用 color-mix 从主题色派生 5 档深浅，自动适配明暗主题。 */
function levelColor(level: number): string {
  if (level <= 0) return "var(--bg-subtle)";
  const mix = [0, 25, 45, 68, 92][level];
  return `color-mix(in srgb, var(--primary) ${mix}%, var(--bg-subtle))`;
}

interface GridCell {
  date: string;
  count: number;
  inFuture: boolean;
}

interface GridColumn {
  cells: GridCell[]; // 恒为 7 个（周日→周六），未来日期 inFuture=true
  monthLabel: string | null; // 跨月的第一列标注月份
}

/**
 * GitHub contributions 式活跃热力图：近一年每日活动计数；
 * 点击方块展开当天的活动 feed（用户/Agent 主页共用）。
 */
export function ActivityHeatmapSection({
  ownerType,
  ownerId,
}: {
  ownerType: "user" | "agent";
  ownerId: string;
}) {
  const { t, locale } = useI18n();
  const apiBase = getApiBase();
  const [counts, setCounts] = useState<Map<string, number> | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [dayFeed, setDayFeed] = useState<ActivityLog[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; cell: GridCell } | null>(null);

  useEffect(() => {
    const base = ownerType === "user" ? "users" : "agents";
    let cancelled = false;
    fetch(`${apiBase}/${base}/${ownerId}/activity/heatmap`)
      .then(async (res) => (res.ok ? res.json() : Promise.reject(new Error("heatmap"))))
      .then((data: { days?: HeatmapDay[]; total?: number }) => {
        if (cancelled) return;
        const map = new Map<string, number>();
        for (const d of data.days ?? []) map.set(d.date, d.count);
        setCounts(map);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCounts(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [ownerType, ownerId, apiBase]);

  // 当天 feed：用户走 /users/:id/activity（聚合其 Agent），Agent 走通用 /activity
  useEffect(() => {
    if (!selected) {
      setDayFeed(null);
      return;
    }
    let cancelled = false;
    setFeedLoading(true);
    const path =
      ownerType === "user"
        ? `/users/${ownerId}/activity?date=${selected}&limit=50`
        : `/activity?actor_type=agent&actor_id=${ownerId}&date=${selected}&limit=50`;
    fetch(`${apiBase}${path}`)
      .then(async (res) => (res.ok ? res.json() : Promise.reject(new Error("feed"))))
      .then((data: { activities?: ActivityLog[] }) => {
        if (!cancelled) setDayFeed(data.activities ?? []);
      })
      .catch(() => {
        if (!cancelled) setDayFeed([]);
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, ownerType, ownerId, apiBase]);

  const toggleDay = useCallback((date: string) => {
    setSelected((prev) => (prev === date ? null : date));
  }, []);

  const maxCount = useMemo(() => {
    let max = 0;
    counts?.forEach((v) => {
      if (v > max) max = v;
    });
    return max;
  }, [counts]);

  // 网格：从本周回推 53 列，列首对齐周日（与 GitHub 一致），未来日期置灰不渲染
  const columns = useMemo<GridColumn[]>(() => {
    if (!counts) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cols: GridColumn[] = [];
    let prevMonth = -1;
    // 最后一列 = 本周（以周日为列首）
    const thisSunday = new Date(today);
    thisSunday.setDate(thisSunday.getDate() - thisSunday.getDay());
    for (let w = WEEKS - 1; w >= 0; w--) {
      const sunday = new Date(thisSunday);
      sunday.setDate(sunday.getDate() - w * 7);
      const cells: GridCell[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(sunday);
        day.setDate(day.getDate() + d);
        const key = toDateKey(day);
        cells.push({
          date: key,
          count: counts.get(key) ?? 0,
          inFuture: day.getTime() > today.getTime(),
        });
      }
      const month = sunday.getMonth();
      cols.push({ cells, monthLabel: month !== prevMonth ? String(month) : null });
      prevMonth = month;
    }
    return cols;
  }, [counts]);

  const localeTag = locale === "en" ? "en-US" : "zh-CN";
  const formatDay = useCallback(
    (date: string) =>
      new Date(`${date}T00:00:00`).toLocaleDateString(localeTag, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [localeTag]
  );

  // 左侧星期标签：一/三/五（行号 1、3、5）
  const weekdayRows = [1, 3, 5];
  const weekdayLabel = (row: number) => {
    if (locale === "en") return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][row].slice(0, 3);
    return ["日", "一", "二", "三", "四", "五", "六"][row];
  };

  const monthLabelOf = (m: string) =>
    new Date(2026, Number(m), 1).toLocaleDateString(localeTag, { month: "short" });

  return (
    <section className="surface-card px-4 py-4 sm:px-5" aria-label={t("activity.heatmapTitle")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--title)]">
          <DeimosIcon name="pulse" className="h-3.5 w-3.5 text-[var(--accent-link)]" />
          {t("activity.heatmapTitle")}
          {counts !== null && (
            <span className="ml-1 text-xs font-normal text-[var(--ink-faint)]">
              {t("activity.heatmapTotal", { count: total })}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-faint)]">
          <span>{t("activity.heatmapLess")}</span>
          {[0, 1, 2, 3, 4].map((lv) => (
            <span
              key={lv}
              className="h-[10px] w-[10px] rounded-[2px]"
              style={{ backgroundColor: levelColor(lv) }}
            />
          ))}
          <span>{t("activity.heatmapMore")}</span>
        </div>
      </div>

      {counts === null || columns.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center text-[13px] text-[var(--ink-faint)]">
          {t("common.loading")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* 月份标签行 */}
            <div className="flex" style={{ marginLeft: 28, gap: GAP }} aria-hidden="true">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className="relative text-[10px] leading-4 text-[var(--ink-faint)]"
                  style={{ width: CELL }}
                >
                  {col.monthLabel !== null && (
                    <span className="absolute left-0 top-0 whitespace-nowrap">
                      {monthLabelOf(col.monthLabel)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex">
              {/* 星期标签列 */}
              <div className="flex flex-col" style={{ width: 28, gap: GAP }} aria-hidden="true">
                {Array.from({ length: 7 }, (_, row) => (
                  <span
                    key={row}
                    className="text-[10px] leading-[11px] text-[var(--ink-faint)]"
                    style={{ height: CELL }}
                  >
                    {weekdayRows.includes(row) ? weekdayLabel(row) : ""}
                  </span>
                ))}
              </div>
              {/* 方格网格 */}
              <div className="flex" style={{ gap: GAP }}>
                {columns.map((col, i) => (
                  <div key={i} className="flex flex-col" style={{ gap: GAP }}>
                    {col.cells.map((cell) => {
                      const level = levelOf(cell.count, maxCount);
                      const isSelected = selected === cell.date;
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          disabled={cell.inFuture}
                          onClick={() => toggleDay(cell.date)}
                          onMouseEnter={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setHover({ x: rect.left + rect.width / 2, y: rect.top, cell });
                          }}
                          onMouseLeave={() => setHover(null)}
                          aria-label={t("activity.heatmapTooltip", {
                            count: cell.count,
                            date: formatDay(cell.date),
                          })}
                          aria-pressed={isSelected}
                          className={`h-[11px] w-[11px] rounded-[2px] ${
                            cell.inFuture
                              ? "opacity-0"
                              : isSelected
                                ? "outline outline-2 outline-offset-1 outline-[var(--primary)]"
                                : "hover:outline hover:outline-1 hover:outline-offset-1 hover:outline-[var(--rule)]"
                          }`}
                          style={{
                            backgroundColor: cell.inFuture
                              ? "transparent"
                              : levelColor(cell.count > 0 ? level : 0),
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {counts !== null && (
        <p className="mt-2 text-[11px] text-[var(--ink-faint)]">{t("activity.heatmapSelectHint")}</p>
      )}

      {/* 当天活动 feed */}
      {selected && (
        <div className="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-[var(--rule)]">
          <div className="flex items-center justify-between border-b border-[var(--rule)] bg-[var(--bg-subtle)] px-4 py-2">
            <h3 className="text-[12px] font-semibold text-[var(--ink-soft)]">
              {t("activity.heatmapDayTitle", { date: formatDay(selected) })}
            </h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[11px] text-[var(--ink-faint)] hover:text-[var(--primary)]"
            >
              {t("common.close")}
            </button>
          </div>
          {feedLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
            </div>
          ) : dayFeed && dayFeed.length > 0 ? (
            <ActivityList activities={dayFeed} />
          ) : (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--ink-faint)]">
              {t("activity.heatmapNoDay")}
            </p>
          )}
        </div>
      )}

      {/* 悬浮提示：计数 + 日期 */}
      {hover && !hover.cell.inFuture && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-md border border-[var(--rule)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--ink)] shadow-sm"
          style={{ left: hover.x, top: hover.y }}
          role="tooltip"
        >
          {t("activity.heatmapTooltip", {
            count: hover.cell.count,
            date: formatDay(hover.cell.date),
          })}
        </div>
      )}
    </section>
  );
}
