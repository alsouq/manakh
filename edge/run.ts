// CLI entry for the edge service. With no cloud env it runs the simulated device so you can see
// the loop work locally; with EDGE_SYNC_URL + EDGE_TOKEN it pushes readings to the cloud. Point
// it at Modbus/MQTT by swapping the adapter (see adapters/). Run: npx tsx edge/run.ts
import { localTime } from "@/engine/sun";
import { weatherAt } from "@/sim/weather";
import { SECTIONS, SITE, tomatoStrategy } from "@/sim/seed";
import { SimAdapter } from "./adapters/sim";
import { ReadingBuffer } from "./buffer";
import { HttpSync, NoopSync } from "./sync";
import { EdgeController } from "./controller";

export async function runSim(opts: { intervalMs?: number; sectionId?: string } = {}) {
  const sectionId = opts.sectionId ?? SECTIONS[0].id;
  const def = SECTIONS.find((d) => d.id === sectionId)!;
  const geo = SITE.geo;
  const weather = (t: number) => weatherAt(t, geo);
  const adapter = new SimAdapter(def.phys, 15, weather(Date.now()));
  const buffer = new ReadingBuffer(`edge/.data/${sectionId}.jsonl`);
  const sync = process.env.EDGE_SYNC_URL ? new HttpSync(process.env.EDGE_SYNC_URL, process.env.EDGE_TOKEN ?? "", sectionId) : new NoopSync();
  const edge = new EdgeController(tomatoStrategy(), { sectionId, geo, transmission: def.phys.transmission, weather }, adapter, buffer, sync);

  const interval = opts.intervalMs ?? 2000;
  let n = 0;
  console.log(`edge: section ${sectionId}, adapter ${adapter.name}, sync ${sync.constructor.name}`);
  const timer = setInterval(async () => {
    const now = Date.now();
    const ctrl = await edge.tick(now, 10);
    if (++n % 5 === 0) await edge.syncNow();
    const lt = localTime(now, geo.tz, geo.lat, geo.lon);
    const inside = await adapter.readInside();
    console.log(
      `${String(lt.minuteOfDay / 60 | 0).padStart(2, "0")}:${String(lt.minuteOfDay % 60).padStart(2, "0")} ` +
        `T ${inside.temp.toFixed(1)} -> heat ${ctrl.setpoints.heat.toFixed(1)}/vent ${ctrl.setpoints.vent.toFixed(1)} ` +
        `| pipe ${ctrl.outputs.pipe.toFixed(0)} vents ${ctrl.outputs.ventLee.toFixed(0)}% screen ${ctrl.outputs.energyScreen.toFixed(0)}% ` +
        `| buffer ${buffer.pending}`,
    );
  }, interval);
  return () => clearInterval(timer);
}

if (process.argv[1] && process.argv[1].endsWith("run.ts")) {
  runSim().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
