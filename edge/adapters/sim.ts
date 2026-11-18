// Simulated device: the same lumped greenhouse physics the web app uses, behind the adapter
// interface. Lets the whole edge loop run and be tested with no hardware.
import { initPhys, moveActuators, stepPhysics, type Physical, type PhysState } from "@/sim/greenhouse";
import { rhFromAh } from "@/engine/psy";
import type { Outputs, Outside } from "@/engine/types";
import type { InsideReading, IoAdapter } from "./types";

export class SimAdapter implements IoAdapter {
  readonly name = "sim";
  private phys: PhysState;
  private target: Outputs;
  constructor(
    private ph: Physical,
    private maxDoseGm2h: number,
    out: Outside,
  ) {
    this.phys = initPhys(out);
    this.target = this.phys.act;
  }
  async readInside(): Promise<InsideReading> {
    const p = this.phys;
    return { temp: p.temp, rh: rhFromAh(p.temp, p.ah), co2: p.co2, vents: Math.max(p.act.ventLee, p.act.ventWind), energyScreen: p.act.energyScreen, pipeT: p.pipeT };
  }
  async writeOutputs(out: Outputs): Promise<void> {
    this.target = out;
  }
  advance(outside: Outside, dtSec: number): void {
    const r = stepPhysics(this.phys, this.target, outside, this.ph, this.maxDoseGm2h, dtSec);
    this.phys = r.state;
  }
  /** test helper */
  get state() {
    return this.phys;
  }
  /** test helper: where the actuators actually are */
  moved(dtSec: number) {
    return moveActuators(this.phys.act, this.target, dtSec);
  }
}
