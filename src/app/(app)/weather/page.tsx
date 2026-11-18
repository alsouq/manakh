"use client";
import { useMemo } from "react";
import { Cloud, Navigation, Sunrise, Sunset, Thermometer, Wind, Droplets, Sun } from "lucide-react";
import { useStore } from "@/lib/store";
import { SITE } from "@/sim/seed";
import { weatherAt } from "@/sim/weather";
import { dewPoint } from "@/engine/psy";
import { fmtMinutes } from "@/engine/sun";
import { fmt, fmtTime } from "@/lib/vars";
import { TimeCharts, type ChartPanelDef } from "@/components/TimeChart";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui";

export default function WeatherPage() {
  const s = useStore();
  const t = s.t;
  const tw = s.twin!;
  const o = tw.outside;
  const lt = tw.lt;
  const now = s.simNow();
  const hourBucket = Math.floor(now / 3600000);

  const fc = useMemo(() => {
    const start = (hourBucket + 1) * 3600000;
    return Array.from({ length: 48 }, (_, i) => {
      const tt = start + i * 3600000;
      return { t: tt, ...weatherAt(tt, SITE.geo, (tt - now) / 3600000) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourBucket]);

  const H = tw.history;
  const from = Math.max(0, H.t.findIndex((x) => x >= now - 48 * 3600000));
  const pastT = H.t.slice(from);
  const x = [...pastT, ...fc.map((f) => f.t)];
  const pad = (n: number) => Array(n).fill(null);
  const past = (k: keyof typeof H.out) => [...H.out[k].slice(from), ...pad(fc.length)];
  const fut = (k: "temp" | "rh" | "radiation" | "wind") => [...pad(pastT.length - 1), H.out[k === "temp" ? "outTemp" : k === "rh" ? "outRh" : k][H.out.outTemp.length - 1], ...fc.map((f) => f[k])];

  const panels: ChartPanelDef[] = [
    { id: "t", title: t("var.outTemp"), unit: "°C", series: [{ label: t("var.outTemp"), values: past("outTemp"), color: "--s2" }, { label: t("wx.forecast"), values: fut("temp"), color: "--s2", dash: true }] },
    { id: "r", title: t("var.radiation"), unit: "W/m²", series: [{ label: t("var.radiation"), values: past("radiation"), color: "--s4", digits: 0 }, { label: t("wx.forecast"), values: fut("radiation"), color: "--s4", dash: true, digits: 0 }], height: 150 },
    { id: "h", title: t("var.outRh"), unit: "%", series: [{ label: t("var.outRh"), values: past("outRh"), color: "--s1", digits: 0 }, { label: t("wx.forecast"), values: fut("rh"), color: "--s1", dash: true, digits: 0 }], height: 130 },
    { id: "w", title: t("var.wind"), unit: "m/s", series: [{ label: t("var.wind"), values: past("wind"), color: "--s7" }, { label: t("wx.forecast"), values: fut("wind"), color: "--s7", dash: true }], height: 130 },
  ];
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  return (
    <div>
      <PageHeader title={t("wx.title")} sub={t("wx.hint", { lat: SITE.geo.lat, lon: SITE.geo.lon })} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat icon={<Thermometer size={15} />} label={t("var.outTemp")} value={fmt(o.temp, 1)} unit="°C" />
        <Stat icon={<Droplets size={15} />} label={t("var.outRh")} value={fmt(o.rh, 0)} unit="%" sub={`${t("wx.dew")} ${fmt(dewPoint(o.temp, o.rh), 1)} °C`} />
        <Stat icon={<Sun size={15} />} label={t("var.radiation")} value={fmt(o.radiation, 0)} unit="W/m²" sub={`${t("ov.radSum")} ${fmt(tw.live.a.totals.radSum, 0)} J/cm²`} />
        <Stat icon={<Wind size={15} />} label={t("var.wind")} value={fmt(o.wind, 1)} unit="m/s" />
        <Stat
          icon={<Navigation size={15} style={{ transform: `rotate(${o.windDir + 180}deg)` }} />}
          label={t("wx.dir")}
          value={dirs[Math.round(o.windDir / 45) % 8]}
          sub={`${fmt(o.windDir, 0)}°`}
        />
        <Stat icon={<Cloud size={15} />} label={t("wx.cloud")} value={fmt(o.cloud * 100, 0)} unit="%" />
        <Stat icon={<Sunrise size={15} />} label={t("wx.sunrise")} value={fmtMinutes(lt.sunriseMin)} sub={<span className="inline-flex items-center gap-1"><Sunset size={12} /> {fmtMinutes(lt.sunsetMin)}</span>} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="p-4">
          <h3 className="mb-3 text-[15px] font-semibold">{t("wx.past")}</h3>
          <TimeCharts x={x} panels={panels} syncKey="wx" now={now} />
        </Card>
        <Card>
          <CardHeader title={t("wx.hourly")} />
          <div className="max-h-[720px] overflow-auto">
            <table className="num w-full text-[13px]">
              <thead className="sticky top-0 bg-surface text-[11px] text-muted">
                <tr>
                  <th className="px-4 py-1.5 text-start font-medium">{t("wx.time")}</th>
                  <th className="px-2 py-1.5 text-end font-medium">°C</th>
                  <th className="px-2 py-1.5 text-end font-medium">%</th>
                  <th className="px-2 py-1.5 text-end font-medium">W/m²</th>
                  <th className="px-4 py-1.5 text-end font-medium">m/s</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {fc.slice(0, 36).map((f) => (
                  <tr key={f.t}>
                    <td className="px-4 py-1.5 text-ink-2">{fmtTime(f.t, SITE.geo.tz, true)}</td>
                    <td className="px-2 py-1.5 text-end font-semibold">{fmt(f.temp, 1)}</td>
                    <td className="px-2 py-1.5 text-end">{fmt(f.rh, 0)}</td>
                    <td className="px-2 py-1.5 text-end">{fmt(f.radiation, 0)}</td>
                    <td className="px-4 py-1.5 text-end">{fmt(f.wind, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
