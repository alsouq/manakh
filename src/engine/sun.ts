// Solar position and local-time helpers (NOAA approximation). Pure.

const RAD = Math.PI / 180;

function julian(t: number) {
  return t / 86400000 + 2440587.5;
}

function solarParams(t: number) {
  const jc = (julian(t) - 2451545) / 36525;
  const L0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const C =
    Math.sin(M * RAD) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * jc) +
    Math.sin(3 * M * RAD) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * jc;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) / RAD;
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime =
    4 *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD)) /
    RAD;
  return { decl, eqTime };
}

/** Solar elevation in degrees. */
export function sunElevation(t: number, lat: number, lon: number): number {
  const { decl, eqTime } = solarParams(t);
  const d = new Date(t);
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  const tst = (((utcMin + eqTime + 4 * lon) % 1440) + 1440) % 1440;
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const cosZ =
    Math.sin(lat * RAD) * Math.sin(decl * RAD) + Math.cos(lat * RAD) * Math.cos(decl * RAD) * Math.cos(ha * RAD);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZ))) / RAD;
}

/** Sunrise / sunset as minutes after UTC midnight of the day containing t. */
export function sunTimesUtc(t: number, lat: number, lon: number) {
  const noonT = Math.floor(t / 86400000) * 86400000 + 12 * 3600000;
  const { decl, eqTime } = solarParams(noonT);
  const cosH =
    Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl * RAD)) - Math.tan(lat * RAD) * Math.tan(decl * RAD);
  const H = Math.acos(Math.max(-1, Math.min(1, cosH))) / RAD;
  const noon = 720 - 4 * lon - eqTime;
  return { sunrise: noon - 4 * H, sunset: noon + 4 * H };
}

const offsetCache = new Map<string, number>();

/** Timezone offset in minutes for t (local = utc + offset). Cached per hour. */
export function tzOffsetMin(t: number, tz: string): number {
  const key = tz + Math.floor(t / 3600000);
  const hit = offsetCache.get(key);
  if (hit !== undefined) return hit;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(t));
  const g = (k: string) => Number(parts.find((p) => p.type === k)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  const off = Math.round((asUtc - Math.floor(t / 60000) * 60000) / 60000);
  if (offsetCache.size > 5000) offsetCache.clear();
  offsetCache.set(key, off);
  return off;
}

export interface LocalTime {
  minuteOfDay: number;
  dayKey: string; // YYYY-MM-DD local
  sunriseMin: number; // local minutes
  sunsetMin: number;
  offsetMin: number;
}

const sunCache = new Map<string, { sunrise: number; sunset: number }>();

export function localTime(t: number, tz: string, lat: number, lon: number): LocalTime {
  const off = tzOffsetMin(t, tz);
  const localMs = t + off * 60000;
  const minuteOfDay = Math.floor((localMs % 86400000) / 60000);
  const d = new Date(localMs);
  const dayKey = d.toISOString().slice(0, 10);
  let s = sunCache.get(dayKey + lat + lon);
  if (!s) {
    // local midnight in UTC ms, then sun times for that UTC day, shifted by offset
    const localMidnightUtc = Math.floor(localMs / 86400000) * 86400000 - off * 60000;
    const st = sunTimesUtc(localMidnightUtc + 12 * 3600000, lat, lon);
    s = { sunrise: st.sunrise + off, sunset: st.sunset + off };
    sunCache.set(dayKey + lat + lon, s);
  }
  return { minuteOfDay, dayKey, sunriseMin: s.sunrise, sunsetMin: s.sunset, offsetMin: off };
}

export function fmtMinutes(m: number): string {
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
}
