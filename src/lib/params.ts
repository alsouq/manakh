// Shared descriptors for settable values (the [V] badge). A "period" param varies per day
// period (heat/vent/rhMax/co2); a "field" param is a single strategy field (e.g. min pipe).
import type { Strategy } from "@/engine/types";
import type { CurveSeries } from "@/components/SetpointCurve";

export type PeriodKey = "heat" | "vent" | "rhMax" | "co2";

export interface PeriodParam {
  scope: "period";
  key: PeriodKey;
  label: string;
  unit: string;
  digits: number;
  min: number;
  max: number;
  step: number;
  curve: CurveSeries[];
}
export interface FieldParam {
  scope: "field";
  path: string; // dot path into Strategy, e.g. "heating.minPipe"
  label: string;
  unit: string;
  digits: number;
  min: number;
  max: number;
  step: number;
}
export type Param = PeriodParam | FieldParam;

export function getField(doc: Strategy, path: string): number {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], doc) as number;
}
export function setField(doc: Strategy, path: string, value: number) {
  const parts = path.split(".");
  let o = doc as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] as Record<string, unknown>;
  o[parts[parts.length - 1]] = value;
}

export const PERIOD_PARAMS: Record<PeriodKey, PeriodParam> = {
  heat: { scope: "period", key: "heat", label: "actual.tempSet", unit: "°C", digits: 1, min: 5, max: 35, step: 0.5, curve: [{ key: "heat", color: "--s6", label: "st.heat" }, { key: "vent", color: "--s2", dash: true, label: "st.vent" }] },
  vent: { scope: "period", key: "vent", label: "actual.ventSet", unit: "°C", digits: 1, min: 5, max: 40, step: 0.5, curve: [{ key: "vent", color: "--s2", label: "st.vent" }, { key: "heat", color: "--s6", dash: true, label: "st.heat" }] },
  rhMax: { scope: "period", key: "rhMax", label: "actual.rhSet", unit: "%", digits: 0, min: 50, max: 98, step: 1, curve: [{ key: "rhMax", color: "--s1", label: "var.rhMax" }] },
  co2: { scope: "period", key: "co2", label: "actual.co2Set", unit: "ppm", digits: 0, min: 0, max: 1500, step: 50, curve: [{ key: "co2", color: "--s3", label: "var.co2Sp" }] },
};
