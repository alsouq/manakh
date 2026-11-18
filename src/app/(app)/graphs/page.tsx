"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Save, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { SECTIONS, SITE } from "@/sim/seed";
import { VARS, sectionSlot, SERIES, fmtTime } from "@/lib/vars";
import { TimeCharts, type ChartPanelDef, type ChartSeries } from "@/components/TimeChart";
import { Button, Card, cx, Empty, Input, PageHeader, Segmented } from "@/components/ui";

const GROUPS: { title: string; vars: string[] }[] = [
  { title: "sec.climate", vars: ["temp", "rh", "hd", "vpd", "co2", "par", "dli"] },
  { title: "sec.setpoint", vars: ["heatSp", "ventSp", "co2Sp", "rhMax"] },
  { title: "sec.installations", vars: ["ventLee", "ventWind", "pipe", "energyScreen", "shadeScreen", "co2Valve", "lamps", "fans", "fog", "heatKw"] },
  { title: "nav.water", vars: ["water", "drain", "ec", "ph", "radSum"] },
];
const OUT_VARS = ["outTemp", "outRh", "radiation", "wind", "gas", "elec"];

const VAR_COLOR: Record<string, string> = {
  temp: "--s2", heatSp: "--s8", ventSp: "--s1", rh: "--s1", rhMax: "--s8", co2: "--s3", co2Sp: "--s8", hd: "--s3", vpd: "--s7", par: "--s4", dli: "--s4",
  ventLee: "--s1", ventWind: "--s7", energyScreen: "--s5", shadeScreen: "--s4", co2Valve: "--s3", lamps: "--s4", fans: "--s6", fog: "--s1", pipe: "--s8", heatKw: "--s2",
  water: "--s1", drain: "--s3", ec: "--s7", ph: "--s5", radSum: "--s4",
  outTemp: "--axis", outRh: "--axis", radiation: "--s4", wind: "--s7", gas: "--s2", elec: "--s7",
};
const DASHED = new Set(["heatSp", "ventSp", "co2Sp", "rhMax"]);
const STEP = new Set(["energyScreen", "shadeScreen", "lamps", "fog", "ec", "ph"]);

function parse(list: string[]) {
  const secs = new Set<string>();
  const vars = new Set<string>();
  const outs = new Set<string>();
  for (const s of list) {
    const [a, b] = s.split(":");
    if (!b) continue;
    if (a === "out") outs.add(b);
    else {
      secs.add(a);
      vars.add(b);
    }
  }
  return { secs: [...secs], vars: [...vars], outs: [...outs] };
}

function GraphsInner() {
  const s = useStore();
  const t = s.t;
  const params = useSearchParams();
  const initial = useMemo(() => {
    const q = params.get("s");
    return parse(q ? q.split(",") : ["a:temp", "a:heatSp", "a:ventSp", "out:outTemp"]);
  }, [params]);
  const [secs, setSecs] = useState<string[]>(initial.secs.length ? initial.secs : ["a"]);
  const [vars, setVars] = useState<string[]>(initial.vars);
  const [outs, setOuts] = useState<string[]>(initial.outs);
  const [range, setRange] = useState<number>(Number(params.get("h")) || 24);
  const [viewName, setViewName] = useState("");
  useEffect(() => {
    setSecs(initial.secs.length ? initial.secs : ["a"]);
    setVars(initial.vars);
    setOuts(initial.outs);
  }, [initial]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const H = s.twin!.history;
  const now = s.simNow();
  const from = H.t.findIndex((x) => x >= now - range * 3600000);
  const i0 = from < 0 ? 0 : from;
  const x = H.t.slice(i0);
  const multi = secs.length > 1;
  const orderedSecs = SECTIONS.map((d) => d.id).filter((id) => secs.includes(id));

  const panels: ChartPanelDef[] = useMemo(() => {
    const byGroup = new Map<string, ChartSeries[]>();
    const add = (key: string, series: ChartSeries) => {
      const g = VARS[key as keyof typeof VARS].group;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(series);
    };
    const allVars = GROUPS.flatMap((g) => g.vars).filter((v) => vars.includes(v));
    for (const v of allVars)
      for (const sid of orderedSecs)
        add(v, {
          label: `${multi ? SECTIONS.find((d) => d.id === sid)!.code + " · " : ""}${t(`var.${v}`)}`,
          values: H.sec[sid][v as keyof (typeof H.sec)[string]].slice(i0),
          color: multi ? SERIES[sectionSlot[sid]] : VAR_COLOR[v],
          dash: DASHED.has(v),
          step: STEP.has(v),
          digits: VARS[v as keyof typeof VARS].digits,
        });
    for (const v of OUT_VARS.filter((o) => outs.includes(o)))
      add(v, { label: t(`var.${v}`), values: H.out[v as keyof typeof H.out].slice(i0), color: VAR_COLOR[v], width: 1.5, digits: VARS[v as keyof typeof VARS].digits });
    return [...byGroup.entries()].map(([g, series]) => {
      const first = series.length ? Object.entries(VARS).find(([, m]) => m.group === g)! : null;
      const unit = first ? (s.s.lang === "ar" ? first[1].unitAr : first[1].unit) : "";
      const pct = g === "% pos";
      const names = [...new Set(series.map((x) => x.label.replace(/^[A-D] · /, "")))];
      const title = names.length > 3 ? `${names.slice(0, 3).join(" · ")} …` : names.join(" · ");
      return { id: g, title, unit, series, height: series.length > 3 ? 220 : 180, ...(pct ? { yMin: 0, yMax: 100 } : {}) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vars.join(), outs.join(), orderedSecs.join(), i0, H.t.length, s.s.lang, multi]);

  const exportCsv = () => {
    const cols = panels.flatMap((p) => p.series);
    const rows = [["time", ...cols.map((c) => c.label)].join(",")];
    x.forEach((tt, i) => rows.push([fmtTime(tt, SITE.geo.tz, true), ...cols.map((c) => (c.values[i] ?? "") as number)].join(",")));
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `manakh-graph-${new Date(now).toISOString().slice(0, 16)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const current = [...orderedSecs.flatMap((sid) => vars.map((v) => `${sid}:${v}`)), ...outs.map((o) => `out:${o}`)];

  return (
    <div>
      <PageHeader
        title={t("gr.title")}
        sub={t("gr.hint")}
        right={
          <>
            <Segmented value={range} onChange={setRange} options={[6, 24, 48, 168].map((h) => ({ value: h, label: h === 168 ? "7d" : `${h}h` }))} />
            <Button size="sm" onClick={exportCsv} disabled={!panels.length}>
              <Download size={15} /> {t("common.export")}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit p-4 lg:sticky lg:top-[72px]">
          <div className="text-[13px] font-semibold">{t("gr.sections")}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SECTIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => toggle(secs, setSecs, d.id)}
                className={cx("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm", secs.includes(d.id) ? "border-transparent bg-ink text-bg" : "border-line-strong text-ink-2")}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${SERIES[sectionSlot[d.id]]})` }} />
                {d.code}
              </button>
            ))}
          </div>
          <div className="mt-4 max-h-[52vh] space-y-3 overflow-auto pe-1">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <div className="mb-1 text-[12px] font-semibold text-muted">{t(g.title)}</div>
                {g.vars.map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px] text-ink">
                    <input type="checkbox" className="accent-[var(--brand)]" checked={vars.includes(v)} onChange={() => toggle(vars, setVars, v)} />
                    {t(`var.${v}`)}
                  </label>
                ))}
              </div>
            ))}
            <div>
              <div className="mb-1 text-[12px] font-semibold text-muted">{t("gr.outside")}</div>
              {OUT_VARS.map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px] text-ink">
                  <input type="checkbox" className="accent-[var(--brand)]" checked={outs.includes(v)} onChange={() => toggle(outs, setOuts, v)} />
                  {t(`var.${v}`)}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <div className="text-[13px] font-semibold">{t("gr.views")}</div>
            <ul className="mt-1.5 space-y-0.5">
              {s.s.views.map((v) => (
                <li key={v.id} className="group flex items-center justify-between">
                  <button
                    className="truncate py-1 text-start text-[13px] text-brand hover:underline"
                    onClick={() => {
                      const p = parse(v.series);
                      setSecs(p.secs.length ? p.secs : ["a"]);
                      setVars(p.vars);
                      setOuts(p.outs);
                      setRange(v.rangeH);
                    }}
                  >
                    {v.name}
                  </button>
                  <button className="text-muted opacity-0 group-hover:opacity-100" aria-label={t("common.delete")} onClick={() => s.deleteView(v.id)}>
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-1.5">
              <Input className="h-8 text-[13px]" placeholder={t("gr.viewName")} value={viewName} onChange={(e) => setViewName(e.target.value)} />
              <Button
                size="sm"
                disabled={!viewName.trim() || !current.length}
                onClick={() => {
                  s.saveView({ name: viewName.trim(), series: current, rangeH: range });
                  setViewName("");
                }}
                aria-label={t("gr.saveView")}
              >
                <Save size={14} />
              </Button>
            </div>
          </div>
        </Card>
        <Card className="min-w-0 p-4">{panels.length ? <TimeCharts x={x} panels={panels} syncKey="graphs" /> : <Empty title={t("gr.empty")} />}</Card>
      </div>
    </div>
  );
}

export default function GraphsPage() {
  return (
    <Suspense>
      <GraphsInner />
    </Suspense>
  );
}
