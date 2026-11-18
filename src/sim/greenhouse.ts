// Lumped greenhouse physics: air temperature, absolute humidity, CO2, heating pipe, actuator motion.
// Per m² of floor. Simple, stable at dt <= 60 s, believable rather than exact.
import { ahFromRh, ahSat, rhFromAh, vpd, wetBulb } from "@/engine/psy";
import type { ActuatorKey, Outputs, Outside } from "@/engine/types";

export interface Physical {
  height: number; // m
  coverU: number; // W/m²K
  transmission: number; // 0..1
  cropFactor: number; // 0..1.2, leaf area scaling
  hasPadFan: boolean;
  hasLamps: boolean;
  lampW: number; // W/m² electric
  hasFog: boolean;
}

export interface PhysState {
  temp: number;
  ah: number;
  co2: number;
  pipeT: number;
  act: Outputs; // actual positions
}

export interface StepFlux {
  radIn: number; // W/m² inside global
  par: number; // µmol/m²/s at crop
  heatW: number; // W/m² delivered by pipes
  lampW: number;
  fanW: number;
  co2Dose: number; // g/m²/s
  transp: number; // g/m²/s
}

const RATES: Partial<Record<ActuatorKey, number>> = {
  ventLee: 12, // %/min
  ventWind: 12,
  energyScreen: 6,
  shadeScreen: 6,
};

export function initPhys(out: Outside): PhysState {
  return {
    temp: 19,
    ah: ahFromRh(19, 80),
    co2: 420,
    pipeT: 30,
    act: { pipe: 0, ventLee: 0, ventWind: 0, energyScreen: 0, shadeScreen: 0, lamps: 0, co2Valve: 0, fans: 0, pad: 0, fog: 0 },
  };
  void out;
}

export function moveActuators(cur: Outputs, target: Outputs, dtSec: number): Outputs {
  const next = { ...cur };
  for (const k of Object.keys(target) as ActuatorKey[]) {
    const rate = RATES[k];
    if (!rate) {
      next[k] = target[k];
      continue;
    }
    const maxD = (rate * dtSec) / 60;
    const d = target[k] - cur[k];
    next[k] = Math.abs(d) <= maxD ? target[k] : cur[k] + Math.sign(d) * maxD;
  }
  return next;
}

export function stepPhysics(
  s: PhysState,
  target: Outputs,
  out: Outside,
  ph: Physical,
  maxDoseGm2h: number,
  dtSec: number,
): { state: PhysState; flux: StepFlux } {
  const act = moveActuators(s.act, target, dtSec);
  const T = s.temp;

  // heating pipe
  let pipeT = s.pipeT;
  if (target.pipe > 0) pipeT += (target.pipe - pipeT) * Math.min(1, dtSec / 600);
  else pipeT += (T - pipeT) * Math.min(1, dtSec / 900);
  const heatW = Math.max(0, 2.2 * (pipeT - T));

  // light
  const shade = act.shadeScreen / 100;
  const scr = act.energyScreen / 100;
  const radIn = out.radiation * ph.transmission * (1 - 0.7 * shade) * (1 - 0.6 * scr);
  const lampOn = ph.hasLamps ? act.lamps / 100 : 0;
  const lampW = lampOn * ph.lampW;
  const par = radIn * 2.1 + lampW * 1.9;

  // air exchange
  const v = (act.ventLee + act.ventWind) / 200;
  const gVent = 0.0003 + v * (0.012 + 0.0025 * out.wind);
  const fanOn = ph.hasPadFan ? act.fans / 100 : 0;
  const gFan = fanOn * 0.035;
  const fanW = fanOn * 6; // electric W/m²
  let srcT = out.temp;
  let srcAh = ahFromRh(out.temp, out.rh);
  const outAh = srcAh;
  if (ph.hasPadFan && act.pad > 0) {
    const wb = wetBulb(out.temp, out.rh);
    srcT = out.temp - 0.8 * (out.temp - wb);
    srcAh = outAh + ((out.temp - srcT) * 1200) / 2450;
  }

  // humidity terms
  const rh = rhFromAh(T, s.ah);
  const transp = ph.cropFactor * ((0.45 * radIn) / 2450 + 0.0035 * vpd(T, rh) + (0.08 * lampW) / 2450);
  const fogE = ph.hasFog ? (act.fog / 100) * 0.018 : 0;
  const coverT = out.temp + (T - out.temp) * (0.3 - 0.15 * scr);
  const cond = 0.0025 * Math.max(0, s.ah - ahSat(coverT));

  // energy balance W/m²
  const U = ph.coverU * (1 - 0.45 * scr);
  const Q =
    0.5 * radIn +
    heatW +
    lampW * 0.9 -
    U * (T - out.temp) -
    gVent * 1200 * (T - out.temp) -
    gFan * 1200 * (T - srcT) -
    fogE * 2450 +
    cond * 2450 * 0.3;
  const temp = T + (Q / 25000) * dtSec;

  const ahFlux = transp + fogE - gVent * (s.ah - outAh) - gFan * (s.ah - srcAh) - cond;
  let ah = s.ah + (ahFlux / ph.height) * dtSec;
  ah = Math.max(1, Math.min(ah, ahSat(temp) * 0.995));

  // CO2 (ppm)
  const dose = (act.co2Valve / 100) * (maxDoseGm2h / 3600);
  const uptakeUmol = ph.cropFactor * 0.035 * par * (s.co2 / (s.co2 + 400));
  const respUmol = ph.cropFactor * (1.5 + 0.08 * Math.max(0, T - 15));
  const netG = dose - (uptakeUmol - respUmol) * 44e-6;
  let co2 = s.co2 + ((netG / 0.0018 - (gVent + gFan) * (s.co2 - 415)) / ph.height) * dtSec;
  co2 = Math.max(200, Math.min(3000, co2));

  return {
    state: { temp, ah, co2, pipeT, act },
    flux: { radIn, par, heatW, lampW, fanW, co2Dose: dose, transp },
  };
}
