// A light rule-based advisor (our own heuristics, not IIVO's trained algorithms). It reads
// the current state of a section against its strategy and surfaces plain, actionable notes.
import type { SectionLive } from "@/sim/twin";

export interface Advice {
  code: string;
  params: Record<string, string | number>;
  priority: number; // 2 = act now, 1 = worth a look
  sectionId: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function advise(L: SectionLive): Advice[] {
  const out: Advice[] = [];
  const sp = L.ctrl.setpoints;
  const a = L.phys.act;
  const temp = L.phys.temp;
  const rh = L.rh;
  const vents = Math.max(a.ventLee, a.ventWind);
  const id = L.def.id;

  if (temp > sp.vent + 2.5) out.push({ code: "adv.hot", params: { t: r1(temp), sp: r1(sp.vent) }, priority: 2, sectionId: id });
  else if (temp < sp.heat - 1.5) out.push({ code: "adv.cold", params: { t: r1(temp), sp: r1(sp.heat) }, priority: 2, sectionId: id });

  if (rh > sp.rhMax + 3) out.push({ code: "adv.humid", params: { rh: Math.round(rh), max: Math.round(sp.rhMax) }, priority: 2, sectionId: id });
  else if (rh < 45 && temp > 26 && L.def.phys.hasFog && a.fog === 0) out.push({ code: "adv.dryHot", params: { rh: Math.round(rh), t: r1(temp) }, priority: 1, sectionId: id });

  if (sp.co2 > 0 && a.co2Valve > 1 && vents > 60) out.push({ code: "adv.co2Waste", params: { v: Math.round(vents) }, priority: 1, sectionId: id });

  return out;
}

/** Variant that also knows the daily light target (from the active strategy). */
export function adviseLight(L: SectionLive, minuteOfDay: number, targetDli: number): Advice[] {
  const out = advise(L);
  if (L.def.phys.hasLamps && minuteOfDay > 780 && L.ctrl.state.dli < targetDli * 0.45) {
    out.push({ code: "adv.lowLight", params: { d: r1(L.ctrl.state.dli) }, priority: 1, sectionId: L.def.id });
  }
  return out;
}
