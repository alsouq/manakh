// The control engine: strategy + measurements -> setpoints, actuator targets, and the reasons why.
// Pure and deterministic. The same function drives the live twin, the 24 h preview and (later) the edge box.

import type {
  ActuatorKey,
  Breakdown,
  BreakdownItem,
  ControlResult,
  CtrlState,
  Influence,
  InfluenceSource,
  Inputs,
  Outputs,
  Period,
  Reason,
  SetpointKey,
  Strategy,
} from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

export function interpolate(points: [number, number][], x: number): number {
  if (!points.length) return 0;
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) {
      const [x0, y0] = pts[i - 1];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

export function periodStart(p: Period, sunriseMin: number, sunsetMin: number): number {
  const base = p.ref === "sunrise" ? sunriseMin : p.ref === "sunset" ? sunsetMin : 0;
  return (((base + p.offsetMin) % 1440) + 1440) % 1440;
}

/** Active period index and the ramped period values at minuteOfDay. */
export function resolvePeriod(s: Strategy, minuteOfDay: number, sunriseMin: number, sunsetMin: number) {
  const ps = s.periods
    .map((p, i) => ({ p, i, start: periodStart(p, sunriseMin, sunsetMin) }))
    .sort((a, b) => a.start - b.start);
  let idx = ps.length - 1;
  for (let k = 0; k < ps.length; k++) if (ps[k].start <= minuteOfDay) idx = k;
  const cur = ps[idx];
  const prev = ps[(idx - 1 + ps.length) % ps.length];
  const elapsed = (minuteOfDay - cur.start + 1440) % 1440;
  const f = cur.p.rampMin > 0 && elapsed < cur.p.rampMin ? elapsed / cur.p.rampMin : 1;
  const mix = (k: "heat" | "vent" | "rhMax" | "co2") => prev.p[k] + (cur.p[k] - prev.p[k]) * f;
  return {
    index: cur.i,
    period: cur.p,
    ramping: f < 1,
    values: {
      heat: mix("heat"),
      vent: mix("vent"),
      rhMax: mix("rhMax"),
      co2: cur.p.co2 === 0 ? 0 : prev.p.co2 === 0 ? cur.p.co2 : mix("co2"),
    },
    starts: ps.map((x) => ({ index: x.i, start: x.start })),
  };
}

function sourceValue(src: InfluenceSource, inp: Inputs, rhMax: number): number {
  switch (src) {
    case "radiation":
      return inp.outside.radiation;
    case "outsideTemp":
      return inp.outside.temp;
    case "wind":
      return inp.outside.wind;
    case "rhExcess":
      return inp.inside.rh - rhMax;
  }
}

function applyInfluences(
  key: "heat" | "vent" | "co2",
  base: number,
  infl: Influence[],
  inp: Inputs,
  rhMax: number,
): { value: number; items: BreakdownItem[] } {
  let value = base;
  const items: BreakdownItem[] = [];
  for (const f of infl) {
    if (!f.enabled || f.target !== key) continue;
    const x = sourceValue(f.source, inp, rhMax);
    const d = interpolate(f.points, x);
    if (Math.abs(d) < 0.005) continue;
    value += d;
    items.push({ code: `inf.${f.source}`, delta: d, params: { x: r1(x) } });
  }
  return { value, items };
}

export function newCtrlState(dayKey: string): CtrlState {
  return { dayKey, dli: 0, lampsOn: false };
}

/**
 * Compute setpoints and actuator targets.
 * @param parDli µmol/m²/s PAR at crop this step, for daily light integral bookkeeping
 * @param dtSec step length for DLI accumulation
 */
export function control(
  s: Strategy,
  inp: Inputs,
  prev: CtrlState,
  dayKey: string,
  parAtCrop = 0,
  dtSec = 0,
): ControlResult {
  const state: CtrlState = prev.dayKey === dayKey ? { ...prev } : newCtrlState(dayKey);
  state.dli += (parAtCrop * dtSec) / 1e6;

  const per = resolvePeriod(s, inp.minuteOfDay, inp.sunriseMin, inp.sunsetMin);
  const pv = per.values;
  const name = per.period.name;
  const { inside: ins, outside: out } = inp;

  // --- setpoints with breakdown ---
  const heatInf = applyInfluences("heat", pv.heat, s.influences, inp, pv.rhMax);
  const heat = heatInf.value;

  const ventInf = applyInfluences("vent", pv.vent, s.influences, inp, pv.rhMax);
  let vent = ventInf.value;
  const ventItems = [...ventInf.items];
  if (vent < heat + 0.5) {
    ventItems.push({ code: "inf.deadzone", delta: heat + 0.5 - vent });
    vent = heat + 0.5;
  }

  const co2Inf = applyInfluences("co2", pv.co2, s.influences, inp, pv.rhMax);
  let co2 = pv.co2 > 0 ? co2Inf.value : 0;
  const co2Items = pv.co2 > 0 ? [...co2Inf.items] : [];
  if (co2 > 0 && out.radiation < s.co2.minRadiation) {
    co2Items.push({ code: "inf.co2Dark", delta: -co2, params: { x: Math.round(out.radiation) } });
    co2 = 0;
  } else if (co2 > 0 && s.co2.reduceFullAtVent > 0 && ins.vents > 0) {
    const f = clamp(ins.vents / s.co2.reduceFullAtVent, 0, 1);
    const d = -(co2 - Math.min(co2, 450)) * f;
    if (Math.abs(d) > 1) {
      co2Items.push({ code: "inf.co2Vents", delta: d, params: { x: Math.round(ins.vents) } });
      co2 += d;
    }
  }

  const breakdown: Record<SetpointKey, Breakdown> = {
    heat: { key: "heat", periodName: name, base: pv.heat, items: heatInf.items, result: heat },
    vent: { key: "vent", periodName: name, base: pv.vent, items: ventItems, result: vent },
    co2: { key: "co2", periodName: name, base: pv.co2, items: co2Items, result: co2 },
    rhMax: { key: "rhMax", periodName: name, base: pv.rhMax, items: [], result: pv.rhMax },
  };
  if (per.ramping) {
    for (const k of ["heat", "vent", "co2", "rhMax"] as const)
      breakdown[k].items.unshift({ code: "inf.ramp", delta: 0, params: { p: name } });
  }

  const reasons = {} as Record<ActuatorKey, Reason[]>;
  const o = {} as Outputs;
  const humid = ins.rh > pv.rhMax;

  // --- cooling (pad & fan) decides first, it closes the vents ---
  o.fans = 0;
  o.pad = 0;
  reasons.fans = [];
  reasons.pad = [];
  if (s.cooling.padFanEnabled && ins.temp > s.cooling.padStart) {
    o.fans = clamp(((ins.temp - s.cooling.padStart) / 2) * 100, 20, 100);
    o.pad = o.fans > 30 ? 100 : 0;
    reasons.fans.push({ code: "r.fansHot", params: { t: r1(ins.temp), sp: s.cooling.padStart } });
    reasons.pad.push({ code: o.pad ? "r.padOn" : "r.padWait" });
  } else {
    reasons.fans.push({ code: s.cooling.padFanEnabled ? "r.fansIdle" : "r.disabled", params: { sp: s.cooling.padStart } });
    reasons.pad.push({ code: s.cooling.padFanEnabled ? "r.padIdle" : "r.disabled" });
  }

  // --- ventilation ---
  const v = s.ventilation;
  reasons.ventLee = [];
  reasons.ventWind = [];
  let lee = clamp(((ins.temp - vent) / Math.max(0.5, v.pBand)) * 100, 0, 100);
  if (lee > 0) reasons.ventLee.push({ code: "r.ventTemp", params: { t: r1(ins.temp), sp: r1(vent), pb: v.pBand } });
  else reasons.ventLee.push({ code: "r.ventBelow", params: { t: r1(ins.temp), sp: r1(vent) } });
  if (humid) {
    const hv = clamp((ins.rh - pv.rhMax) * v.humVentPerPct, 0, v.humVentMax);
    if (hv > lee) {
      lee = hv;
      reasons.ventLee.push({ code: "r.ventHumid", params: { rh: Math.round(ins.rh), max: Math.round(pv.rhMax) } });
    }
  }
  if (v.minVent > lee) {
    lee = v.minVent;
    reasons.ventLee.push({ code: "r.ventMin", params: { v: v.minVent } });
  }
  if (lee > v.maxVent) {
    lee = v.maxVent;
    reasons.ventLee.push({ code: "r.ventMax", params: { v: v.maxVent } });
  }
  let wind = clamp((lee - 50) * 2, 0, 100);
  if (wind > 0) reasons.ventWind.push({ code: "r.windSideFollows" });
  else reasons.ventWind.push({ code: "r.windSideWaits" });
  if (out.wind > v.windLimit) {
    wind = 0;
    reasons.ventWind.push({ code: "r.windLimit", params: { w: r1(out.wind), max: v.windLimit } });
    if (out.wind > v.windLimit + 4 && lee > 30) {
      lee = 30;
      reasons.ventLee.push({ code: "r.windLimitLee", params: { w: r1(out.wind) } });
    }
  }
  if (o.fans > 0) {
    lee = 0;
    wind = 0;
    reasons.ventLee.push({ code: "r.ventPadFan" });
    reasons.ventWind.push({ code: "r.ventPadFan" });
  }
  o.ventLee = lee;
  o.ventWind = wind;

  // --- screens ---
  const sc = s.screens;
  reasons.energyScreen = [];
  reasons.shadeScreen = [];
  o.energyScreen = 0;
  if (sc.energyEnabled && out.radiation < sc.energyCloseBelowRad && out.temp < sc.energyCloseBelowOutT) {
    o.energyScreen = 100;
    reasons.energyScreen.push({
      code: "r.screenNight",
      params: { rad: Math.round(out.radiation), t: r1(out.temp), maxT: sc.energyCloseBelowOutT },
    });
    if (humid && sc.energyGapOnHumidity > 0) {
      o.energyScreen = 100 - sc.energyGapOnHumidity;
      reasons.energyScreen.push({ code: "r.screenGap", params: { g: sc.energyGapOnHumidity } });
    }
  } else {
    reasons.energyScreen.push({ code: sc.energyEnabled ? "r.screenOpen" : "r.disabled" });
  }
  o.shadeScreen = 0;
  if (sc.shadeEnabled && out.radiation > sc.shadeAboveRad) {
    o.shadeScreen = clamp(((out.radiation - sc.shadeAboveRad) / 200) * sc.shadeMax, 0, sc.shadeMax);
    reasons.shadeScreen.push({ code: "r.shadeSun", params: { rad: Math.round(out.radiation), th: sc.shadeAboveRad } });
  } else {
    reasons.shadeScreen.push({ code: sc.shadeEnabled ? "r.shadeOpen" : "r.disabled", params: { th: sc.shadeAboveRad } });
  }

  // --- heating (pipe temperature) ---
  const h = s.heating;
  reasons.pipe = [];
  const screenFactor = 2.4 - 1.0 * (ins.energyScreen / 100);
  const ff = Math.max(0, heat - out.temp) * screenFactor;
  const demand = heat - ins.temp;
  let pipe = heat + ff + 10 * demand;
  let minPipe = h.minPipe;
  if (humid && h.minPipeOnHumidity > minPipe) {
    minPipe = h.minPipeOnHumidity;
  }
  if (pipe < ins.temp + 3) {
    pipe = 0;
    reasons.pipe.push({ code: "r.pipeOff", params: { t: r1(ins.temp), sp: r1(heat) } });
  } else {
    reasons.pipe.push({ code: "r.pipeHeat", params: { t: r1(ins.temp), sp: r1(heat), out: r1(out.temp) } });
  }
  if (minPipe > 0 && pipe < minPipe) {
    pipe = minPipe;
    reasons.pipe.push({
      code: humid && minPipe === h.minPipeOnHumidity ? "r.pipeMinHumid" : "r.pipeMin",
      params: { v: minPipe },
    });
  }
  if (pipe > h.maxPipe) {
    pipe = h.maxPipe;
    reasons.pipe.push({ code: "r.pipeMax", params: { v: h.maxPipe } });
  }
  o.pipe = pipe;

  // --- CO2 ---
  reasons.co2Valve = [];
  if (co2 > 0) {
    o.co2Valve = clamp(((co2 - ins.co2) / 150) * 100, 0, 100);
    reasons.co2Valve.push({ code: o.co2Valve > 0 ? "r.co2Dose" : "r.co2Reached", params: { c: Math.round(ins.co2), sp: Math.round(co2) } });
  } else {
    o.co2Valve = 0;
    reasons.co2Valve.push({ code: "r.co2Off" });
  }

  // --- lighting ---
  const L = s.lighting;
  reasons.lamps = [];
  let lampsOn = state.lampsOn;
  if (!L.enabled) {
    lampsOn = false;
    reasons.lamps.push({ code: "r.disabled" });
  } else if (!per.period.lamps) {
    lampsOn = false;
    reasons.lamps.push({ code: "r.lampsPeriod", params: { p: name } });
  } else if (state.dli >= L.targetDli) {
    lampsOn = false;
    reasons.lamps.push({ code: "r.lampsDli", params: { d: r1(state.dli), max: L.targetDli } });
  } else if (out.radiation > L.offAboveRad) {
    lampsOn = false;
    reasons.lamps.push({ code: "r.lampsBright", params: { rad: Math.round(out.radiation), th: L.offAboveRad } });
  } else if (out.radiation < L.onBelowRad) {
    lampsOn = true;
    reasons.lamps.push({ code: "r.lampsDark", params: { rad: Math.round(out.radiation), th: L.onBelowRad, d: r1(state.dli), max: L.targetDli } });
  } else {
    reasons.lamps.push({ code: "r.lampsHyst" });
  }
  state.lampsOn = lampsOn;
  o.lamps = lampsOn ? 100 : 0;

  // --- fogging ---
  const c = s.cooling;
  reasons.fog = [];
  if (c.fogEnabled && ins.rh < c.fogBelowRh && ins.temp > c.fogAboveTemp && o.co2Valve >= 0) {
    o.fog = 100;
    reasons.fog.push({ code: "r.fogOn", params: { rh: Math.round(ins.rh), max: c.fogBelowRh, t: r1(ins.temp) } });
  } else {
    o.fog = 0;
    reasons.fog.push({ code: c.fogEnabled ? "r.fogIdle" : "r.disabled", params: { max: c.fogBelowRh, t: c.fogAboveTemp } });
  }

  return {
    periodIndex: per.index,
    periodName: name,
    setpoints: { heat, vent, co2, rhMax: pv.rhMax },
    breakdown,
    outputs: o,
    reasons,
    state,
  };
}

/** Validation: returns i18n keys of problems. */
export function validateStrategy(s: Strategy): { code: string; params?: Record<string, string | number> }[] {
  const errs: { code: string; params?: Record<string, string | number> }[] = [];
  if (s.periods.length < 1) errs.push({ code: "v.noPeriods" });
  if (s.periods.length > 6) errs.push({ code: "v.tooManyPeriods" });
  for (const p of s.periods) {
    if (p.vent < p.heat) errs.push({ code: "v.ventBelowHeat", params: { p: p.name } });
    if (p.heat < 5 || p.heat > 35) errs.push({ code: "v.heatRange", params: { p: p.name } });
    if (p.rhMax < 50 || p.rhMax > 98) errs.push({ code: "v.rhRange", params: { p: p.name } });
    if (p.co2 !== 0 && (p.co2 < 350 || p.co2 > 1500)) errs.push({ code: "v.co2Range", params: { p: p.name } });
  }
  if (s.heating.maxPipe > 90) errs.push({ code: "v.maxPipe" });
  if (s.ventilation.pBand <= 0) errs.push({ code: "v.pBand" });
  if (s.ventilation.minVent > s.ventilation.maxVent) errs.push({ code: "v.minMaxVent" });
  return errs;
}
