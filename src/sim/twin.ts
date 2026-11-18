// The digital twin: runs the real control engine against simulated physics for every section,
// records history, raises alarms, runs irrigation and energy bookkeeping.
import { control, newCtrlState } from "@/engine/control";
import { hd as hdOf, rhFromAh, vpd as vpdOf } from "@/engine/psy";
import { localTime, type LocalTime } from "@/engine/sun";
import type { ActuatorKey, ControlResult, CtrlState, Outputs, Strategy } from "@/engine/types";
import { initPhys, stepPhysics, type PhysState, type StepFlux } from "./greenhouse";
import { SECTIONS, SITE, type AlarmRule, type AlarmVar, type IrrigationSettings, type Priority, type SectionDef } from "./seed";
import { noise, weatherAt, type WeatherPoint } from "./weather";

export const SAMPLE_MS = 5 * 60000;
export const STEP_S = 30;
export const MAX_SAMPLES = 7 * 24 * 12;

export const SECTION_KEYS = [
  "temp", "rh", "hd", "vpd", "co2", "par", "pipe", "heatSp", "ventSp", "co2Sp", "rhMax",
  "ventLee", "ventWind", "energyScreen", "shadeScreen", "lamps", "co2Valve", "fans", "fog",
  "heatKw", "radSum", "ec", "ph", "drain", "water", "dli",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const OUTSIDE_KEYS = ["outTemp", "outRh", "radiation", "wind", "gas", "elec"] as const;
export type OutsideKey = (typeof OUTSIDE_KEYS)[number];

export interface StrategyVersion {
  id?: string;
  version: number;
  doc: Strategy;
  note: string;
  createdAt: number;
  activeFrom: number;
  author: string;
  source: "seed" | "manual" | "recipe" | "rollback";
}

export interface Override {
  id: string;
  sectionId: string;
  actuator: ActuatorKey;
  value: number;
  from: number;
  until: number;
  by: string;
  cancelledAt?: number;
}

export interface Alarm {
  id: string;
  ruleId: string;
  ruleName: string;
  sectionId: string; // section id or "site"
  priority: Priority;
  variable: AlarmVar;
  condition: AlarmRule["condition"];
  threshold: number;
  value: number;
  raisedAt: number;
  clearedAt?: number;
}

export interface Totals {
  gasM3: number;
  elecKwh: number;
  co2Kg: number;
  waterLm2: number;
  transpLm2: number;
  radSum: number; // J/cm² today (outside)
}

export interface IrrState {
  radSinceLast: number;
  lastStartT: number;
  starts: number;
  ec: number;
  ph: number;
  drain: number;
}

export interface IrrEvent {
  sectionId: string;
  t: number;
  ml: number;
  ec: number;
  ph: number;
}

export interface SectionLive {
  def: SectionDef;
  phys: PhysState;
  ctrl: ControlResult;
  target: Outputs;
  flux: StepFlux;
  rh: number;
  hd: number;
  vpd: number;
  totals: Totals;
  irr: IrrState;
  overrides: Override[];
  version: number;
  dayKey: string;
}

export interface TwinConfig {
  versions: (sectionId: string) => StrategyVersion[];
  overrides: () => Override[];
  rules: () => AlarmRule[];
  irrigation: (sectionId: string) => IrrigationSettings;
}

export interface History {
  t: number[];
  sec: Record<string, Record<SectionKey, number[]>>;
  out: Record<OutsideKey, number[]>;
}

const emptyTotals = (): Totals => ({ gasM3: 0, elecKwh: 0, co2Kg: 0, waterLm2: 0, transpLm2: 0, radSum: 0 });

export function activeVersion(list: StrategyVersion[], t: number): StrategyVersion {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].activeFrom <= t) return list[i];
  return list[0];
}

export function activeOverrides(list: Override[], sectionId: string, t: number) {
  return list.filter((o) => o.sectionId === sectionId && o.from <= t && t < o.until && !(o.cancelledAt !== undefined && o.cancelledAt <= t));
}

function inWindow(m: number, from: string, to: string) {
  if (!from || !to) return true;
  const p = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const a = p(from),
    b = p(to);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

function applyCapabilities(def: SectionDef, ctrl: ControlResult, o: Outputs): Outputs {
  const x = { ...o };
  const na = (k: ActuatorKey) => {
    x[k] = 0;
    ctrl.reasons[k] = [{ code: "r.notInstalled" }];
  };
  if (!def.phys.hasPadFan) {
    na("fans");
    na("pad");
  }
  if (!def.phys.hasLamps) na("lamps");
  if (!def.phys.hasFog) na("fog");
  return x;
}

export class Twin {
  t: number;
  cfg: TwinConfig;
  live: Record<string, SectionLive> = {};
  outside!: WeatherPoint;
  lt!: LocalTime;
  history: History;
  alarms: Alarm[] = [];
  irrEvents: IrrEvent[] = [];
  ctrlStates: Record<string, CtrlState> = {};
  private pending = new Map<string, number>();
  private open = new Map<string, Alarm>();
  private lastMinute = -1;
  private nextSample: number;
  private siteGas = 0;
  private siteElec = 0;

  constructor(cfg: TwinConfig, start: number) {
    this.cfg = cfg;
    this.t = start;
    this.nextSample = Math.ceil(start / SAMPLE_MS) * SAMPLE_MS;
    const out = weatherAt(start, SITE.geo);
    this.outside = out;
    this.lt = localTime(start, SITE.geo.tz, SITE.geo.lat, SITE.geo.lon);
    this.history = { t: [], sec: {}, out: {} as History["out"] };
    for (const k of OUTSIDE_KEYS) this.history.out[k] = [];
    for (const def of SECTIONS) {
      const h = {} as Record<SectionKey, number[]>;
      for (const k of SECTION_KEYS) h[k] = [];
      this.history.sec[def.id] = h;
      const phys = initPhys(out);
      this.ctrlStates[def.id] = newCtrlState(this.lt.dayKey);
      const irr = this.cfg.irrigation(def.id);
      this.live[def.id] = {
        def,
        phys,
        ctrl: undefined as unknown as ControlResult,
        target: phys.act,
        flux: { radIn: 0, par: 0, heatW: 0, lampW: 0, fanW: 0, co2Dose: 0, transp: 0 },
        rh: 80,
        hd: 3,
        vpd: 0.5,
        totals: emptyTotals(),
        irr: { radSinceLast: 0, lastStartT: 0, starts: 0, ec: irr.ecTarget, ph: irr.phTarget, drain: 0 },
        overrides: [],
        version: 1,
        dayKey: this.lt.dayKey,
      };
    }
    this.step(0);
  }

  /** Advance simulation time to `to`, in fixed steps. */
  advanceTo(to: number) {
    while (this.t < to) {
      const dt = Math.min(STEP_S, (to - this.t) / 1000);
      if (dt <= 0.001) break;
      this.t += dt * 1000;
      this.step(dt);
    }
  }

  private step(dt: number) {
    const t = this.t;
    const out = weatherAt(t, SITE.geo);
    this.outside = out;
    const lt = localTime(t, SITE.geo.tz, SITE.geo.lat, SITE.geo.lon);
    this.lt = lt;
    const overrides = this.cfg.overrides();
    let gasM3h = 0;
    let elecKw = 0;

    for (const def of SECTIONS) {
      const L = this.live[def.id];
      const ver = activeVersion(this.cfg.versions(def.id), t);
      const doc = ver.doc;
      L.version = ver.version;
      if (L.dayKey !== lt.dayKey) {
        L.dayKey = lt.dayKey;
        L.totals = emptyTotals();
        L.irr = { ...L.irr, starts: 0, radSinceLast: 0, drain: 0 };
      }
      const rh = rhFromAh(L.phys.temp, L.phys.ah);
      const ctrl = control(
        doc,
        {
          t,
          minuteOfDay: lt.minuteOfDay,
          sunriseMin: lt.sunriseMin,
          sunsetMin: lt.sunsetMin,
          outside: out,
          inside: {
            temp: L.phys.temp,
            rh,
            co2: L.phys.co2,
            vents: Math.max(L.phys.act.ventLee, L.phys.act.ventWind),
            energyScreen: L.phys.act.energyScreen,
          },
        },
        this.ctrlStates[def.id],
        lt.dayKey,
        L.flux.par,
        dt,
      );
      this.ctrlStates[def.id] = ctrl.state;
      let target = applyCapabilities(def, ctrl, ctrl.outputs);
      const ov = activeOverrides(overrides, def.id, t);
      if (ov.length) {
        target = { ...target };
        for (const o of ov) {
          target[o.actuator] = o.value;
          ctrl.reasons[o.actuator] = [{ code: "r.manual", params: { v: Math.round(o.value), by: o.by, until: o.until } }, ...(ctrl.reasons[o.actuator] ?? []).map((r) => ({ ...r, code: r.code, params: { ...r.params, auto: 1 } }))];
        }
      }
      L.overrides = ov;
      L.ctrl = ctrl;
      L.target = target;

      if (dt > 0) {
        const r = stepPhysics(L.phys, target, out, def.phys, doc.co2.maxDoseGm2h, dt);
        L.phys = r.state;
        L.flux = r.flux;
      }
      L.rh = rhFromAh(L.phys.temp, L.phys.ah);
      L.hd = hdOf(L.phys.temp, L.rh);
      L.vpd = vpdOf(L.phys.temp, L.rh);

      // bookkeeping
      const heatKw = (L.flux.heatW * def.area) / 1000;
      const lampKw = (L.flux.lampW * def.area) / 1000;
      const fanKw = (L.flux.fanW * def.area) / 1000;
      gasM3h += heatKw / 8.99;
      elecKw += lampKw + fanKw;
      if (dt > 0) {
        const h = dt / 3600;
        L.totals.gasM3 += (heatKw / 8.99) * h;
        L.totals.elecKwh += (lampKw + fanKw) * h;
        L.totals.co2Kg += (L.flux.co2Dose * def.area * dt) / 1000;
        L.totals.transpLm2 += (L.flux.transp * dt) / 1000;
        L.totals.radSum += (out.radiation * dt) / 10000;
        this.irrigate(def, L, out.radiation, dt, lt);
      }
    }
    this.siteGas = gasM3h;
    this.siteElec = elecKw;

    const minute = Math.floor(t / 60000);
    if (minute !== this.lastMinute) {
      this.lastMinute = minute;
      this.evalAlarms(t, lt.minuteOfDay);
    }
    if (t >= this.nextSample) {
      this.sample(this.nextSample);
      this.nextSample += SAMPLE_MS;
    }
  }

  private irrigate(def: SectionDef, L: SectionLive, rad: number, dt: number, lt: LocalTime) {
    const s = this.cfg.irrigation(def.id);
    L.irr.radSinceLast += (rad * dt) / 10000;
    if (!s.enabled) return;
    const m = lt.minuteOfDay;
    const open = m >= lt.sunriseMin + s.windowStartAfterSunrise && m <= lt.sunsetMin - s.windowEndBeforeSunset;
    if (!open) return;
    const sinceMin = (this.t - L.irr.lastStartT) / 60000;
    if (sinceMin < s.minIntervalMin) return;
    if (L.irr.starts === 0 || L.irr.radSinceLast >= s.startRadSum) this.startIrrigation(def.id, s.doseMl);
  }

  startIrrigation(sectionId: string, ml: number) {
    const L = this.live[sectionId];
    const s = this.cfg.irrigation(sectionId);
    const t = this.t;
    L.irr.starts += 1;
    L.irr.radSinceLast = 0;
    L.irr.lastStartT = t;
    L.irr.ec = s.ecTarget + (noise(t, 0.4, 31) - 0.5) * 0.12;
    L.irr.ph = s.phTarget + (noise(t, 0.4, 32) - 0.5) * 0.2;
    L.totals.waterLm2 += (ml * s.drippersPerM2) / 1000;
    const given = L.totals.waterLm2;
    L.irr.drain = given > 0 ? Math.max(0, Math.min(65, ((given - L.totals.transpLm2 - 0.35) / given) * 100)) : 0;
    this.irrEvents.push({ sectionId, t, ml, ec: L.irr.ec, ph: L.irr.ph });
    if (this.irrEvents.length > 2000) this.irrEvents.splice(0, 500);
  }

  valueOf(sectionId: string, v: AlarmVar): number {
    if (v === "outsideTemp") return this.outside.temp;
    if (v === "wind") return this.outside.wind;
    const L = this.live[sectionId];
    switch (v) {
      case "temp":
        return L.phys.temp;
      case "rh":
        return L.rh;
      case "hd":
        return L.hd;
      case "co2":
        return L.phys.co2;
      case "pipe":
        return L.phys.pipeT;
    }
  }

  private evalAlarms(t: number, m: number) {
    for (const rule of this.cfg.rules()) {
      const siteVar = rule.variable === "outsideTemp" || rule.variable === "wind";
      const targets = siteVar ? ["site"] : rule.sectionId === "all" ? SECTIONS.map((s) => s.id) : [rule.sectionId];
      for (const sid of targets) {
        const key = `${rule.id}|${sid}`;
        const openA = this.open.get(key);
        if (!rule.enabled || !inWindow(m, rule.activeFrom, rule.activeTo)) {
          this.pending.delete(key);
          if (openA) {
            openA.clearedAt = t;
            this.open.delete(key);
          }
          continue;
        }
        const val = this.valueOf(siteVar ? SECTIONS[0].id : sid, rule.variable);
        let metric = val;
        if (rule.condition === "deviation") metric = this.live[sid].ctrl.setpoints.heat - val;
        const bad = rule.condition === "below" ? metric < rule.threshold : metric > rule.threshold;
        const clear =
          rule.condition === "below" ? metric > rule.threshold + rule.hysteresis : metric < rule.threshold - rule.hysteresis;
        if (openA) {
          openA.value = val;
          if (clear) {
            openA.clearedAt = t;
            this.open.delete(key);
          }
          continue;
        }
        if (bad) {
          const n = (this.pending.get(key) ?? 0) + 1;
          this.pending.set(key, n);
          if (n >= rule.delayMin) {
            const a: Alarm = {
              id: `${key}|${t}`,
              ruleId: rule.id,
              ruleName: rule.name,
              sectionId: sid,
              priority: rule.priority,
              variable: rule.variable,
              condition: rule.condition,
              threshold: rule.threshold,
              value: val,
              raisedAt: t,
            };
            this.alarms.push(a);
            this.open.set(key, a);
            this.pending.delete(key);
            if (this.alarms.length > 600) this.alarms.splice(0, 100);
          }
        } else this.pending.delete(key);
      }
    }
  }

  private sample(ts: number) {
    const H = this.history;
    H.t.push(ts);
    const o = this.outside;
    H.out.outTemp.push(o.temp);
    H.out.outRh.push(o.rh);
    H.out.radiation.push(o.radiation);
    H.out.wind.push(o.wind);
    H.out.gas.push(this.siteGas);
    H.out.elec.push(this.siteElec);
    for (const def of SECTIONS) {
      const L = this.live[def.id];
      const h = H.sec[def.id];
      const sp = L.ctrl.setpoints;
      const a = L.phys.act;
      h.temp.push(L.phys.temp);
      h.rh.push(L.rh);
      h.hd.push(L.hd);
      h.vpd.push(L.vpd);
      h.co2.push(L.phys.co2);
      h.par.push(L.flux.par);
      h.pipe.push(L.phys.pipeT);
      h.heatSp.push(sp.heat);
      h.ventSp.push(sp.vent);
      h.co2Sp.push(sp.co2);
      h.rhMax.push(sp.rhMax);
      h.ventLee.push(a.ventLee);
      h.ventWind.push(a.ventWind);
      h.energyScreen.push(a.energyScreen);
      h.shadeScreen.push(a.shadeScreen);
      h.lamps.push(a.lamps);
      h.co2Valve.push(a.co2Valve);
      h.fans.push(a.fans);
      h.fog.push(a.fog);
      h.heatKw.push((L.flux.heatW * def.area) / 1000);
      h.radSum.push(L.totals.radSum);
      h.ec.push(L.irr.ec);
      h.ph.push(L.irr.ph);
      h.drain.push(L.irr.drain);
      h.water.push(L.totals.waterLm2);
      h.dli.push(L.ctrl.state.dli);
    }
    if (H.t.length > MAX_SAMPLES + 100) {
      const n = H.t.length - MAX_SAMPLES;
      H.t.splice(0, n);
      for (const k of OUTSIDE_KEYS) H.out[k].splice(0, n);
      for (const def of SECTIONS) for (const k of SECTION_KEYS) H.sec[def.id][k].splice(0, n);
    }
  }

  get siteNow() {
    return { gasM3h: this.siteGas, elecKw: this.siteElec };
  }
}

/** Run one section forward on the forecast with a given strategy. Used by the strategy preview. */
export function forecastRun(L: SectionLive, ctrlState: CtrlState, doc: Strategy, from: number, hours: number) {
  let phys: PhysState = JSON.parse(JSON.stringify(L.phys));
  let cs: CtrlState = { ...ctrlState };
  let par = L.flux.par;
  const dt = 60;
  const res = { t: [] as number[], temp: [] as number[], rh: [] as number[], co2: [] as number[], heatSp: [] as number[], ventSp: [] as number[], vents: [] as number[], pipe: [] as number[], screen: [] as number[], gasM3: 0, co2Kg: 0, elecKwh: 0, maxT: -99, minT: 99, hoursHumid: 0 };
  const steps = (hours * 3600) / dt;
  for (let i = 0; i <= steps; i++) {
    const t = from + i * dt * 1000;
    const lead = (t - from) / 3600000;
    const out = weatherAt(t, SITE.geo, lead);
    const lt = localTime(t, SITE.geo.tz, SITE.geo.lat, SITE.geo.lon);
    const rh = rhFromAh(phys.temp, phys.ah);
    const ctrl = control(
      doc,
      {
        t,
        minuteOfDay: lt.minuteOfDay,
        sunriseMin: lt.sunriseMin,
        sunsetMin: lt.sunsetMin,
        outside: out,
        inside: { temp: phys.temp, rh, co2: phys.co2, vents: Math.max(phys.act.ventLee, phys.act.ventWind), energyScreen: phys.act.energyScreen },
      },
      cs,
      lt.dayKey,
      par,
      dt,
    );
    cs = ctrl.state;
    const target = applyCapabilities(L.def, ctrl, ctrl.outputs);
    const r = stepPhysics(phys, target, out, L.def.phys, doc.co2.maxDoseGm2h, dt);
    phys = r.state;
    par = r.flux.par;
    res.gasM3 += ((r.flux.heatW * L.def.area) / 1000 / 8.99) * (dt / 3600);
    res.co2Kg += (r.flux.co2Dose * L.def.area * dt) / 1000;
    res.elecKwh += (((r.flux.lampW + r.flux.fanW) * L.def.area) / 1000) * (dt / 3600);
    const rhNow = rhFromAh(phys.temp, phys.ah);
    res.maxT = Math.max(res.maxT, phys.temp);
    res.minT = Math.min(res.minT, phys.temp);
    if (rhNow > ctrl.setpoints.rhMax) res.hoursHumid += dt / 3600;
    if (i % 10 === 0) {
      res.t.push(t);
      res.temp.push(phys.temp);
      res.rh.push(rhNow);
      res.co2.push(phys.co2);
      res.heatSp.push(ctrl.setpoints.heat);
      res.ventSp.push(ctrl.setpoints.vent);
      res.vents.push(Math.max(phys.act.ventLee, phys.act.ventWind));
      res.pipe.push(phys.pipeT);
      res.screen.push(phys.act.energyScreen);
    }
  }
  return res;
}
export type ForecastRun = ReturnType<typeof forecastRun>;
