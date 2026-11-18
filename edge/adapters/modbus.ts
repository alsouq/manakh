// Modbus adapter. Depends only on a tiny ModbusClient interface so it can be unit-tested with
// an in-memory mock; in production, wrap `modbus-serial` (or any client) to that interface.
// Each point maps a register to a physical value with a linear scale (raw = value*scale+offset).
import type { Outputs, Outside } from "@/engine/types";
import type { InsideReading, IoAdapter } from "./types";

export interface ModbusClient {
  readHolding(addr: number, count: number): Promise<number[]>;
  writeHolding(addr: number, value: number): Promise<void>;
}

export interface Scale {
  addr: number;
  scale: number; // raw = value * scale + offset
  offset: number;
}
export interface ModbusMap {
  inputs: { temp: Scale; rh: Scale; co2: Scale; vents: Scale; energyScreen: Scale; pipeT: Scale };
  outputs: Partial<Record<keyof Outputs, Scale>>;
}

const fromRaw = (raw: number, s: Scale) => (raw - s.offset) / s.scale;
const toRaw = (v: number, s: Scale) => Math.round(v * s.scale + s.offset);

export class ModbusAdapter implements IoAdapter {
  readonly name = "modbus";
  constructor(
    private client: ModbusClient,
    private map: ModbusMap,
  ) {}

  async readInside(): Promise<InsideReading> {
    const i = this.map.inputs;
    const read = async (s: Scale) => fromRaw((await this.client.readHolding(s.addr, 1))[0], s);
    const [temp, rh, co2, vents, energyScreen, pipeT] = await Promise.all([read(i.temp), read(i.rh), read(i.co2), read(i.vents), read(i.energyScreen), read(i.pipeT)]);
    return { temp, rh, co2, vents, energyScreen, pipeT };
  }

  async writeOutputs(out: Outputs): Promise<void> {
    const entries = Object.entries(this.map.outputs) as [keyof Outputs, Scale][];
    await Promise.all(entries.map(([k, s]) => this.client.writeHolding(s.addr, toRaw(out[k], s))));
  }

  // real hardware integrates itself; nothing to advance
  advance(_outside: Outside, _dtSec: number): void {}
}

/** In-memory Modbus device for tests and local dev. */
export class MockModbusClient implements ModbusClient {
  regs = new Map<number, number>();
  async readHolding(addr: number, count: number): Promise<number[]> {
    return Array.from({ length: count }, (_, i) => this.regs.get(addr + i) ?? 0);
  }
  async writeHolding(addr: number, value: number): Promise<void> {
    this.regs.set(addr, value);
  }
  set(addr: number, v: number) {
    this.regs.set(addr, v);
  }
}
