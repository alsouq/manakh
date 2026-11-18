import type { Strategy } from "@/engine/types";

export interface Change {
  label: string; // i18n key or literal
  params?: Record<string, string | number>;
  scope?: string; // period name or group
  from: string;
  to: string;
}

const show = (v: unknown) => (typeof v === "boolean" ? (v ? "✓" : "✗") : typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v));

const GROUPS = ["ventilation", "heating", "co2", "screens", "lighting", "cooling"] as const;
const PERIOD_KEYS = ["name", "ref", "offsetMin", "rampMin", "heat", "vent", "rhMax", "co2", "lamps"] as const;
const PERIOD_LABEL: Record<string, string> = {
  name: "st.periodName",
  ref: "st.start",
  offsetMin: "st.offset",
  rampMin: "st.ramp",
  heat: "st.heat",
  vent: "st.vent",
  rhMax: "st.rhMax",
  co2: "st.co2",
  lamps: "st.lamps",
};
export const GROUP_LABEL: Record<string, string> = {
  ventilation: "st.ventilation",
  heating: "st.heating",
  co2: "st.co2Section",
  screens: "st.screens",
  lighting: "st.lighting",
  cooling: "st.cooling",
};
export const FIELD_LABEL: Record<string, string> = {
  maxDoseGm2h: "st.maxDose",
  enabled: "st.lightEnabled",
};
export const fieldLabel = (k: string) => FIELD_LABEL[k] ?? `st.${k}`;

export function diffStrategy(a: Strategy, b: Strategy): Change[] {
  const out: Change[] = [];
  const aP = new Map(a.periods.map((p) => [p.id, p]));
  const bP = new Map(b.periods.map((p) => [p.id, p]));
  for (const p of b.periods) {
    const old = aP.get(p.id);
    if (!old) {
      out.push({ label: "st.addPeriod", scope: p.name, from: "—", to: p.name });
      continue;
    }
    for (const k of PERIOD_KEYS) if (old[k] !== p[k]) out.push({ label: PERIOD_LABEL[k], scope: p.name, from: show(old[k]), to: show(p[k]) });
  }
  for (const p of a.periods) if (!bP.has(p.id)) out.push({ label: "st.removePeriod", scope: p.name, from: p.name, to: "—" });
  for (const g of GROUPS) {
    const ga = a[g] as unknown as Record<string, unknown>;
    const gb = b[g] as unknown as Record<string, unknown>;
    for (const k of Object.keys(gb)) if (ga[k] !== gb[k]) out.push({ label: fieldLabel(k), scope: GROUP_LABEL[g], from: show(ga[k]), to: show(gb[k]) });
  }
  const ai = new Map(a.influences.map((i) => [i.id, i]));
  const bi = new Map(b.influences.map((i) => [i.id, i]));
  for (const i of b.influences) {
    const o = ai.get(i.id);
    const desc = (x: typeof i) => `${x.enabled ? "" : "✗ "}${x.points.map((p) => `(${p[0]}→${p[1]})`).join(" ")}`;
    if (!o) out.push({ label: "st.addInfluence", scope: `st.tgt.${i.target}`, from: "—", to: desc(i) });
    else if (JSON.stringify(o) !== JSON.stringify(i)) out.push({ label: `st.src.${i.source}`, scope: `st.tgt.${i.target}`, from: desc(o), to: desc(i) });
  }
  for (const i of a.influences) if (!bi.has(i.id)) out.push({ label: "common.delete", scope: `st.tgt.${i.target}`, from: `st.src.${i.source}`, to: "—" });
  return out;
}
