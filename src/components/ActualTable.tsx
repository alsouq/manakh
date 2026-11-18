"use client";
// The "CLIMATE ACTUAL" grouped values table (IIVO style): measured values, actuator
// positions and settable setpoints, grouped by subsystem. A settable value carries a [V]
// badge that opens the setpoint editor; any measured/position row selects that item so the
// side panel can explain it.
import Link from "next/link";
import { ChartLine, SlidersHorizontal } from "lucide-react";
import { useStore } from "@/lib/store";
import { PERIOD_PARAMS, getField, type Param } from "@/lib/params";
import { fmt } from "@/lib/vars";
import type { ActuatorKey, Strategy } from "@/engine/types";
import type { SectionLive } from "@/sim/twin";
import type { VizTarget } from "@/components/GreenhouseViz";
import { cx } from "@/components/ui";

export type Subsystem = "climate" | "heating" | "ventilation" | "curtain" | "fans" | "co2" | "lighting" | "crop";

export function subsystemsFor(L: SectionLive): Subsystem[] {
  const base: Subsystem[] = ["climate", "heating", "ventilation", "curtain"];
  if (L.def.phys.hasPadFan) base.push("fans");
  base.push("co2");
  if (L.def.phys.hasLamps) base.push("lighting");
  base.push("crop");
  return base;
}

type Row =
  | { t: "group"; label: string }
  | { t: "measured"; label: string; value: number; unit: string; digits: number; select?: VizTarget }
  | { t: "position"; label: string; value: number; select: VizTarget; manual: boolean }
  | { t: "setpoint"; label: string; value: number; unit: string; digits: number; param: Param };

function field(path: string, label: string, doc: Strategy, unit: string, digits: number, min: number, max: number, step: number): Row {
  return { t: "setpoint", label, value: getField(doc, path), unit, digits, param: { scope: "field", path, label, unit, digits, min, max, step } };
}

function rowsFor(sub: Subsystem, L: SectionLive, doc: Strategy): Row[] {
  const sp = L.ctrl.setpoints;
  const a = L.phys.act;
  const area = L.def.area;
  const manual = (k: ActuatorKey) => L.overrides.some((o) => o.actuator === k);
  const period = (k: keyof typeof PERIOD_PARAMS, value: number): Row => ({ t: "setpoint", label: PERIOD_PARAMS[k].label, value, unit: PERIOD_PARAMS[k].unit, digits: PERIOD_PARAMS[k].digits, param: PERIOD_PARAMS[k] });
  const pos = (label: string, k: ActuatorKey, value: number): Row => ({ t: "position", label, value, select: k, manual: manual(k) });
  const meas = (label: string, value: number, unit: string, digits: number, select?: VizTarget): Row => ({ t: "measured", label, value, unit, digits, select });

  switch (sub) {
    case "climate":
      return [
        { t: "group", label: "actual.greenhouseClimate" },
        meas("var.temp", L.phys.temp, "°C", 1, "climate"),
        period("heat", sp.heat),
        period("vent", sp.vent),
        meas("var.rh", L.rh, "%", 0, "climate"),
        period("rhMax", sp.rhMax),
        meas("var.hd", L.hd, "g/m³", 1, "climate"),
        meas("var.co2", L.phys.co2, "ppm", 0, "climate"),
        period("co2", sp.co2),
        meas("var.par", L.flux.par, "µmol", 0),
        meas("var.dli", L.ctrl.state.dli, "mol/m²", 1),
      ];
    case "heating":
      return [
        { t: "group", label: "actual.heatingCircuit" },
        meas("var.pipe", L.phys.pipeT, "°C", 0, "pipe"),
        period("heat", sp.heat),
        field("heating.minPipe", "actual.minPipe", doc, "°C", 0, 0, 70, 5),
        field("heating.minPipeOnHumidity", "actual.minPipeHum", doc, "°C", 0, 0, 70, 5),
        field("heating.maxPipe", "actual.maxPipe", doc, "°C", 0, 40, 90, 5),
        meas("var.heatKw", (L.flux.heatW * area) / 1000, "kW", 0),
      ];
    case "ventilation":
      return [
        { t: "group", label: "var.ventLee" },
        pos("actual.position", "ventLee", a.ventLee),
        { t: "group", label: "var.ventWind" },
        pos("actual.position", "ventWind", a.ventWind),
        { t: "group", label: "st.ventilation" },
        period("vent", sp.vent),
        field("ventilation.pBand", "st.pBand", doc, "°C", 1, 0.5, 10, 0.5),
        field("ventilation.windLimit", "st.windLimit", doc, "m/s", 0, 4, 25, 1),
        field("ventilation.minVent", "st.minVent", doc, "%", 0, 0, 100, 5),
        field("ventilation.maxVent", "st.maxVent", doc, "%", 0, 0, 100, 5),
      ];
    case "curtain":
      return [
        { t: "group", label: "st.screens" },
        pos("var.energyScreen", "energyScreen", a.energyScreen),
        pos("var.shadeScreen", "shadeScreen", a.shadeScreen),
        field("screens.energyCloseBelowRad", "actual.screenCloseRad", doc, "W/m²", 0, 0, 200, 5),
        field("screens.shadeAboveRad", "actual.shadeRad", doc, "W/m²", 0, 200, 1000, 25),
        field("screens.shadeMax", "st.shadeMax", doc, "%", 0, 0, 100, 5),
      ];
    case "fans":
      return [
        { t: "group", label: "st.cooling" },
        pos("var.fans", "fans", a.fans),
        pos("var.pad", "pad", a.pad),
        field("cooling.padStart", "actual.fanStart", doc, "°C", 1, 20, 35, 0.5),
      ];
    case "co2":
      return [
        { t: "group", label: "st.co2Section" },
        meas("var.co2", L.phys.co2, "ppm", 0, "climate"),
        period("co2", sp.co2),
        pos("var.co2Valve", "co2Valve", a.co2Valve),
        field("co2.maxDoseGm2h", "actual.co2Dose", doc, "g/m²/h", 0, 0, 30, 1),
        field("co2.reduceFullAtVent", "actual.co2Reduce", doc, "%", 0, 0, 100, 5),
      ];
    case "lighting":
      return [
        { t: "group", label: "st.lighting" },
        pos("var.lamps", "lamps", a.lamps),
        meas("var.dli", L.ctrl.state.dli, "mol/m²", 1),
        field("lighting.targetDli", "st.targetDli", doc, "mol/m²", 0, 1, 40, 1),
        field("lighting.onBelowRad", "st.onBelowRad", doc, "W/m²", 0, 0, 400, 10),
        field("lighting.offAboveRad", "st.offAboveRad", doc, "W/m²", 0, 0, 500, 10),
      ];
    case "crop": {
      const crop = L.phys.temp - 1.4 + L.flux.radIn / 320 + (L.phys.act.lamps > 0 ? 0.6 : 0);
      return [
        { t: "group", label: "nav.cropTemp" },
        meas("actual.cropTemp", crop, "°C", 1),
        meas("var.temp", L.phys.temp, "°C", 1, "climate"),
        meas("actual.cropDiff", crop - L.phys.temp, "°C", 1),
        meas("var.rh", L.rh, "%", 0, "climate"),
        meas("var.hd", L.hd, "g/m³", 1),
      ];
    }
  }
}

export function ActualTable({ sectionId, subsystem, selected, onSelect, onEdit }: { sectionId: string; subsystem: Subsystem; selected: VizTarget; onSelect: (v: VizTarget) => void; onEdit: (p: Param) => void }) {
  const s = useStore();
  const t = s.t;
  const L = s.twin!.live[sectionId];
  const doc = s.activeVersion(sectionId).doc;
  const rows = rowsFor(subsystem, L, doc);
  const zone = `${L.def.code} · ${s.s.lang === "ar" ? L.def.nameAr : L.def.name}`;

  return (
    <table className="w-full text-[13px]">
      <tbody>
        {rows.map((r, i) => {
          if (r.t === "group")
            return (
              <tr key={i} className="bg-surface-2">
                <td className="px-4 py-1.5 font-semibold text-ink" colSpan={2}>
                  {t(r.label)}
                </td>
                <td className="px-3 py-1.5 text-end text-[12px] text-muted" colSpan={2}>
                  {zone}
                </td>
              </tr>
            );
          const sel = r.t !== "setpoint" && r.select === selected;
          const clickable = r.t === "setpoint" || r.select !== undefined;
          const measuredKey = r.t === "measured" && /^var\.\w+$/.test(r.label) ? r.label.slice(4) : null;
          const posKey = r.t === "position" ? r.select : null;
          return (
            <tr
              key={i}
              onClick={() => (r.t === "setpoint" ? onSelect("climate") : r.select && onSelect(r.select))}
              className={cx("border-b border-line/60", clickable && "cursor-pointer hover:bg-surface-2", sel && "bg-brand-soft/50")}
            >
              <td className="py-1.5 ps-6 pe-2 text-ink-2">
                {measuredKey ? (
                  <Link href={`/graphs?s=${sectionId}:${measuredKey}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 hover:text-brand">
                    {t(r.label)} <ChartLine size={12} className="opacity-40" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {r.t === "setpoint" && <SlidersHorizontal size={12} className="text-muted" />}
                    {t(r.label)}
                  </span>
                )}
              </td>
              <td className="px-2 py-1.5 text-muted">{r.t === "position" ? (r.select === "lamps" || r.select === "pad" || r.select === "fog" ? "" : "%") : r.unit}</td>
              <td className={cx("num px-3 py-1.5 text-end font-semibold", r.t === "position" && r.manual ? "text-[#6250d6] dark:text-[#9085e9]" : "text-ink")}>
                {r.t === "position" && (r.select === "lamps" || r.select === "pad" || r.select === "fog") ? (r.value > 0 ? t("common.on") : t("common.off")) : fmt(r.value, r.t === "setpoint" ? r.digits : r.t === "measured" ? r.digits : 0)}
                {r.t === "position" && !(r.select === "lamps" || r.select === "pad" || r.select === "fog") ? "%" : ""}
              </td>
              <td className="px-2 py-1.5 text-end">
                {r.t === "setpoint" ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(r.param);
                    }}
                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-line-strong bg-surface text-[11px] font-bold text-ink-2 hover:border-brand hover:text-brand"
                    title={t("actual.edit")}
                    aria-label={`${t("actual.edit")} ${t(r.label)}`}
                  >
                    V
                  </button>
                ) : posKey ? (
                  <Link href={`/graphs?s=${sectionId}:${posKey}`} onClick={(e) => e.stopPropagation()} className="inline-flex h-5 w-5 items-center justify-center rounded text-muted hover:text-brand" aria-label={t("sec.graphIt")}>
                    <ChartLine size={13} />
                  </Link>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
