// Psychrometrics. Pure.

/** Saturation vapour pressure, kPa. */
export const svp = (t: number) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));

/** Absolute humidity at saturation, g/m³. */
export const ahSat = (t: number) => (2165 * svp(t)) / (t + 273.15);

export const ahFromRh = (t: number, rh: number) => (ahSat(t) * rh) / 100;

export const rhFromAh = (t: number, ah: number) => Math.min(100, (100 * ah) / ahSat(t));

/** Humidity deficit, g/m³. */
export const hd = (t: number, rh: number) => ahSat(t) * (1 - rh / 100);

/** Vapour pressure deficit, kPa. */
export const vpd = (t: number, rh: number) => svp(t) * (1 - rh / 100);

export function dewPoint(t: number, rh: number) {
  const a = 17.27,
    b = 237.3;
  const g = (a * t) / (b + t) + Math.log(Math.max(1, rh) / 100);
  return (b * g) / (a - g);
}

/** Wet bulb temperature (Stull 2011). */
export function wetBulb(t: number, rh: number) {
  return (
    t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) -
    4.686035
  );
}
