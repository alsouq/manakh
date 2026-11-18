"use client";
import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { cssVar } from "@/lib/vars";
import { useStore } from "@/lib/store";
import { SITE } from "@/sim/seed";

export interface ChartSeries {
  label: string;
  values: ArrayLike<number | null>;
  color: string; // css var name like --s1 or a color
  dash?: boolean;
  step?: boolean;
  width?: number;
  digits?: number;
}

export interface ChartPanelDef {
  id: string;
  title: string;
  unit: string;
  series: ChartSeries[];
  height?: number;
  yMin?: number;
  yMax?: number;
}

const resolve = (c: string) => (c.startsWith("--") ? cssVar(c) : c);

function nowLine(nowSec: () => number | null): uPlot.Plugin {
  return {
    hooks: {
      draw: (u) => {
        const n = nowSec();
        if (n === null) return;
        const x = u.valToPos(n, "x", true);
        if (x < u.bbox.left || x > u.bbox.left + u.bbox.width) return;
        const ctx = u.ctx;
        ctx.save();
        ctx.strokeStyle = cssVar("--muted");
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1 * devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(x, u.bbox.top);
        ctx.lineTo(x, u.bbox.top + u.bbox.height);
        ctx.stroke();
        ctx.restore();
      },
    },
  };
}

function Panel({ x, def, tz, syncKey, now, timeLabel }: { x: number[]; def: ChartPanelDef; tz: string; syncKey: string; now?: number; timeLabel: string }) {
  const box = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const nowRef = useRef<number | null>(now ? now / 1000 : null);
  nowRef.current = now ? now / 1000 : null;
  const theme = typeof document !== "undefined" ? document.documentElement.dataset.theme : "light";
  const structure = JSON.stringify([timeLabel, def.series.map((s) => [s.label, s.color, s.dash, s.step]), def.unit, def.yMin, def.yMax, theme, tz, def.height]);
  const lastSig = useRef("");

  const data = (): uPlot.AlignedData => [Float64Array.from(x, (v) => v / 1000), ...def.series.map((s) => Array.from(s.values) as (number | null)[])];

  useEffect(() => {
    if (!box.current) return;
    const width = box.current.clientWidth || 600;
    const axisStroke = cssVar("--axis");
    const grid = cssVar("--grid");
    const opts: uPlot.Options = {
      width,
      height: def.height ?? 180,
      tzDate: (ts) => uPlot.tzDate(new Date(ts * 1e3), tz),
      cursor: { sync: { key: syncKey }, drag: { x: true, y: false }, points: { size: 7 } },
      legend: { live: true },
      scales: {
        x: { time: true },
        y: def.yMin !== undefined || def.yMax !== undefined ? { range: (_u, lo, hi) => [def.yMin ?? lo, def.yMax ?? hi] } : { auto: true },
      },
      axes: [
        {
          stroke: axisStroke,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid, width: 1 },
          font: "11px system-ui",
          values: [
            [3600 * 24, "{DD} {MMM}", null, null, null, null, null, null, 1],
            [3600, "{HH}:{mm}", "\n{DD} {MMM}", null, "\n{DD} {MMM}", null, null, null, 1],
            [60, "{HH}:{mm}", "\n{DD} {MMM}", null, "\n{DD} {MMM}", null, null, null, 1],
          ],
        },
        {
          stroke: axisStroke,
          grid: { stroke: grid, width: 1 },
          ticks: { show: false },
          font: "11px system-ui",
          size: 48,
          label: def.unit,
          labelFont: "11px system-ui",
          labelSize: 14,
        },
      ],
      series: [
        { label: timeLabel, value: (_u, v) => (v == null ? "–" : new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(v * 1000))) },
        ...def.series.map((s) => ({
          label: s.label,
          stroke: resolve(s.color),
          width: s.width ?? 2,
          dash: s.dash ? [5, 4] : undefined,
          paths: s.step ? uPlot.paths.stepped!({ align: 1 }) : undefined,
          points: { show: false },
          value: (_u: uPlot, v: number | null) => (v == null ? "–" : v.toFixed(s.digits ?? 1)),
        })),
      ],
      plugins: [nowLine(() => nowRef.current)],
    };
    plot.current?.destroy();
    plot.current = new uPlot(opts, data(), box.current);
    lastSig.current = `${x.length}:${x[x.length - 1]}`;
    const ro = new ResizeObserver(() => {
      if (box.current && plot.current) plot.current.setSize({ width: box.current.clientWidth, height: def.height ?? 180 });
    });
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      plot.current?.destroy();
      plot.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, syncKey]);

  // cheap data refresh when the series grows or the window moves
  useEffect(() => {
    const sig = `${x.length}:${x[x.length - 1]}:${def.series.map((s) => s.values[s.values.length - 1]).join(",")}`;
    if (plot.current && sig !== lastSig.current) {
      lastSig.current = sig;
      plot.current.setData(data());
    }
  });

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between px-1">
        <span className="text-[13px] font-semibold text-ink">{def.title}</span>
      </div>
      <div ref={box} dir="ltr" className="w-full" />
    </div>
  );
}

export function TimeCharts({ x, panels, syncKey = "main", now }: { x: number[]; panels: ChartPanelDef[]; syncKey?: string; now?: number }) {
  const s = useStore();
  const tz = SITE.geo.tz;
  return (
    <div className="space-y-5">
      {panels.map((p) => (
        <Panel key={p.id} x={x} def={p} tz={tz} syncKey={syncKey} now={now} timeLabel={s.t("wx.time")} />
      ))}
    </div>
  );
}

/** Tiny inline sparkline (SVG), no axes. */
export function Sparkline({ values, color = "var(--s1)", height = 36, band }: { values: number[]; color?: string; height?: number; band?: [number[], number[]] }) {
  if (values.length < 2) return <div style={{ height }} />;
  const all = band ? [...values, ...band[0], ...band[1]] : values;
  let lo = Math.min(...all),
    hi = Math.max(...all);
  if (hi - lo < 1) {
    hi += 0.5;
    lo -= 0.5;
  }
  const W = 200;
  const pt = (v: number, i: number, n: number) => `${((i / (n - 1)) * W).toFixed(1)},${(height - 2 - ((v - lo) / (hi - lo)) * (height - 4)).toFixed(1)}`;
  const line = values.map((v, i) => pt(v, i, values.length)).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      {band && <polyline points={band[0].map((v, i) => pt(v, i, band[0].length)).join(" ")} fill="none" stroke="var(--s8)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.8" />}
      {band && <polyline points={band[1].map((v, i) => pt(v, i, band[1].length)).join(" ")} fill="none" stroke="var(--s1)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.8" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
