// On-site I/O adapters. The edge controller reads the greenhouse through one of these and
// writes actuator targets back. Real adapters (Modbus, MQTT) talk to field hardware; the
// Sim adapter drives the same physics model the web app uses, so the whole edge loop can be
// tested without any hardware. All adapters implement one small interface.
import type { Outputs, Outside } from "@/engine/types";

/** What the controller needs to read back from the field each tick. */
export interface InsideReading {
  temp: number; // °C air
  rh: number; // %
  co2: number; // ppm
  vents: number; // % effective opening (feedback)
  energyScreen: number; // % position (feedback)
  pipeT: number; // °C heating pipe
}

export interface IoAdapter {
  readonly name: string;
  /** Read the current sensor/feedback values. */
  readInside(): Promise<InsideReading>;
  /** Drive the actuators toward these targets. */
  writeOutputs(out: Outputs): Promise<void>;
  /** Sim only: let the (modelled) greenhouse integrate one step. Real adapters omit this. */
  advance?(outside: Outside, dtSec: number): void;
  close?(): Promise<void>;
}
