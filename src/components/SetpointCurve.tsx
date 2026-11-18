"use client";
// The 24-hour setpoint curve (as in IIVO's setpoint editor): the heating and ventilation
// targets across the day, with a marker at each period start, sunrise/sunset, a "Now" line
// and the active period highlighted. Read-only visualization above the editable period table.
import { resolvePeriod, periodStart } from "@/engine/control";
import { fmtMinutes } from "@/engine/sun";
import type { Strategy } from "@/engine/types";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/vars";

export function SetpointCurve({ strategy, sunrise, sunset, now }: { strategy: Strategy; sunrise: number; sunset: number; now: number }) {
  const s = useStore();
  const t = s.t;
  const W = 1000;
  const H = 230;
  const padL = 34;
  const padR = 12;
  const padT = 22;
  const padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const step = 6;
  const samples: { m: number; heat: number; vent: number }[] = [];
  for (let m = 0; m <= 1440; m += step) {
    const r = resolvePeriod(strategy, m, sunrise, sunset);
    samples.push({ m, heat: r.values.heat, vent: r.values.vent });
  }
  const vals = samples.flatMap((p) => [p.heat, p.vent]);
  const yMin = Math.floor(Math.min(...vals) - 1);
  let yMax = Math.ceil(Math.max(...vals) + 1);
  if (yMax - yMin < 6) {
    yMax = yMin + 6;
  }
  const baseline = samples.reduce((a, p) => a + p.heat, 0) / samples.length;

  const X = (m: number) => padL + (m / 1440) * plotW;
  const Y = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const line = (key: "heat" | "vent") => samples.map((p, i) => `${i ? "L" : "M"}${X(p.m).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(" ");

  const starts = strategy.periods
    .map((p) => ({ p, m: periodStart(p, sunrise, sunset) }))
    .sort((a, b) => a.m - b.m);
  const active = resolvePeriod(strategy, now, sunrise, sunset).index;
  const activeIdx = starts.findIndex((x) => x.p.id === strategy.periods[active]?.id);
  const aStart = activeIdx >= 0 ? starts[activeIdx].m : 0;
  const aEnd = activeIdx >= 0 ? (starts[(activeIdx + 1) % starts.length].m > aStart ? starts[(activeIdx + 1) % starts.length].m : 1440) : 0;

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax; v += 2) yTicks.push(v);

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
        {/* active-period band */}
        {activeIdx >= 0 && <rect x={X(aStart)} y={padT} width={X(aEnd) - X(aStart)} height={plotH} fill="var(--s1)" opacity="0.08" />}
        {/* grid + y labels */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <text x={padL - 6} y={Y(v) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
              {v}
            </text>
          </g>
        ))}
        {/* x hour labels */}
        {Array.from({ length: 13 }, (_, i) => i * 2).map((h) => (
          <text key={h} x={X(h * 60)} y={H - padB + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {String(h % 24).padStart(2, "0")}
          </text>
        ))}
        {/* sunrise / sunset */}
        {[sunrise, sunset].map((m, i) => (
          <g key={i}>
            <line x1={X(m)} x2={X(m)} y1={padT} y2={padT + plotH} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <SunIcon x={X(m)} />
            <text x={X(m)} y={H - padB + 30} textAnchor="middle" fontSize="9.5" fill="var(--muted)">
              {fmtMinutes(m)}
            </text>
          </g>
        ))}
        {/* vent line (secondary) */}
        <path d={line("vent")} fill="none" stroke="var(--s2)" strokeWidth="1.6" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity="0.85" />
        {/* heat line (primary) */}
        <path d={line("heat")} fill="none" stroke="var(--s6)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {/* period markers */}
        {starts.map(({ p, m }) => (
          <g key={p.id}>
            <rect x={X(m) - 4.5} y={Y(p.heat) - 4.5} width="9" height="9" rx="1.5" transform={`rotate(45 ${X(m)} ${Y(p.heat)})`} fill="var(--surface)" stroke="var(--s6)" strokeWidth="2" />
            <text x={X(m)} y={Y(p.heat) - 10} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--text)">
              {fmt(p.heat, 1)}
            </text>
          </g>
        ))}
        {/* now line */}
        <line x1={X(now)} x2={X(now)} y1={padT - 4} y2={padT + plotH} stroke="var(--s1)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <text x={X(now)} y={padT - 7} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--s1)">
          {t("st.now")}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 px-1 text-[12px]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: "var(--s6)" }} /> {t("st.heat")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="inline-block h-0.5 w-4 rounded border-b-2 border-dashed" style={{ borderColor: "var(--s2)" }} /> {t("st.vent")}
          </span>
        </div>
        <span className="num text-muted">
          {t("st.baseline")}: <b className="text-ink-2">{fmt(baseline, 1)} °C</b>
        </span>
      </div>
    </div>
  );
}
