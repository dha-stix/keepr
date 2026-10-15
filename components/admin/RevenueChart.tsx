"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { DayRevenue } from "@/lib/stats";
import { formatDate, naira } from "@/lib/utils";

const SERIES = [
  { key: "standard", label: "Standard", color: "var(--color-pine)" },
  { key: "exclusive", label: "Exclusive", color: "var(--color-brass)" },
  { key: "presidential", label: "Presidential", color: "var(--color-info)" },
] as const;

/** Round the axis maximum up to a clean step so tick labels are readable */
function niceMax(v: number) {
  if (v <= 0) return 1_000_000;
  const step = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / step) * step;
}

const label = (v: number) => (v === 0 ? "₦0" : v >= 1e6 ? `₦${(v / 1e6).toFixed(v % 1e6 ? 1 : 0)}m` : `₦${Math.round(v / 1e3)}k`);

/** Stacked revenue by room category, per day or per month. Bars grow from the baseline; hover a bar for the breakdown. */
export function RevenueChart({ data, granularity = "day" }: { data: DayRevenue[]; granularity?: "day" | "month" }) {
  const tick = (d: string) => formatDate(d, granularity === "month" ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" });
  const long = (d: string) => formatDate(d, granularity === "month" ? { month: "long", year: "numeric" } : { weekday: "short", day: "numeric", month: "short" });
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 220, pl = 46, pb = 24, pt = 10;
  const totals = data.map(d => d.standard + d.exclusive + d.presidential);
  const max = niceMax(Math.max(...totals, 0));
  const ticks = [0, max / 2, max];
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const bw = (w - pl) / Math.max(data.length, 1);
  const every = Math.ceil(data.length / (w < 500 ? 4 : 7));
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative">
      <svg width="100%" height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`Revenue per ${granularity} by room category`} onMouseLeave={() => setHover(null)}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={pl} x2={w} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--color-muted)" className="num">
              {label(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          let acc = 0;
          const x = pl + i * bw + bw * 0.18;
          const bwInner = bw * 0.64;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${long(d.date)}: ${naira(totals[i]!)}`}>
              <rect x={pl + i * bw} y={pt} width={bw} height={H - pt - pb} fill={hover === i ? "var(--color-sunk)" : "transparent"} />
              {SERIES.map((s, j) => {
                const v = d[s.key];
                if (!v) return null;
                const top = y(acc + v);
                const height = y(acc) - top;
                acc += v;
                return (
                  <motion.rect
                    key={s.key}
                    x={x}
                    y={top}
                    width={bwInner}
                    height={height}
                    rx={2}
                    fill={s.color}
                    style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.7, delay: i * 0.035 + j * 0.1, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                );
              })}
              {i % every === 0 && (
                <text x={x + bwInner / 2} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--color-muted)" className="num">
                  {tick(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 z-10 grid gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg" style={{ left: Math.min(pl + hover! * bw, w - 170) }}>
          <b>{long(h.date)}</b>
          {SERIES.map(s => (
            <span key={s.key} className="flex justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="num">{naira(h[s.key])}</span>
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        {SERIES.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
