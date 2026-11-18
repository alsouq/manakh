// Pure types for the control engine. No I/O, no React. Runs on the edge, server and browser.

export type PeriodRef = "sunrise" | "sunset" | "clock";

export interface Period {
  id: string;
  name: string;
  ref: PeriodRef;
  /** minutes relative to ref (for "clock": minutes since local midnight) */
  offsetMin: number;
  /** minutes to ramp from the previous period's values */
  rampMin: number;
  heat: number; // °C heating setpoint
  vent: number; // °C ventilation setpoint
  rhMax: number; // % max relative humidity
  co2: number; // ppm target, 0 = no dosing
  lamps: boolean; // lighting allowed in this period
}

export type InfluenceSource = "radiation" | "outsideTemp" | "rhExcess" | "wind";
export type InfluenceTarget = "heat" | "vent" | "co2";

export interface Influence {
  id: string;
  enabled: boolean;
  target: InfluenceTarget;
  source: InfluenceSource;
  /** [x, y] points, linear interpolation, clamped at the ends */
  points: [number, number][];
}

export interface Strategy {
  periods: Period[];
  ventilation: {
    pBand: number; // °C
    minVent: number; // %
    maxVent: number; // %
    windLimit: number; // m/s, wind side closes above
    humVentPerPct: number; // % vent per % RH above max
    humVentMax: number; // %
  };
  heating: {
    minPipe: number; // °C, 0 = none
    maxPipe: number; // °C
    minPipeOnHumidity: number; // °C, applied when RH > max
  };
  co2: {
    reduceFullAtVent: number; // % vent at which dosing target drops to outside level
    minRadiation: number; // W/m² below which no dosing
    maxDoseGm2h: number; // dosing capacity g/m²/h
  };
  screens: {
    energyEnabled: boolean;
    energyCloseBelowRad: number; // W/m²
    energyCloseBelowOutT: number; // °C
    energyGapOnHumidity: number; // %
    shadeEnabled: boolean;
    shadeAboveRad: number; // W/m²
    shadeMax: number; // %
  };
  lighting: {
    enabled: boolean;
    onBelowRad: number; // W/m²
    offAboveRad: number; // W/m²
    targetDli: number; // mol/m²/day
  };
  cooling: {
    padFanEnabled: boolean;
    padStart: number; // °C greenhouse temperature where fans start
    fogEnabled: boolean;
    fogBelowRh: number; // %
    fogAboveTemp: number; // °C
  };
  influences: Influence[];
}

export interface Outside {
  temp: number;
  rh: number;
  radiation: number; // W/m² global
  wind: number; // m/s
  windDir: number; // degrees
}

export interface Inside {
  temp: number;
  rh: number;
  co2: number;
  /** effective vent opening now, 0-100 */
  vents: number;
  /** energy screen position now, 0-100 */
  energyScreen: number;
}

export interface Inputs {
  t: number; // ms UTC
  minuteOfDay: number; // local minutes since midnight
  sunriseMin: number;
  sunsetMin: number;
  outside: Outside;
  inside: Inside;
}

export interface CtrlState {
  dayKey: string;
  dli: number; // mol/m² accumulated today
  lampsOn: boolean;
}

export type SetpointKey = "heat" | "vent" | "co2" | "rhMax";

export interface BreakdownItem {
  code: string; // i18n key, e.g. "inf.radiation"
  delta: number;
  params?: Record<string, string | number>;
}

export interface Breakdown {
  key: SetpointKey;
  periodName: string;
  base: number;
  items: BreakdownItem[];
  result: number;
}

export type ActuatorKey =
  | "pipe"
  | "ventLee"
  | "ventWind"
  | "energyScreen"
  | "shadeScreen"
  | "lamps"
  | "co2Valve"
  | "fans"
  | "pad"
  | "fog";

export type Outputs = Record<ActuatorKey, number>;

export interface Reason {
  code: string; // i18n key
  params?: Record<string, string | number>;
}

export interface ControlResult {
  periodIndex: number;
  periodName: string;
  setpoints: Record<SetpointKey, number>;
  breakdown: Record<SetpointKey, Breakdown>;
  outputs: Outputs;
  reasons: Record<ActuatorKey, Reason[]>;
  state: CtrlState;
}
