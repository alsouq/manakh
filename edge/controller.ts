// The on-site control loop. Runs the SAME pure control engine the web app uses, against an
// I/O adapter (sim or field). It keeps controlling even with no cloud: readings buffer locally
// and sync is best-effort. The cloud can hand back a newer strategy on a successful sync.
import { control, newCtrlState } from "@/engine/control";
import { localTime } from "@/engine/sun";
import type { ControlResult, Outside, Strategy } from "@/engine/types";
import type { ReadingBuffer, Reading } from "./buffer";
import type { CloudSync } from "./sync";
import type { IoAdapter } from "./adapters/types";

export interface EdgeConfig {
  sectionId: string;
  geo: { lat: number; lon: number; tz: string };
  transmission: number; // cover light transmission, for a PAR estimate
  weather: (t: number) => Outside; // field: station/forecast; sim: weatherAt
}

export class EdgeController {
  strategy: Strategy;
  private state;
  constructor(
    strategy: Strategy,
    private cfg: EdgeConfig,
    private adapter: IoAdapter,
    private buffer: ReadingBuffer,
    private sync: CloudSync,
  ) {
    this.strategy = strategy;
    this.state = newCtrlState(localTime(Date.now(), cfg.geo.tz, cfg.geo.lat, cfg.geo.lon).dayKey);
  }

  /** One control step. Returns the control result for logging/inspection. */
  async tick(now: number, dtSec: number): Promise<ControlResult> {
    const out = this.cfg.weather(now);
    const lt = localTime(now, this.cfg.geo.tz, this.cfg.geo.lat, this.cfg.geo.lon);
    const inside = await this.adapter.readInside();
    const par = Math.max(0, out.radiation * this.cfg.transmission * 2.1);

    const ctrl = control(
      this.strategy,
      { t: now, minuteOfDay: lt.minuteOfDay, sunriseMin: lt.sunriseMin, sunsetMin: lt.sunsetMin, outside: out, inside: { temp: inside.temp, rh: inside.rh, co2: inside.co2, vents: inside.vents, energyScreen: inside.energyScreen } },
      this.state,
      lt.dayKey,
      par,
      dtSec,
    );
    this.state = ctrl.state;

    await this.adapter.writeOutputs(ctrl.outputs);
    this.adapter.advance?.(out, dtSec);

    const s = this.cfg.sectionId;
    const readings: Reading[] = [
      { sensor: `${s}:temp`, ts: now, value: round(inside.temp) },
      { sensor: `${s}:rh`, ts: now, value: round(inside.rh) },
      { sensor: `${s}:co2`, ts: now, value: Math.round(inside.co2) },
      { sensor: `${s}:pipe`, ts: now, value: round(inside.pipeT) },
      { sensor: `${s}:heatSp`, ts: now, value: round(ctrl.setpoints.heat) },
      { sensor: `${s}:ventSp`, ts: now, value: round(ctrl.setpoints.vent) },
    ];
    this.buffer.append(readings);
    return ctrl;
  }

  /** Best-effort push of buffered readings; adopts a newer strategy if the cloud returns one. */
  async syncNow(): Promise<boolean> {
    const pending = this.buffer.unsynced();
    if (!pending.length) return true;
    const res = await this.sync.push(pending);
    if (res.ok) {
      this.buffer.markSynced(pending.length);
      if (res.strategy) this.strategy = res.strategy;
    }
    return res.ok;
  }
}

const round = (v: number) => Math.round(v * 10) / 10;
