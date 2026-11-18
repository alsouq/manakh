// Edge-service tests. No hardware: the Sim adapter closes the loop, and Modbus/MQTT are
// exercised with in-memory mocks. Run: npx tsx edge/edge.test.ts
import { weatherAt } from "@/sim/weather";
import { SECTIONS, SITE, tomatoStrategy } from "@/sim/seed";
import { SimAdapter } from "./adapters/sim";
import { ModbusAdapter, MockModbusClient, type ModbusMap } from "./adapters/modbus";
import { MqttAdapter, MockMqttClient, type MqttMap } from "./adapters/mqtt";
import { ReadingBuffer } from "./buffer";
import { NoopSync, type CloudSync, type SyncResult } from "./sync";
import { EdgeController } from "./controller";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { join } from "node:path";

let fails = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) fails++;
};
const tmp = (name: string) => join(tmpdir(), `manakh-edge-${name}-${Date.now()}.jsonl`);

async function run() {
  const def = SECTIONS[0];
  const geo = SITE.geo;
  const weather = (t: number) => weatherAt(t, geo);

  // ---- 1. Sim edge loop: a cold night should drive heating and hold temperature up ----
  {
    // pick a UTC time that is local night (~02:00 Cairo)
    const base = Math.floor(Date.now() / 86400000) * 86400000; // local-ish midnight UTC
    const start = base + 0 * 3600000; // 02:00 local (UTC+2)
    const file = tmp("sim-night");
    const adapter = new SimAdapter(def.phys, 15, weather(start));
    const buffer = new ReadingBuffer(file);
    const edge = new EdgeController(tomatoStrategy(), { sectionId: def.id, geo, transmission: def.phys.transmission, weather }, adapter, buffer, new NoopSync());
    let t = start;
    let heatedAt = 0;
    for (let i = 0; i < 240; i++) {
      t += 30000;
      const ctrl = await edge.tick(t, 30);
      if (ctrl.outputs.pipe > 0) heatedAt++;
    }
    const inside = await adapter.readInside();
    const nightHeat = tomatoStrategy().periods.find((p) => p.name === "Night")!.heat;
    ok(Number.isFinite(inside.temp) && inside.temp > 10 && inside.temp < 40, `sim night: temperature stays sane (${inside.temp.toFixed(1)} °C)`);
    ok(inside.temp > nightHeat - 3, `sim night: heating holds temp near the ${nightHeat} °C night setpoint (${inside.temp.toFixed(1)})`);
    ok(heatedAt > 20, `sim night: the heating pipe ran (${heatedAt} ticks)`);
    ok(buffer.pending === 240 * 6, `buffer stored every reading once (${buffer.pending})`);
    rmSync(file, { force: true });
  }

  // ---- 2. Sim edge loop: a hot midday should open the vents ----
  {
    const base = Math.floor(Date.now() / 86400000) * 86400000;
    const start = base + 10 * 3600000; // ~12:00 local
    const file = tmp("sim-day");
    const adapter = new SimAdapter(def.phys, 15, weather(start));
    const buffer = new ReadingBuffer(file);
    const edge = new EdgeController(tomatoStrategy(), { sectionId: def.id, geo, transmission: def.phys.transmission, weather }, adapter, buffer, new NoopSync());
    let t = start;
    let ventedAt = 0;
    for (let i = 0; i < 240; i++) {
      t += 30000;
      const ctrl = await edge.tick(t, 30);
      if (ctrl.outputs.ventLee > 5) ventedAt++;
    }
    ok(ventedAt > 20, `sim day: the vents opened during the warm day (${ventedAt} ticks)`);
    rmSync(file, { force: true });
  }

  // ---- 3. Modbus adapter: raw<->engineering scaling round-trips ----
  {
    const client = new MockModbusClient();
    const map: ModbusMap = {
      inputs: {
        temp: { addr: 0, scale: 10, offset: 0 }, // 21.5 °C -> raw 215
        rh: { addr: 1, scale: 10, offset: 0 },
        co2: { addr: 2, scale: 1, offset: 0 },
        vents: { addr: 3, scale: 100, offset: 0 }, // % *100
        energyScreen: { addr: 4, scale: 100, offset: 0 },
        pipeT: { addr: 5, scale: 10, offset: 0 },
      },
      outputs: { pipe: { addr: 10, scale: 10, offset: 0 }, ventLee: { addr: 11, scale: 100, offset: 0 }, co2Valve: { addr: 12, scale: 100, offset: 0 } },
    };
    client.set(0, 215);
    client.set(1, 780);
    client.set(2, 640);
    client.set(3, 5000);
    client.set(4, 10000);
    client.set(5, 410);
    const mb = new ModbusAdapter(client, map);
    const read = await mb.readInside();
    ok(read.temp === 21.5 && read.rh === 78 && read.co2 === 640 && read.vents === 50 && read.energyScreen === 100 && read.pipeT === 41, "modbus: registers scale to engineering units");
    await mb.writeOutputs({ pipe: 45, ventLee: 60, ventWind: 0, energyScreen: 0, shadeScreen: 0, lamps: 0, co2Valve: 30, fans: 0, pad: 0, fog: 0 });
    ok((await client.readHolding(10, 1))[0] === 450 && (await client.readHolding(11, 1))[0] === 6000 && (await client.readHolding(12, 1))[0] === 3000, "modbus: outputs scale back to raw registers");
  }

  // ---- 4. MQTT adapter: cached sensor messages + published outputs ----
  {
    const client = new MockMqttClient();
    const map: MqttMap = { inputs: { temp: "gh/a/temp", rh: "gh/a/rh", co2: "gh/a/co2", vents: "gh/a/vents", energyScreen: "gh/a/screen", pipeT: "gh/a/pipe" }, outputBase: "gh/a/out" };
    const mq = new MqttAdapter(client, map);
    client.emit("gh/a/temp", 22.3);
    client.emit("gh/a/co2", 710);
    const read = await mq.readInside();
    ok(read.temp === 22.3 && read.co2 === 710, "mqtt: sensor messages update the cached reading");
    await mq.writeOutputs({ pipe: 40, ventLee: 25, ventWind: 0, energyScreen: 0, shadeScreen: 0, lamps: 0, co2Valve: 0, fans: 0, pad: 0, fog: 0 });
    const ventMsg = client.published.find((p) => p.topic === "gh/a/out/ventLee");
    ok(!!ventMsg && JSON.parse(ventMsg.payload).value === 25, "mqtt: outputs publish to per-actuator topics");
  }

  // ---- 5. Sync: a reconnecting cloud marks readings synced and can push a new strategy ----
  {
    const file = tmp("sync");
    const buffer = new ReadingBuffer(file);
    const def2 = SECTIONS[0];
    let pushed = 0;
    const newStrat = tomatoStrategy();
    newStrat.periods[0].heat = 99; // sentinel
    const sync: CloudSync = {
      async push(readings): Promise<SyncResult> {
        pushed += readings.length;
        return { ok: true, strategy: newStrat };
      },
    };
    const edge = new EdgeController(tomatoStrategy(), { sectionId: def2.id, geo, transmission: def2.phys.transmission, weather }, new SimAdapter(def2.phys, 15, weather(Date.now())), buffer, sync);
    await edge.tick(Date.now(), 30);
    const okSync = await edge.syncNow();
    ok(okSync && pushed === 6, `sync: buffered readings pushed on reconnect (${pushed})`);
    ok(edge.strategy.periods[0].heat === 99, "sync: the cloud's newer strategy is adopted");
    ok(buffer.pending === 0, "sync: pushed readings are marked synced");
    rmSync(file, { force: true });
  }

  console.log(fails ? `\n${fails} FAILED` : "\nALL EDGE TESTS PASSED");
  process.exit(fails ? 1 : 0);
}

run();
