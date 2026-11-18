"use client";
// The 24-hour setpoint curve (as in IIVO's setpoint editor): one or more setpoints across
// the day, with a marker at each period start, sunrise/sunset, a "Now" line and the active
// period highlighted. Parameterised by which setpoint(s) to plot.
import { resolvePeriod, periodStart } from "@/engine/control";
import { fmtMinutes } from "@/engine/sun";
import type { Strategy } from "@/engine/types";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/vars";

export type CurveKey = "heat" | "vent" | "rhMax" | "co2";
export interface CurveSeries {
  key: CurveKey;
  color: string;
  dash?: boolean;
  label: string;
}
const DEFAULT_SERIES: CurveSeries[] = [
  { key: "heat", color: "--s6", label: "st.heat" },
  { key: "vent", color: "--s2", dash: true, label: "st.vent" },
];

export function SetpointCurve({
  strategy,
  sunrise,
  sunset,
  now,
  series = DEFAULT_SERIES,
  unit = "°C",
  digits = 1,
  height = 200,
}: {
  strategy: Strategy;
  sunrise: number;
  sunset: number;
  now: number;
  series?: CurveSeries[];
  unit?: string;
  digits?: number;
  height?: number;
}) {
  const s = useStore();
  const t = s.t;
  const W = 1000;
  const H = height;
  const padL = 42;
  const padR = 12;
  const padT = 22;
  const padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const step = 6;
  const samples: { m: number; v: Record<CurveKey, number> }[] = [];
  for (let m = 0; m <= 1440; m += step) {
    const r = resolvePeriod(strategy, m, sunrise, sunset);
    samples.push({ m, v: r.values });
  }
  const primary = series[0].key;
  const allVals = samples.flatMap((p) => series.map((sr) => p.v[sr.key]));
  let yMin = Math.min(...allVals);
  let yMax = Math.max(...allVals);
  const padY = Math.max(1, (yMax - yMin) * 0.12);
  yMin = Math.floor(yMin - padY);
  yMax = Math.ceil(yMax + padY);
  if (yMax - yMin < (unit === "ppm" ? 100 : 4)) yMax = yMin + (unit === "ppm" ? 100 : 4);
  const baseline = samples.reduce((a, p) => a + p.v[primary], 0) / samples.length;

  const X = (m: number) => padL + (m / 1440) * plotW;
  const Y = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const path = (key: CurveKey) => samples.map((p, i) => `${i ? "L" : "M"}${X(p.m).toFixed(1)},${Y(p.v[key]).toFixed(1)}`).join(" ");

  const starts = strategy.periods.map((p) => ({ p, m: periodStart(p, sunrise, sunset) })).sort((a, b) => a.m - b.m);
  const active = resolvePeriod(strategy, now, sunrise, sunset).index;
  const activeIdx = starts.findIndex((x) => x.p.id === strategy.periods[active]?.id);
  const aStart = activeIdx >= 0 ? starts[activeIdx].m : 0;
  const aEnd = activeIdx >= 0 ? (starts[(activeIdx + 1) % starts.length].m > aStart ? starts[(activeIdx + 1) % starts.length].m : 1440) : 0;

  const tickStep = unit === "ppm" ? 200 : unit === "%" ? 10 : 2;
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax; v += tickStep) yTicks.push(v);

  const SunIcon = ({ x }: { x: number }) => (
    <g transform={`translate(${x} ${padT - 14})`} opacity="0.7">
      <circle r="3" fill="none" stroke="var(--muted)" strokeWidth="1.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1={0} y1={-5} x2={0} y2={-6.5} stroke="var(--muted)" strokeWidth="1.2" transform={`rotate(${a})`} />
      ))}
    </g>
  );

  return (
    <div className="px-1" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} role="img" aria-label={t("st.curveTitle")}>
        {activeIdx >= 0 && <rect x={X(aStart)} y={padT} width={X(aEnd) - X(aStart)} height={plotH} fill="var(--s1)" opacity="0.08" />}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <text x={padL - 6} y={Y(v) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
              {v}
            </text>
          </g>
        ))}
        {Array.from({ length: 13 }, (_, i) => i * 2).map((h) => (
          <text key={h} x={X(h * 60)} y={H - padB + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {String(h % 24).padStart(2, "0")}
          </text>
        ))}
        {[sunrise, sunset].map((m, i) => (
          <g key={i}>
            <line x1={X(m)} x2={X(m)} y1={padT} y2={padT + plotH} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <SunIcon x={X(m)} />
            <text x={X(m)} y={H - padB + 30} textAnchor="middle" fontSize="9.5" fill="var(--muted)">
              {fmtMinutes(m)}
            </text>
          </g>
        ))}
        {series
          .slice(1)
          .map((sr) => (
            <path key={sr.key} d={path(sr.key)} fill="none" stroke={`var(${sr.color})`} strokeWidth="1.6" strokeDasharray={sr.dash ? "4 3" : undefined} vectorEffect="non-scaling-stroke" opacity="0.85" />
          ))}
        <path d={path(primary)} fill="none" stroke={`var(${series[0].color})`} strokeWidth="2.2" strokeDasharray={series[0].dash ? "4 3" : undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {starts.map(({ p, m }) => (
          <g key={p.id}>
            <rect x={X(m) - 4.5} y={Y(periodValue(p, primary)) - 4.5} width="9" height="9" rx="1.5" transform={`rotate(45 ${X(m)} ${Y(periodValue(p, primary))})`} fill="var(--surface)" stroke={`var(${series[0].color})`} strokeWidth="2" />
            <text x={X(m)} y={Y(periodValue(p, primary)) - 10} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--text)">
              {fmt(periodValue(p, primary), digits)}
            </text>
          </g>
        ))}
        <line x1={X(now)} x2={X(now)} y1={padT - 4} y2={padT + plotH} stroke="var(--s1)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <text x={X(now)} y={padT - 7} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--s1)">
          {t("st.now")}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 px-1 text-[12px]">
        <div className="flex items-center gap-3">
          {series.map((sr) => (
            <span key={sr.key} className="inline-flex items-center gap-1.5 text-ink-2">
              <span className={`inline-block h-0.5 w-4 rounded ${sr.dash ? "border-b-2 border-dashed" : ""}`} style={sr.dash ? { borderColor: `var(${sr.color})` } : { background: `var(${sr.color})` }} /> {t(sr.label)}
            </span>
          ))}
        </div>
        <span className="num text-muted">
          {t("st.baseline")}: <b className="text-ink-2">{fmt(baseline, digits)} {unit}</b>
        </span>
      </div>
    </div>
  );
}

function periodValue(p: Strategy["periods"][number], key: CurveKey): number {
  return key === "heat" ? p.heat : key === "vent" ? p.vent : key === "rhMax" ? p.rhMax : p.co2;
}
