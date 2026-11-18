"use client";
// Live schematic of one greenhouse section. Every installation is clickable and explains itself.
import type { ActuatorKey } from "@/engine/types";
import type { SectionLive } from "@/sim/twin";
import type { WeatherPoint } from "@/sim/weather";
import { fmt } from "@/lib/vars";

export type VizTarget = ActuatorKey | "climate";

const mix = (a: [number, number, number], b: [number, number, number], f: number) => {
  const k = Math.max(0, Math.min(1, f));
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
};

export function GreenhouseViz({
  L,
  out,
  minuteOfDay,
  sunrise,
  sunset,
  t,
  selected,
  onSelect,
}: {
  L: SectionLive;
  out: WeatherPoint;
  minuteOfDay: number;
  sunrise: number;
  sunset: number;
  t: (k: string) => string;
  selected?: VizTarget;
  onSelect: (k: VizTarget) => void;
}) {
  const a = L.phys.act;
  const ph = L.def.phys;
  const manual = new Set(L.overrides.map((o) => o.actuator));
  const day = out.elevation > 0;
  const W = 720;
  const ground = 322;
  const gutter = 172;
  const ridge = 112;
  const left = 60;
  const right = 660;
  const spans = [
    [left, (left + right) / 2],
    [(left + right) / 2, right],
  ];

  // sun position across the sky by day progress
  const prog = Math.max(0, Math.min(1, (minuteOfDay - sunrise) / Math.max(1, sunset - sunrise)));
  const sunX = 40 + prog * (W - 80);
  const sunY = 100 - Math.max(0, out.elevation) * 1.6;

  const pipeColor = mix([154, 165, 160], [227, 73, 72], (L.phys.pipeT - 22) / 45);
  const hit = (k: VizTarget, label: string) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick: () => onSelect(k),
    onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && onSelect(k),
    style: { cursor: "pointer" },
    className: "outline-none focus-visible:opacity-80",
  });
  const sel = (k: VizTarget) => selected === k;

  const chip = (x: number, y: number, text: string, opts: { k?: VizTarget; manual?: boolean; anchor?: "start" | "middle" | "end" } = {}) => {
    const w = text.length * 6.6 + 14;
    const ax = opts.anchor === "start" ? x : opts.anchor === "end" ? x - w : x - w / 2;
    return (
      <g pointerEvents="none">
        <rect
          x={ax}
          y={y - 11}
          width={w}
          height={20}
          rx={10}
          fill={opts.manual ? "#6250d6" : "var(--surface)"}
          stroke={opts.k && sel(opts.k) ? "var(--focus)" : "var(--border-strong)"}
          strokeWidth={opts.k && sel(opts.k) ? 2 : 1}
        />
        <text x={ax + w / 2} y={y + 3.5} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={opts.manual ? "#fff" : "var(--text)"} style={{ fontVariantNumeric: "tabular-nums" }}>
          {text}
        </text>
      </g>
    );
  };

  const flap = (hx: number, side: -1 | 1, pct: number, key: "ventLee" | "ventWind") => {
    // hinge at the ridge, flap lies on the roof slope; opening rotates it upward
    const len = 46;
    const slope = Math.atan2(gutter - ridge, (right - left) / 4);
    const closed = side === 1 ? slope : Math.PI - slope;
    const open = (pct / 100) * 0.75;
    const ang = side === 1 ? closed - open : closed + open;
    const x2 = hx + Math.cos(ang) * len;
    const y2 = ridge + Math.sin(ang) * len;
    return (
      <g {...hit(key, t(`var.${key}`))}>
        <line x1={hx} y1={ridge} x2={hx + Math.cos(closed) * len} y2={ridge + Math.sin(closed) * len} stroke="var(--frame)" strokeWidth="1" strokeDasharray="2 3" />
        <line x1={hx} y1={ridge} x2={x2} y2={y2} stroke={manual.has(key) ? "#6250d6" : sel(key) ? "var(--focus)" : "var(--s1)"} strokeWidth="5" strokeLinecap="round" />
        <circle cx={x2} cy={y2} r="14" fill="transparent" />
      </g>
    );
  };

  const plantsY = ground - 4;
  const rows = 10;
  const rowW = (right - left) / rows;
  const plantH = 70 + 18 * ph.cropFactor;

  return (
    <svg viewBox={`0 0 ${W} 360`} className="h-auto w-full select-none" style={{ direction: "ltr" }} role="group" aria-label={t("sec.installations")}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={day ? "var(--sky)" : "#0f1726"} />
          <stop offset="1" stopColor="var(--surface)" />
        </linearGradient>
        <radialGradient id="glow">
          <stop offset="0" stopColor="var(--lamp)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--lamp)" stopOpacity="0" />
        </radialGradient>
        <pattern id="pad" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 6 L6 0" stroke="#5fa8d3" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={ground} fill="url(#sky)" rx="14" />
      <rect x="0" y={ground} width={W} height={360 - ground} fill="var(--soil)" opacity="0.6" />

      {/* sun / moon */}
      {day ? (
        <g>
          <circle cx={sunX} cy={sunY} r="16" fill="var(--s4)" opacity={0.4 + 0.6 * Math.min(1, out.radiation / 600)} />
        </g>
      ) : (
        <circle cx={W - 32} cy={30} r="11" fill="#c9d3e0" opacity="0.8" />
      )}
      {out.cloud > 0.15 && (
        <g opacity={Math.min(0.9, out.cloud + 0.2)} fill="var(--surface-3)">
          <ellipse cx={sunX - 30} cy={sunY + 10} rx="34" ry="12" />
          <ellipse cx={sunX - 8} cy={sunY + 2} rx="22" ry="12" />
        </g>
      )}

      {/* outside readings */}
      <g {...hit("climate", t("top.outside"))}>
        {chip(16, 22, `${fmt(out.temp, 1)}°C · ${fmt(out.rh, 0)}%`, { anchor: "start" })}
        {chip(16, 46, `${fmt(out.radiation, 0)} W/m²`, { anchor: "start" })}
      </g>
      <g transform={`translate(${W - 150} 34)`}>
        <g transform={`rotate(${out.windDir + 90})`}>
          <path d="M-14 0 H10 M4 -6 L12 0 L4 6" stroke="var(--text-2)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
        <text x="22" y="4" fontSize="11.5" fill="var(--text-2)" fontWeight="600">
          {fmt(out.wind, 1)} m/s
        </text>
      </g>

      {/* structure */}
      <path
        d={`M${left} ${ground} V${gutter} ${spans.map(([x0, x1]) => `L${(x0 + x1) / 2} ${ridge} L${x1} ${gutter}`).join(" ")} V${ground} Z`}
        fill="var(--glass)"
        stroke="var(--frame)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {spans.map(([x0, x1], i) => (
        <g key={i}>
          <line x1={(x0 + x1) / 2} y1={ridge} x2={(x0 + x1) / 2} y2={ridge + 6} stroke="var(--frame)" strokeWidth="2" />
          {i > 0 && <line x1={x0} y1={gutter} x2={x0} y2={ground} stroke="var(--frame)" strokeWidth="1.5" strokeDasharray="3 4" />}
          {flap((x0 + x1) / 2, -1, a.ventWind, "ventWind")}
          {flap((x0 + x1) / 2, 1, a.ventLee, "ventLee")}
        </g>
      ))}

      {/* lamps */}
      {ph.hasLamps && (
        <g {...hit("lamps", t("var.lamps"))}>
          {Array.from({ length: 8 }, (_, i) => {
            const x = left + 37 + i * 75;
            return (
              <g key={i}>
                {a.lamps > 0 && <ellipse cx={x} cy={232} rx="44" ry="60" fill="url(#glow)" />}
                <rect x={x - 12} y={196} width="24" height="6" rx="2" fill={a.lamps > 0 ? "var(--lamp)" : "var(--frame)"} stroke={sel("lamps") ? "var(--focus)" : "none"} strokeWidth="2" />
              </g>
            );
          })}
        </g>
      )}

      {/* screens */}
      <g {...hit("energyScreen", t("var.energyScreen"))}>
        <rect x={left} y={176} width={right - left} height="14" fill="transparent" />
        <line x1={left + 2} y1={182} x2={left + 2 + ((right - left - 4) * a.energyScreen) / 100} y2={182} stroke={manual.has("energyScreen") ? "#6250d6" : "var(--screen)"} strokeWidth={sel("energyScreen") ? 6 : 4} strokeLinecap="round" />
      </g>
      <g {...hit("shadeScreen", t("var.shadeScreen"))}>
        <rect x={left} y={186} width={right - left} height="10" fill="transparent" />
        <line x1={left + 2} y1={190} x2={left + 2 + ((right - left - 4) * a.shadeScreen) / 100} y2={190} stroke={manual.has("shadeScreen") ? "#6250d6" : "var(--shade)"} strokeWidth={sel("shadeScreen") ? 5 : 3} strokeDasharray="7 4" strokeLinecap="round" />
      </g>

      {/* crop */}
      <g {...hit("climate", t("sec.climate"))}>
        {Array.from({ length: rows }, (_, i) => {
          const x = left + i * rowW + rowW / 2;
          return (
            <g key={i}>
              <rect x={x - 11} y={plantsY - plantH} width="22" height={plantH} rx="10" fill={i % 2 ? "var(--plant)" : "var(--plant-2)"} />
              <line x1={x} y1={plantsY - plantH - 6} x2={x} y2={plantsY} stroke="var(--plant-2)" strokeWidth="1" />
            </g>
          );
        })}
      </g>

      {/* CO2 dosing */}
      {a.co2Valve > 1 && (
        <g pointerEvents="none">
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} className="rise" style={{ animationDelay: `${i * 0.27}s` }} cx={left + 30 + i * 66} cy={plantsY - 20} r={2.5} fill="var(--s7)" opacity="0.7" />
          ))}
        </g>
      )}

      {/* fog */}
      {ph.hasFog && (
        <g {...hit("fog", t("var.fog"))}>
          {Array.from({ length: 6 }, (_, i) => {
            const x = left + 50 + i * 100;
            return (
              <g key={i}>
                <circle cx={x} cy={205} r="3" fill={a.fog > 0 ? "#5fa8d3" : "var(--frame)"} />
                {a.fog > 0 && <circle className="rise" style={{ animationDelay: `${i * 0.3}s` }} cx={x} cy={214} r="9" fill="#5fa8d3" opacity="0.25" />}
              </g>
            );
          })}
        </g>
      )}

      {/* heating pipes */}
      <g {...hit("pipe", t("var.pipe"))}>
        <rect x={left} y={ground - 12} width={right - left} height="16" fill="transparent" />
        {Array.from({ length: rows }, (_, i) => {
          const x = left + i * rowW;
          return (
            <g key={i}>
              <circle cx={x + 6} cy={ground - 4} r="4" fill={pipeColor} stroke={sel("pipe") ? "var(--focus)" : "none"} strokeWidth="2" />
              <circle cx={x + rowW - 6} cy={ground - 4} r="4" fill={pipeColor} stroke={sel("pipe") ? "var(--focus)" : "none"} strokeWidth="2" />
            </g>
          );
        })}
      </g>

      {/* pad wall & fans */}
      {ph.hasPadFan && (
        <>
          <g {...hit("pad", t("var.pad"))}>
            <rect x={left - 10} y={200} width="10" height={ground - 205} fill="url(#pad)" stroke={sel("pad") ? "var(--focus)" : "#5fa8d3"} strokeWidth={sel("pad") ? 2 : 1} opacity={a.pad > 0 ? 1 : 0.45} />
          </g>
          <g {...hit("fans", t("var.fans"))}>
            {[230, 280].map((y) => (
              <g key={y} transform={`translate(${right + 9} ${y})`}>
                <circle r="13" fill="var(--surface)" stroke={sel("fans") ? "var(--focus)" : "var(--frame)"} strokeWidth="2" />
                <g className={a.fans > 0 ? "spin" : ""}>
                  {[0, 120, 240].map((r) => (
                    <path key={r} d="M0 0 C 3 -4, 3 -9, 0 -11 C -3 -9, -3 -4, 0 0" fill={manual.has("fans") ? "#6250d6" : "var(--s1)"} transform={`rotate(${r})`} />
                  ))}
                </g>
              </g>
            ))}
          </g>
        </>
      )}

      {/* value chips */}
      <g {...hit("climate", t("sec.climate"))}>{chip(W / 2, 148, `${fmt(L.phys.temp, 1)}°C · ${fmt(L.rh, 0)}% · ${fmt(L.phys.co2, 0)} ppm`, { k: "climate" })}</g>
      {chip((left + (left + right) / 2) / 2 + 40, 100, `${fmt(a.ventLee, 0)}% / ${fmt(a.ventWind, 0)}%`, { k: "ventLee", manual: manual.has("ventLee") || manual.has("ventWind") })}
      {a.energyScreen > 0.5 || a.shadeScreen > 0.5
        ? chip(right - 50, 206, `${fmt(Math.max(a.energyScreen, a.shadeScreen), 0)}%`, { k: "energyScreen", manual: manual.has("energyScreen") || manual.has("shadeScreen") })
        : null}
      {chip(left + 64, ground - 24, `${fmt(L.phys.pipeT, 0)}°C`, { k: "pipe", manual: manual.has("pipe") })}
      {a.co2Valve > 1 && chip(W / 2, ground - 50, `CO₂ ${fmt(a.co2Valve, 0)}%`, { k: "co2Valve", manual: manual.has("co2Valve") })}
      {ph.hasPadFan && a.fans > 0 && chip(right - 20, 256, `${fmt(a.fans, 0)}%`, { k: "fans", manual: manual.has("fans"), anchor: "end" })}
    </svg>
  );
}
