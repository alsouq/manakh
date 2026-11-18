// Demo site: a 3.3 ha greenhouse farm in Wadi El Natrun, Egypt. All data is invented.
import type { Strategy } from "@/engine/types";
import type { Physical } from "./greenhouse";
import type { SiteGeo } from "./weather";

export interface SiteDef {
  id: string;
  name: string;
  nameAr: string;
  geo: SiteGeo;
}

export interface SectionDef {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  crop: string;
  cropAr: string;
  area: number; // m²
  phys: Physical;
}

export const SITE: SiteDef = {
  id: "site-1",
  name: "Wadi El Natrun Farm",
  nameAr: "مزرعة وادي النطرون",
  geo: { lat: 30.39, lon: 30.35, tz: "Africa/Cairo" },
};

export const SECTIONS: SectionDef[] = [
  {
    id: "a",
    code: "A",
    name: "Tomato",
    nameAr: "طماطم",
    crop: "Truss tomato",
    cropAr: "طماطم عنقودية",
    area: 12000,
    phys: { height: 5.5, coverU: 6.2, transmission: 0.72, cropFactor: 1, hasPadFan: false, hasLamps: false, lampW: 0, hasFog: true },
  },
  {
    id: "b",
    code: "B",
    name: "Cucumber",
    nameAr: "خيار",
    crop: "Mini cucumber",
    cropAr: "خيار صغير",
    area: 8000,
    phys: { height: 4.5, coverU: 7.0, transmission: 0.68, cropFactor: 1.1, hasPadFan: true, hasLamps: false, lampW: 0, hasFog: false },
  },
  {
    id: "c",
    code: "C",
    name: "Sweet pepper",
    nameAr: "فلفل رومي",
    crop: "Block pepper",
    cropAr: "فلفل بلوك",
    area: 10000,
    phys: { height: 5.5, coverU: 6.2, transmission: 0.72, cropFactor: 0.9, hasPadFan: false, hasLamps: false, lampW: 0, hasFog: true },
  },
  {
    id: "d",
    code: "D",
    name: "Strawberry nursery",
    nameAr: "مشتل فراولة",
    crop: "Strawberry plugs",
    cropAr: "شتلات فراولة",
    area: 3000,
    phys: { height: 4.5, coverU: 6.8, transmission: 0.7, cropFactor: 0.6, hasPadFan: true, hasLamps: true, lampW: 70, hasFog: true },
  },
];

const base = (): Omit<Strategy, "periods"> => ({
  ventilation: { pBand: 3, minVent: 0, maxVent: 100, windLimit: 10, humVentPerPct: 4, humVentMax: 25 },
  heating: { minPipe: 0, maxPipe: 70, minPipeOnHumidity: 40 },
  co2: { reduceFullAtVent: 60, minRadiation: 50, maxDoseGm2h: 15 },
  screens: {
    energyEnabled: true,
    energyCloseBelowRad: 5,
    energyCloseBelowOutT: 14,
    energyGapOnHumidity: 6,
    shadeEnabled: true,
    shadeAboveRad: 750,
    shadeMax: 50,
  },
  lighting: { enabled: false, onBelowRad: 120, offAboveRad: 280, targetDli: 14 },
  cooling: { padFanEnabled: false, padStart: 29, fogEnabled: true, fogBelowRh: 60, fogAboveTemp: 25 },
  influences: [
    { id: "i1", enabled: true, target: "heat", source: "radiation", points: [[150, 0], [600, 1.5]] },
    { id: "i2", enabled: true, target: "vent", source: "radiation", points: [[200, 0], [700, 2]] },
    { id: "i3", enabled: true, target: "heat", source: "rhExcess", points: [[0, 0], [6, 1]] },
    { id: "i4", enabled: true, target: "vent", source: "rhExcess", points: [[0, 0], [6, -1.5]] },
    { id: "i5", enabled: true, target: "vent", source: "outsideTemp", points: [[6, 1.5], [14, 0]] },
    { id: "i6", enabled: true, target: "co2", source: "radiation", points: [[100, -200], [350, 0]] },
  ],
});

export function tomatoStrategy(): Strategy {
  return {
    ...base(),
    periods: [
      { id: "p1", name: "Pre-dawn", ref: "sunrise", offsetMin: -90, rampMin: 60, heat: 17.5, vent: 19, rhMax: 88, co2: 0, lamps: false },
      { id: "p2", name: "Day", ref: "sunrise", offsetMin: 60, rampMin: 90, heat: 19.5, vent: 22, rhMax: 85, co2: 800, lamps: true },
      { id: "p3", name: "Afternoon", ref: "sunset", offsetMin: -180, rampMin: 60, heat: 19, vent: 23, rhMax: 85, co2: 700, lamps: true },
      { id: "p4", name: "Evening", ref: "sunset", offsetMin: 0, rampMin: 60, heat: 17, vent: 19, rhMax: 88, co2: 0, lamps: false },
      { id: "p5", name: "Night", ref: "sunset", offsetMin: 180, rampMin: 120, heat: 16.5, vent: 18.5, rhMax: 90, co2: 0, lamps: false },
    ],
  };
}

export function cucumberStrategy(): Strategy {
  const b = base();
  return {
    ...b,
    cooling: { ...b.cooling, padFanEnabled: true, padStart: 28, fogEnabled: false },
    screens: { ...b.screens, shadeAboveRad: 700, shadeMax: 40 },
    periods: [
      { id: "p1", name: "Morning", ref: "sunrise", offsetMin: -60, rampMin: 60, heat: 19, vent: 21, rhMax: 88, co2: 0, lamps: false },
      { id: "p2", name: "Day", ref: "sunrise", offsetMin: 60, rampMin: 60, heat: 21, vent: 24, rhMax: 88, co2: 900, lamps: true },
      { id: "p3", name: "Evening", ref: "sunset", offsetMin: 0, rampMin: 60, heat: 19.5, vent: 21.5, rhMax: 90, co2: 0, lamps: false },
      { id: "p4", name: "Night", ref: "sunset", offsetMin: 180, rampMin: 120, heat: 18.5, vent: 20.5, rhMax: 90, co2: 0, lamps: false },
    ],
  };
}

export function pepperStrategy(): Strategy {
  return {
    ...base(),
    periods: [
      { id: "p1", name: "Pre-dawn", ref: "sunrise", offsetMin: -120, rampMin: 90, heat: 18.5, vent: 20, rhMax: 88, co2: 0, lamps: false },
      { id: "p2", name: "Day", ref: "sunrise", offsetMin: 60, rampMin: 90, heat: 21, vent: 23.5, rhMax: 85, co2: 800, lamps: true },
      { id: "p3", name: "Evening", ref: "sunset", offsetMin: -30, rampMin: 60, heat: 19, vent: 21, rhMax: 88, co2: 0, lamps: false },
      { id: "p4", name: "Night", ref: "sunset", offsetMin: 150, rampMin: 120, heat: 18, vent: 20, rhMax: 90, co2: 0, lamps: false },
    ],
  };
}

export function strawberryStrategy(): Strategy {
  const b = base();
  return {
    ...b,
    lighting: { enabled: true, onBelowRad: 150, offAboveRad: 300, targetDli: 15 },
    cooling: { padFanEnabled: true, padStart: 25, fogEnabled: true, fogBelowRh: 65, fogAboveTemp: 22 },
    heating: { minPipe: 0, maxPipe: 60, minPipeOnHumidity: 35 },
    co2: { ...b.co2, maxDoseGm2h: 10 },
    periods: [
      { id: "p1", name: "Early light", ref: "clock", offsetMin: 300, rampMin: 60, heat: 14, vent: 17, rhMax: 88, co2: 0, lamps: true },
      { id: "p2", name: "Day", ref: "sunrise", offsetMin: 90, rampMin: 60, heat: 17, vent: 20, rhMax: 85, co2: 700, lamps: true },
      { id: "p3", name: "Evening light", ref: "sunset", offsetMin: -30, rampMin: 60, heat: 15, vent: 18, rhMax: 88, co2: 0, lamps: true },
      { id: "p4", name: "Night", ref: "clock", offsetMin: 1290, rampMin: 90, heat: 12, vent: 15, rhMax: 90, co2: 0, lamps: false },
    ],
  };
}

export const DEFAULT_STRATEGIES: Record<string, () => Strategy> = {
  a: tomatoStrategy,
  b: cucumberStrategy,
  c: pepperStrategy,
  d: strawberryStrategy,
};

export interface IrrigationSettings {
  enabled: boolean;
  startRadSum: number; // J/cm² since last start
  doseMl: number; // ml per dripper per start
  drippersPerM2: number;
  windowStartAfterSunrise: number; // min
  windowEndBeforeSunset: number; // min
  minIntervalMin: number;
  ecTarget: number; // mS/cm
  phTarget: number;
}

export const DEFAULT_IRRIGATION: Record<string, IrrigationSettings> = {
  a: { enabled: true, startRadSum: 100, doseMl: 150, drippersPerM2: 2.5, windowStartAfterSunrise: 60, windowEndBeforeSunset: 90, minIntervalMin: 25, ecTarget: 3.0, phTarget: 5.8 },
  b: { enabled: true, startRadSum: 80, doseMl: 120, drippersPerM2: 2.2, windowStartAfterSunrise: 45, windowEndBeforeSunset: 60, minIntervalMin: 20, ecTarget: 2.4, phTarget: 5.7 },
  c: { enabled: true, startRadSum: 110, doseMl: 140, drippersPerM2: 2.5, windowStartAfterSunrise: 75, windowEndBeforeSunset: 90, minIntervalMin: 25, ecTarget: 2.8, phTarget: 5.8 },
  d: { enabled: true, startRadSum: 150, doseMl: 60, drippersPerM2: 8, windowStartAfterSunrise: 90, windowEndBeforeSunset: 120, minIntervalMin: 40, ecTarget: 1.6, phTarget: 5.9 },
};

export type AlarmVar = "temp" | "rh" | "hd" | "co2" | "pipe" | "outsideTemp" | "wind";
export type Priority = "low" | "medium" | "high" | "critical";

export interface AlarmRule {
  id: string;
  name: string;
  sectionId: string; // "all" or a section id
  variable: AlarmVar;
  condition: "above" | "below" | "deviation";
  threshold: number;
  hysteresis: number;
  delayMin: number;
  activeFrom: string; // "HH:MM" or ""
  activeTo: string;
  priority: Priority;
  enabled: boolean;
}

export const DEFAULT_RULES: AlarmRule[] = [
  { id: "r1", name: "High temperature", sectionId: "all", variable: "temp", condition: "above", threshold: 27, hysteresis: 1, delayMin: 10, activeFrom: "", activeTo: "", priority: "high", enabled: true },
  { id: "r2", name: "Low temperature", sectionId: "all", variable: "temp", condition: "below", threshold: 12, hysteresis: 1, delayMin: 10, activeFrom: "", activeTo: "", priority: "high", enabled: true },
  { id: "r3", name: "Humidity too high", sectionId: "all", variable: "rh", condition: "above", threshold: 92, hysteresis: 2, delayMin: 20, activeFrom: "", activeTo: "", priority: "medium", enabled: true },
  { id: "r4", name: "Below heating setpoint", sectionId: "all", variable: "temp", condition: "deviation", threshold: 1.5, hysteresis: 0.5, delayMin: 30, activeFrom: "", activeTo: "", priority: "medium", enabled: true },
  { id: "r5", name: "CO2 too high", sectionId: "all", variable: "co2", condition: "above", threshold: 1300, hysteresis: 100, delayMin: 10, activeFrom: "", activeTo: "", priority: "medium", enabled: true },
  { id: "r6", name: "Botrytis risk (low HD)", sectionId: "all", variable: "hd", condition: "below", threshold: 2, hysteresis: 0.3, delayMin: 20, activeFrom: "", activeTo: "", priority: "low", enabled: true },
  { id: "r7", name: "Storm", sectionId: "all", variable: "wind", condition: "above", threshold: 12, hysteresis: 2, delayMin: 5, activeFrom: "", activeTo: "", priority: "critical", enabled: true },
];

export interface Recipe {
  id: string;
  name: string;
  crop: string;
  stage: string;
  note: string;
  doc: Strategy;
  createdAt: number;
  author: string;
  builtIn?: boolean;
}

export function defaultRecipes(now: number): Recipe[] {
  const hot = tomatoStrategy();
  hot.cooling = { padFanEnabled: true, padStart: 28, fogEnabled: true, fogBelowRh: 55, fogAboveTemp: 26 };
  hot.screens.shadeAboveRad = 600;
  hot.screens.shadeMax = 60;
  const gen = pepperStrategy();
  gen.periods = gen.periods.map((p) => (p.name === "Night" ? { ...p, heat: 17, vent: 19 } : p.name === "Day" ? { ...p, heat: 22, vent: 24.5 } : p));
  return [
    { id: "rc1", name: "Tomato · winter production", crop: "Tomato", stage: "Production", note: "Balanced day/night, CO2 800 ppm in light", doc: tomatoStrategy(), createdAt: now, author: "Manakh", builtIn: true },
    { id: "rc2", name: "Tomato · hot spell (pad & fan)", crop: "Tomato", stage: "Production", note: "Shade earlier, fog and fans for hot days", doc: hot, createdAt: now, author: "Manakh", builtIn: true },
    { id: "rc3", name: "Cucumber · production", crop: "Cucumber", stage: "Production", note: "Warm, humid, high CO2", doc: cucumberStrategy(), createdAt: now, author: "Manakh", builtIn: true },
    { id: "rc4", name: "Pepper · generative push", crop: "Pepper", stage: "Fruit set", note: "Bigger day/night difference to steer generative", doc: gen, createdAt: now, author: "Manakh", builtIn: true },
    { id: "rc5", name: "Strawberry · plug rooting", crop: "Strawberry", stage: "Propagation", note: "Cool nights, lamps to 15 mol/m²/day", doc: strawberryStrategy(), createdAt: now, author: "Manakh", builtIn: true },
  ];
}
