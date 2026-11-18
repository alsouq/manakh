import type { OutsideKey, SectionKey } from "@/sim/twin";

export interface VarMeta {
  unit: string;
  unitAr: string;
  digits: number;
  /** charts group series by this */
  group: string;
}

export const VARS: Record<SectionKey | OutsideKey, VarMeta> = {
  temp: { unit: "°C", unitAr: "°م", digits: 1, group: "°C" },
  heatSp: { unit: "°C", unitAr: "°م", digits: 1, group: "°C" },
  ventSp: { unit: "°C", unitAr: "°م", digits: 1, group: "°C" },
  outTemp: { unit: "°C", unitAr: "°م", digits: 1, group: "°C" },
  pipe: { unit: "°C", unitAr: "°م", digits: 0, group: "pipe" },
  rh: { unit: "%", unitAr: "%", digits: 0, group: "%RH" },
  rhMax: { unit: "%", unitAr: "%", digits: 0, group: "%RH" },
  outRh: { unit: "%", unitAr: "%", digits: 0, group: "%RH" },
  hd: { unit: "g/m³", unitAr: "جم/م³", digits: 1, group: "g/m³" },
  vpd: { unit: "kPa", unitAr: "ك.باسكال", digits: 2, group: "kPa" },
  co2: { unit: "ppm", unitAr: "ppm", digits: 0, group: "ppm" },
  co2Sp: { unit: "ppm", unitAr: "ppm", digits: 0, group: "ppm" },
  par: { unit: "µmol/m²/s", unitAr: "ميكرومول/م²/ث", digits: 0, group: "µmol" },
  radiation: { unit: "W/m²", unitAr: "وات/م²", digits: 0, group: "W/m²" },
  ventLee: { unit: "%", unitAr: "%", digits: 0, group: "% pos" },
  ventWind: { unit: "%", unitAr: "%", digits: 0, group: "% pos" },
  energyScreen: { unit: "%", unitAr: "%", digits: 0, group: "% pos" },
  shadeScreen: { unit: "%", unitAr: "%", digits: 0, group: "% pos" },
  lamps: { unit: "%", unitAr: "%", digits: 0, group: "% pos" },
  co2Valve: { unit: "%", unitAr: "%", digits: 0, group: "% pos" },
  fans: { unit: "%", unitAr: "%", digits: 0, group: "% pos" },
  fog: { unit: "%", unitAr: "%", digits: 0, group: "% pos" },
  heatKw: { unit: "kW", unitAr: "ك.وات", digits: 0, group: "kW" },
  elec: { unit: "kW", unitAr: "ك.وات", digits: 0, group: "kW" },
  gas: { unit: "m³/h", unitAr: "م³/س", digits: 1, group: "m³/h" },
  radSum: { unit: "J/cm²", unitAr: "جول/سم²", digits: 0, group: "J/cm²" },
  ec: { unit: "mS/cm", unitAr: "مللي سيمنز", digits: 2, group: "EC" },
  ph: { unit: "pH", unitAr: "pH", digits: 2, group: "pH" },
  drain: { unit: "%", unitAr: "%", digits: 0, group: "% drain" },
  water: { unit: "L/m²", unitAr: "لتر/م²", digits: 2, group: "L/m²" },
  dli: { unit: "mol/m²", unitAr: "مول/م²", digits: 1, group: "mol" },
  wind: { unit: "m/s", unitAr: "م/ث", digits: 1, group: "m/s" },
};

export const unitOf = (k: string, lang: "en" | "ar") => {
  const m = VARS[k as keyof typeof VARS];
  return m ? (lang === "ar" ? m.unitAr : m.unit) : "";
};

export function fmt(v: number | undefined | null, digits = 1): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "–";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const fmtVar = (k: string, v: number | undefined) => fmt(v, VARS[k as keyof typeof VARS]?.digits ?? 1);

export function fmtTime(t: number, tz: string, withDate = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(withDate ? { day: "2-digit", month: "short" } : {}),
  }).format(new Date(t));
}

/** Categorical series slots (validated palette order). Index by fixed entity order, never by rank. */
export const SERIES = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];
export const sectionSlot: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };

export function cssVar(name: string) {
  if (typeof window === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}
