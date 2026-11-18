// A demo hardware I/O model (configuration view, like a process computer's IO setup).
// Generic module catalogue — not any vendor's specific part numbers. Phase 3 binds these
// channels to real Modbus/MQTT points; here it is a settings view over a seeded tree.
import { SECTIONS } from "@/sim/seed";

export type ChannelType = "AO" | "AI" | "DO" | "DI"; // analogue/digital out/in
export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  voltage: string; // "24 V", "0-10 V", "4-20 mA"
  connectedTo?: string; // sensor/actuator label (i18n key or literal)
  sensor?: string; // coupling description
  gross?: number;
  nett?: number;
  matrix?: [number, number, number, number]; // inLow,inHigh -> outLow,outHigh
  offset?: number;
}
export interface IoModule {
  id: string;
  kind: ModuleKind;
  channels: Channel[];
}
export interface Datapoint {
  id: string;
  name: string;
  sectionId?: string;
  modules: IoModule[];
}
export interface Ethercan {
  id: string;
  name: string;
  datapoints: Datapoint[];
}
export interface ControlStation {
  id: string;
  name: string;
  ethercans: Ethercan[];
}

export type ModuleKind = "din4" | "dout4" | "doutRelais2" | "ain4_10v" | "ain4_20ma" | "ain4_420ma" | "aout2_20ma" | "counter";

export interface ModuleSpec {
  kind: ModuleKind;
  label: string; // i18n key
  type: ChannelType;
  count: number;
  voltage: string;
}

export const MODULE_CATALOG: ModuleSpec[] = [
  { kind: "din4", label: "io.m.din4", type: "DI", count: 4, voltage: "24 V" },
  { kind: "dout4", label: "io.m.dout4", type: "DO", count: 4, voltage: "24 V" },
  { kind: "doutRelais2", label: "io.m.doutRelais2", type: "DO", count: 2, voltage: "230 V" },
  { kind: "ain4_10v", label: "io.m.ain4_10v", type: "AI", count: 4, voltage: "0-10 V" },
  { kind: "ain4_20ma", label: "io.m.ain4_20ma", type: "AI", count: 4, voltage: "0-20 mA" },
  { kind: "ain4_420ma", label: "io.m.ain4_420ma", type: "AI", count: 4, voltage: "4-20 mA" },
  { kind: "aout2_20ma", label: "io.m.aout2_20ma", type: "AO", count: 2, voltage: "0-20 mA" },
  { kind: "counter", label: "io.m.counter", type: "DI", count: 2, voltage: "24 V" },
];

export const moduleSpec = (kind: ModuleKind) => MODULE_CATALOG.find((m) => m.kind === kind)!;

let seq = 0;
const uid = (p: string) => `${p}${++seq}`;

function channels(spec: ModuleSpec, labels: string[]): Channel[] {
  return Array.from({ length: spec.count }, (_, i) => ({
    id: uid("ch"),
    name: `${spec.type} ${i + 1}`,
    type: spec.type,
    voltage: spec.voltage,
    connectedTo: labels[i],
    ...(spec.type === "AI" || spec.type === "AO"
      ? { sensor: spec.type === "AI" ? "io.couple.pt1000" : "io.couple.valve", gross: 14483, nett: 16.52, matrix: [0, 32767, 0, 50] as [number, number, number, number], offset: 54 }
      : {}),
  }));
}

function mod(kind: ModuleKind, labels: string[]): IoModule {
  return { id: uid("mod"), kind, channels: channels(moduleSpec(kind), labels) };
}

/** Build a believable IO tree: one datapoint per section with sensor & actuator modules. */
export function buildIoTree(): ControlStation[] {
  seq = 0;
  const ethercans: Ethercan[] = [];
  let dp = 0;
  for (let e = 0; e < Math.ceil(SECTIONS.length / 2); e++) {
    const datapoints: Datapoint[] = [];
    for (let k = 0; k < 2 && dp < SECTIONS.length; k++, dp++) {
      const d = SECTIONS[dp];
      datapoints.push({
        id: uid("dp"),
        name: `Datapoint ${dp + 1} — ${d.code}`,
        sectionId: d.id,
        modules: [
          mod("ain4_10v", ["var.temp", "var.rh", "var.co2", "var.par"]),
          mod("ain4_420ma", ["var.pipe", "var.ec", "var.ph", "io.spare"]),
          mod("aout2_20ma", ["var.pipe", "var.co2Valve"]),
          mod("dout4", ["var.ventLee", "var.ventWind", "var.energyScreen", "var.shadeScreen"]),
          mod("din4", ["io.limitOpen", "io.limitClose", "io.rainSwitch", "io.doorSwitch"]),
          ...(d.phys.hasPadFan ? [mod("doutRelais2", ["var.fans", "var.pad"])] : []),
          ...(d.phys.hasLamps ? [mod("dout4", ["var.lamps", "io.spare", "io.spare", "io.spare"])] : []),
        ],
      });
    }
    ethercans.push({ id: uid("eth"), name: `Ethercan ${e + 1}`, datapoints });
  }
  return [{ id: uid("cs"), name: "Control station 1", ethercans }];
}

