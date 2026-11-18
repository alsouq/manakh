"use client";
import { Factory, Flame, Leaf, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { SECTIONS } from "@/sim/seed";
import { fmt, SERIES, sectionSlot } from "@/lib/vars";
import { TimeCharts, type ChartPanelDef } from "@/components/TimeChart";
import { Badge, Bar, Card, CardHeader, PageHeader, Stat } from "@/components/ui";

export default function EnergyPage() {
  const s = useStore();
  const t = s.t;
  const tw = s.twin!;
  const heatKw = SECTIONS.reduce((x, d) => x + (tw.live[d.id].flux.heatW * d.area) / 1000, 0);
  const tot = (k: "gasM3" | "elecKwh" | "co2Kg") => SECTIONS.reduce((x, d) => x + tw.live[d.id].totals[k], 0);
  const maxGas = Math.max(1, ...SECTIONS.map((d) => tw.live[d.id].totals.gasM3 / d.area));
  const H = tw.history;
  const now = s.simNow();
  const from = Math.max(0, H.t.findIndex((x) => x >= now - 48 * 3600000));
  const panels: ChartPanelDef[] = [
    { id: "g", title: t("var.gas"), unit: "m³/h", series: [{ label: t("var.gas"), values: H.out.gas.slice(from), color: "--s2" }] },
    {
      id: "h",
      title: t("var.heatKw"),
      unit: "kW",
      series: SECTIONS.map((d) => ({ label: s.sectionName(d.id), values: H.sec[d.id].heatKw.slice(from), color: SERIES[sectionSlot[d.id]], digits: 0 })),
    },
    { id: "e", title: t("var.elec"), unit: "kW", series: [{ label: t("var.elec"), values: H.out.elec.slice(from), color: "--s7", digits: 0 }], height: 130 },
  ];
  return (
    <div>
      <PageHeader title={t("en.title")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          icon={<Factory size={15} />}
          label={t("en.boiler")}
          value={heatKw > 1 ? t("en.running") : t("en.idle")}
          sub={<Badge tone={heatKw > 1 ? "warning" : "neutral"}>{fmt(heatKw, 0)} kW</Badge>}
        />
        <Stat icon={<Flame size={15} />} label={t("en.gasNow")} value={fmt(tw.siteNow.gasM3h, 1)} unit="m³/h" />
        <Stat icon={<Flame size={15} />} label={t("en.gasToday")} value={fmt(tot("gasM3"), 0)} unit="m³" />
        <Stat icon={<Zap size={15} />} label={t("en.elecToday")} value={fmt(tot("elecKwh"), 0)} unit="kWh" />
        <Stat icon={<Leaf size={15} />} label={t("en.co2Today")} value={fmt(tot("co2Kg"), 0)} unit="kg" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="p-4">
          <TimeCharts x={H.t.slice(from)} panels={panels} syncKey="energy" />
        </Card>
        <Card>
          <CardHeader title={t("en.perSection")} />
          <ul className="space-y-4 px-4 pb-4">
            {SECTIONS.map((d) => {
              const L = tw.live[d.id];
              const perM2 = L.totals.gasM3 / d.area;
              return (
                <li key={d.id}>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink">{s.sectionName(d.id)}</span>
                    <span className="num font-semibold">{fmt(L.totals.gasM3, 0)} m³</span>
                  </div>
                  <Bar value={(perM2 / maxGas) * 100} color={`var(${SERIES[sectionSlot[d.id]]})`} className="mt-1.5" />
                  <div className="num mt-1 flex justify-between text-[12px] text-muted">
                    <span>
                      {fmt(perM2 * 1000, 1)} L/m² {t("en.perM2")}
                    </span>
                    <span>
                      {fmt(L.totals.elecKwh, 0)} kWh · CO₂ {fmt(L.totals.co2Kg, 0)} kg
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
