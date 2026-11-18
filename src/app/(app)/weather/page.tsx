"use client";
import { useMemo, useState } from "react";
import { Cloud, Navigation, Sun, Sunrise, Sunset, Thermometer, Wind, Droplets } from "lucide-react";
import { useStore } from "@/lib/store";
import { SITE } from "@/sim/seed";
import { weatherAt } from "@/sim/weather";
import { ahFromRh, dewPoint } from "@/engine/psy";
import { fmtMinutes } from "@/engine/sun";
import { fmt } from "@/lib/vars";
import { TimeCharts, type ChartPanelDef } from "@/components/TimeChart";
import { Card, cx, PageHeader, Stat, Switch } from "@/components/ui";

interface FcVar {
  key: string;
  label: string;
  unit: string;
  color: string;
  digits: number;
  get: (f: ReturnType<typeof weatherAt>, i: number, cum: number[]) => number;
}
const FC_VARS: FcVar[] = [
  { key: "radiation", label: "var.radiation", unit: "W/m²", color: "--s4", digits: 0, get: (f) => f.radiation },
  { key: "radSum", label: "ov.radSum", unit: "J/cm²", color: "--s6", digits: 0, get: (_f, i, cum) => cum[i] },
  { key: "temp", label: "var.outTemp", unit: "°C", color: "--s2", digits: 1, get: (f) => f.temp },
  { key: "wind", label: "var.wind", unit: "m/s", color: "--s7", digits: 1, get: (f) => f.wind },
  { key: "cloud", label: "wx.cloud", unit: "%", color: "--axis", digits: 0, get: (f) => f.cloud * 100 },
  { key: "rh", label: "var.outRh", unit: "%", color: "--s1", digits: 0, get: (f) => f.rh },
  { key: "ah", label: "wx.ah", unit: "g/m³", color: "--s3", digits: 1, get: (f) => ahFromRh(f.temp, f.rh) },
  { key: "windDir", label: "wx.dir", unit: "°", color: "--s5", digits: 0, get: (f) => f.windDir },
];

export default function WeatherPage() {
  const s = useStore();
  const t = s.t;
  const tw = s.twin!;
  const o = tw.outside;
  const lt = tw.lt;
  const now = s.simNow();
  const hourBucket = Math.floor(now / 3600000);
  const [enabled, setEnabled] = useState<string[]>(["radiation", "temp", "wind"]);
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  const fc = useMemo(() => {
    const start = (hourBucket + 1) * 3600000;
    const rows = Array.from({ length: 48 }, (_, i) => {
      const tt = start + i * 3600000;
      return { t: tt, ...weatherAt(tt, SITE.geo, (tt - now) / 3600000) };
    });
    const offset = lt.offsetMin * 60000;
    const cum: number[] = [];
    let run = 0;
    let day = -1;
    for (let i = 0; i < rows.length; i++) {
      const d = Math.floor((rows[i].t + offset) / 86400000);
      if (d !== day) {
        run = 0;
        day = d;
      }
      run += (rows[i].radiation * 3600) / 10000;
      cum.push(run);
    }
    return { rows, cum };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourBucket]);

  const stats = useMemo(() => {
    const out: Record<string, { min: number; max: number; avg: number; next: number }> = {};
    for (const v of FC_VARS) {
      const vals = fc.rows.map((f, i) => v.get(f, i, fc.cum));
      out[v.key] = { min: Math.min(...vals), max: Math.max(...vals), avg: vals.reduce((a, b) => a + b, 0) / vals.length, next: vals[0] };
    }
    return out;
  }, [fc]);

  const x = fc.rows.map((f) => f.t);
  const byUnit = new Map<string, ChartPanelDef>();
  for (const v of FC_VARS) {
    if (!enabled.includes(v.key)) continue;
    const series = { label: t(v.label), values: fc.rows.map((f, i) => v.get(f, i, fc.cum)), color: v.color, digits: v.digits };
    const g = byUnit.get(v.unit);
    if (g) g.series.push(series);
    else byUnit.set(v.unit, { id: v.unit, title: "", unit: v.unit, series: [series], height: 150 });
  }
  const panels = [...byUnit.values()];

  const toggle = (k: string) => setEnabled(enabled.includes(k) ? enabled.filter((x) => x !== k) : [...enabled, k]);

  return (
    <div>
      <PageHeader title={t("wx.title")} sub={t("wx.hint", { lat: SITE.geo.lat, lon: SITE.geo.lon })} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat icon={<Thermometer size={15} />} label={t("var.outTemp")} value={fmt(o.temp, 1)} unit="°C" />
        <Stat icon={<Droplets size={15} />} label={t("var.outRh")} value={fmt(o.rh, 0)} unit="%" sub={`${t("wx.dew")} ${fmt(dewPoint(o.temp, o.rh), 1)} °C`} />
        <Stat icon={<Sun size={15} />} label={t("var.radiation")} value={fmt(o.radiation, 0)} unit="W/m²" sub={`${t("ov.radSum")} ${fmt(tw.live.a.totals.radSum, 0)} J/cm²`} />
        <Stat icon={<Wind size={15} />} label={t("var.wind")} value={fmt(o.wind, 1)} unit="m/s" />
        <Stat icon={<Navigation size={15} style={{ transform: `rotate(${o.windDir + 180}deg)` }} />} label={t("wx.dir")} value={dirs[Math.round(o.windDir / 45) % 8]} sub={`${fmt(o.windDir, 0)}°`} />
        <Stat icon={<Cloud size={15} />} label={t("wx.cloud")} value={fmt(o.cloud * 100, 0)} unit="%" />
        <Stat icon={<Sunrise size={15} />} label={t("wx.sunrise")} value={fmtMinutes(lt.sunriseMin)} sub={<span className="inline-flex items-center gap-1"><Sunset size={12} /> {fmtMinutes(lt.sunsetMin)}</span>} />
      </div>

      <Card className="mt-4 p-4">
        <h3 className="mb-3 text-[15px] font-semibold">{t("wx.forecast")}</h3>
        {panels.length ? <TimeCharts x={x} panels={panels} syncKey="wx" now={now} /> : <p className="py-8 text-center text-sm text-muted">{t("gr.empty")}</p>}
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[12px] text-ink-2">
                <th className="px-3 py-2 text-start font-semibold">{t("wx.item")}</th>
                <th className="px-2 py-2 text-start font-medium">{t("gr.series")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("wx.min")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("wx.max")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("wx.avg")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("wx.now")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("wx.show")}</th>
              </tr>
            </thead>
            <tbody className="num divide-y divide-line">
              {FC_VARS.map((v) => {
                const st = stats[v.key];
                const on = enabled.includes(v.key);
                return (
                  <tr key={v.key} className={cx("hover:bg-surface-2", on && "bg-surface-2/40")}>
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-2 text-ink">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: `var(${v.color})` }} />
                        {t(v.label)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-muted">{v.unit}</td>
                    <td className="px-3 py-1.5 text-end text-ink-2">{fmt(st.min, v.digits)}</td>
                    <td className="px-3 py-1.5 text-end text-ink-2">{fmt(st.max, v.digits)}</td>
                    <td className="px-3 py-1.5 text-end font-semibold text-ink">{fmt(st.avg, v.digits)}</td>
                    <td className="px-3 py-1.5 text-end text-ink-2">{fmt(st.next, v.digits)}</td>
                    <td className="px-3 py-1.5 text-end">
                      <span className="inline-flex justify-end">
                        <Switch checked={on} onChange={() => toggle(v.key)} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
