// MQTT adapter. Depends only on a tiny MqttClient interface (publish + on-message), so it can
// be tested with a mock; in production wrap the `mqtt` package to this interface. Sensors arrive
// on topics and are cached; outputs are published as JSON.
import type { Outputs, Outside } from "@/engine/types";
import type { InsideReading, IoAdapter } from "./types";

export interface MqttClient {
  publish(topic: string, payload: string): Promise<void>;
  onMessage(cb: (topic: string, payload: string) => void): void;
}

export interface MqttMap {
  inputs: Record<keyof InsideReading, string>; // sensor -> topic
  outputBase: string; // actuators published under `${outputBase}/${key}`
}

export class MqttAdapter implements IoAdapter {
  readonly name = "mqtt";
  private last: InsideReading = { temp: 20, rh: 80, co2: 420, vents: 0, energyScreen: 0, pipeT: 30 };
  private topicToKey = new Map<string, keyof InsideReading>();

  constructor(
    private client: MqttClient,
    private map: MqttMap,
  ) {
    for (const [k, topic] of Object.entries(map.inputs) as [keyof InsideReading, string][]) this.topicToKey.set(topic, k);
    client.onMessage((topic, payload) => {
      const key = this.topicToKey.get(topic);
      if (!key) return;
      const v = Number(JSON.parse(payload)?.value ?? payload);
      if (Number.isFinite(v)) this.last[key] = v;
    });
  }

  async readInside(): Promise<InsideReading> {
    return { ...this.last };
  }
  async writeOutputs(out: Outputs): Promise<void> {
    await Promise.all((Object.keys(out) as (keyof Outputs)[]).map((k) => this.client.publish(`${this.map.outputBase}/${k}`, JSON.stringify({ value: out[k] }))));
  }
  advance(_outside: Outside, _dtSec: number): void {}
}

/** In-memory MQTT broker for tests. */
export class MockMqttClient implements MqttClient {
  published: { topic: string; payload: string }[] = [];
  private cbs: ((t: string, p: string) => void)[] = [];
  async publish(topic: string, payload: string): Promise<void> {
    this.published.push({ topic, payload });
  }
  onMessage(cb: (t: string, p: string) => void): void {
    this.cbs.push(cb);
  }
  /** simulate a sensor message arriving */
  emit(topic: string, value: number) {
    for (const cb of this.cbs) cb(topic, JSON.stringify({ value }));
  }
}
