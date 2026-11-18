// Deterministic outside weather for a site: same time -> same weather, so history replays exactly.
import { sunElevation, localTime } from "@/engine/sun";
import { ahFromRh, ahSat } from "@/engine/psy";
import type { Outside } from "@/engine/types";

export interface SiteGeo {
  lat: number;
  lon: number;
  tz: string;
}

function hash(n: number, seed: number) {
  let x = Math.imul(n ^ (seed * 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Smooth value noise in [0,1). */
export function noise(t: number, periodH: number, seed: number) {
  const x = t / (periodH * 3600000);
  const i = Math.floor(x);
  const f = x - i;
  const u = (1 - Math.cos(f * Math.PI)) / 2;
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface WeatherPoint extends Outside {
  cloud: number;
  elevation: number;
}

export function weatherAt(t: number, g: SiteGeo, forecastLeadH = 0): WeatherPoint {
  const lt = localTime(t, g.tz, g.lat, g.lon);
  const doy = Math.floor((t - Date.UTC(new Date(t).getUTCFullYear(), 0, 1)) / 86400000);
  const mean = 22 - 7 * Math.cos((2 * Math.PI * (doy - 20)) / 365) + (noise(t, 40, 11) - 0.5) * 4;
  const amp = 6.5 + (noise(t, 30, 12) - 0.5) * 2;

  // diurnal shape: minimum at sunrise, maximum at 14:30
  const m = lt.minuteOfDay;
  const rise = lt.sunriseMin;
  const peak = 870;
  let shape: number;
  if (m >= rise && m <= peak) shape = -Math.cos((Math.PI * (m - rise)) / (peak - rise));
  else {
    const span = 1440 - (peak - rise);
    const k = (m > peak ? m - peak : m + 1440 - peak) / span;
    shape = Math.cos(Math.PI * k);
  }
  let temp = mean + amp * shape + (noise(t, 2, 13) - 0.5) * 1.2;

  const cloud = clamp(noise(t, 9, 14) * 1.7 - 0.95, 0, 0.85);
  const elevation = sunElevation(t, g.lat, g.lon);
  const clear = elevation > 0 ? 1080 * Math.sin((elevation * Math.PI) / 180) ** 1.2 : 0;
  let radiation = clear * (1 - 0.75 * cloud) * (0.95 + noise(t, 0.5, 15) * 0.05);
  temp -= cloud * 2.5 * Math.max(0, shape);

  const dew = 9 + (noise(t, 36, 16) - 0.5) * 6;
  const ah = Math.min(ahFromRh(dew, 100), ahSat(temp) * 0.99);
  const rh = clamp((100 * ah) / ahSat(temp), 15, 99);

  const afternoon = m > 720 && m < 1140 ? Math.sin((Math.PI * (m - 720)) / 420) : 0;
  let wind = 1.2 + noise(t, 7, 17) * 4.5 + afternoon * 2 + (noise(t, 0.3, 18) - 0.5) * 1.2;
  const windDir = (300 + (noise(t, 20, 19) - 0.5) * 90 + 360) % 360;

  if (forecastLeadH > 0) {
    const e = Math.min(1, forecastLeadH / 48);
    temp += (noise(t, 6, 21) - 0.5) * 2.5 * e;
    radiation *= 1 + (noise(t, 5, 22) - 0.5) * 0.3 * e;
    wind *= 1 + (noise(t, 5, 23) - 0.5) * 0.4 * e;
  }

  return {
    temp,
    rh,
    radiation: Math.max(0, radiation),
    wind: Math.max(0, wind),
    windDir,
    cloud,
    elevation,
  };
}
