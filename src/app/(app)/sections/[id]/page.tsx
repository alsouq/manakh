"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ChartLine, Hand, RotateCcw } from "lucide-react";
import type { ActuatorKey } from "@/engine/types";
import { useStore } from "@/lib/store";
import { SITE } from "@/sim/seed";
import { fmt, fmtTime } from "@/lib/vars";
import type { Param } from "@/lib/params";
import { GreenhouseViz, type VizTarget } from "@/components/GreenhouseViz";
import { ActualTable, subsystemsFor, type Subsystem } from "@/components/ActualTable";
import { SetpointEditorDialog } from "@/components/SetpointEditorDialog";
import { BreakdownView, ReasonList } from "@/components/Explain";
import { TimeCharts, type ChartPanelDef } from "@/components/TimeChart";
import { Badge, Button, Card, CardHeader, Dialog, Field, Segmented } from "@/components/ui";

const ACTS: ActuatorKey[] = ["ventLee", "ventWind", "pipe", "energyScreen", "shadeScreen", "co2Valve", "lamps", "fans", "pad", "fog"];

export default function SectionLivePage() {
  const { id } = useParams<{ id: string }>();
  const s = useStore();
  const t = s.t;
  const tw = s.twin!;
  const L = tw.live[id];
  const [sel, setSel] = useState<VizTarget>("climate");
  const [ovr, setOvr] = useState<ActuatorKey | null>(null);
  const [sub, setSub] = useState<Subsystem>("climate");
  const [editParam, setEditParam] = useState<Param | null>(null);
  const [range, setRange] = useState(288);
  if (!L) return null;
  const d = L.def;
  const bd = L.ctrl.breakdown;
  const available = ACTS.filter((k) => !(k === "fans" || k === "pad" ? !d.phys.hasPadFan : k === "lamps" ? !d.phys.hasLamps : k === "fog" ? !d.phys.hasFog : false));
  const manualOf = (k: ActuatorKey) => L.overrides.find((o) => o.actuator === k);
  const posOf = (k: ActuatorKey) => (k === "pipe" ? L.phys.pipeT : L.phys.act[k]);
  const fmtPos = (k: ActuatorKey, v: number) => (k === "pipe" ? (v > 0 ? `${fmt(v, 0)} °C` : t("common.off")) : k === "lamps" || k === "pad" || k === "fog" ? (v > 0 ? t("common.on") : t("common.off")) : `${fmt(v, 0)}%`);
  const subs = subsystemsFor(L);

  const H = tw.history;
  const n = H.t.length;
  const from = Math.max(0, n - range);
  const x = H.t.slice(from);
  const h = H.sec[id];
  const sl = (a: number[]) => a.slice(from);
  const panels: ChartPanelDef[] = [
    {
      id: "t",
      title: t("var.temp"),
      unit: "°C",
      series: [
        { label: t("var.temp"), values: sl(h.temp), color: "--s2" },
        { label: t("var.heatSp"), values: sl(h.heatSp), color: "--s8", dash: true },
        { label: t("var.ventSp"), values: sl(h.ventSp), color: "--s1", dash: true },
        { label: t("var.outTemp"), values: H.out.outTemp.slice(from), color: "--axis", width: 1.5 },
      ],
    },
    {
      id: "rh",
      title: t("var.rh"),
      unit: "%",
      series: [
        { label: t("var.rh"), values: sl(h.rh), color: "--s1", digits: 0 },
        { label: t("var.rhMax"), values: sl(h.rhMax), color: "--s8", dash: true, digits: 0 },
      ],
      height: 140,
    },
    {
      id: "co2",
      title: t("var.co2"),
      unit: "ppm",
      series: [
        { label: t("var.co2"), values: sl(h.co2), color: "--s3", digits: 0 },
        { label: t("var.co2Sp"), values: sl(h.co2Sp), color: "--s8", dash: true, digits: 0 },
      ],
      height: 140,
    },
    {
      id: "pos",
      title: t("sec.installations"),
      unit: "%",
      yMin: 0,
      yMax: 100,
      series: [
        { label: t("var.ventLee"), values: sl(h.ventLee), color: "--s1", digits: 0 },
        { label: t("var.energyScreen"), values: sl(h.energyScreen), color: "--s7", digits: 0, step: true },
        { label: t("var.co2Valve"), values: sl(h.co2Valve), color: "--s3", digits: 0 },
      ],
      height: 140,
    },
  ];

  const graphHref = (k: string) => `/graphs?s=${id}:${k}`;

  return (
    <div className="space-y-4">
      {/* IIVO-style subsystem tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {subs.map((x2) => {
          const active = x2 === sub;
          return (
            <button
              key={x2}
              onClick={() => setSub(x2)}
              className={active ? "relative px-3 py-2 text-sm font-semibold whitespace-nowrap text-ink" : "relative px-3 py-2 text-sm font-medium whitespace-nowrap text-muted hover:text-ink-2"}
            >
              {t(`sub.${x2}`)}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden p-2 sm:p-3">
        <GreenhouseViz L={L} out={tw.outside} minuteOfDay={tw.lt.minuteOfDay} sunrise={tw.lt.sunriseMin} sunset={tw.lt.sunsetMin} t={t} selected={sel} onSelect={setSel} />
        <p className="px-2 pt-1 pb-1 text-[12px] text-muted">{t("sec.clickHint")}</p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          <CardHeader title={`${t(`sub.${sub}`)} · ${t("actual.title")}`} sub={t("actual.hint")} />
          <div className="overflow-x-auto pb-1">
            <ActualTable sectionId={id} subsystem={sub} selected={sel} onSelect={setSel} onEdit={setEditParam} />
          </div>
        </Card>

        <Card className="p-4">
          {sel === "climate" ? (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold">{t("sec.whyTitle")}</h3>
              {(["heat", "vent", "co2"] as const).map((k) => (
                <div key={k}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">{t(k === "co2" ? "var.co2Sp" : `var.${k}Sp`)}</span>
                    <Link href={graphHref(`${k}Sp`)} className="text-muted hover:text-brand" aria-label={t("sec.graphIt")}>
                      <ChartLine size={15} />
                    </Link>
                  </div>
                  <BreakdownView b={bd[k]} unit={k === "co2" ? "ppm" : "°C"} digits={k === "co2" ? 0 : 1} />
                </div>
              ))}
            </div>
          ) : (
            <ActuatorDetail
              k={sel}
              pos={fmtPos(sel, posOf(sel))}
              target={fmtPos(sel, L.target[sel])}
              manual={manualOf(sel)?.until}
              reasons={L.ctrl.reasons[sel] ?? []}
              available={available.includes(sel)}
              onManual={() => setOvr(sel)}
              onAuto={() => s.cancelOverride(id, sel)}
              graphHref={graphHref(sel === "pipe" ? "pipe" : sel)}
            />
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold">{t("sec.trend")}</h3>
          <div className="flex items-center gap-2">
            <Segmented value={range} onChange={setRange} options={[{ value: 288, label: "24" + t("u.h") }, { value: 576, label: "48" + t("u.h") }, { value: 2016, label: "7" + t("u.d") }]} size="sm" />
            <Link href={`/graphs?s=${id}:temp,${id}:heatSp,${id}:ventSp,out:outTemp`} className="text-[13px] font-medium text-brand">
              {t("sec.graphIt")} →
            </Link>
          </div>
        </div>
        <TimeCharts x={x} panels={panels} syncKey={`sec-${id}`} />
      </Card>

      {ovr && <OverrideDialog sectionId={id} k={ovr} current={ovr === "pipe" ? L.phys.pipeT : L.phys.act[ovr]} onClose={() => setOvr(null)} />}
      {editParam && <SetpointEditorDialog sectionId={id} param={editParam} onClose={() => setEditParam(null)} />}
    </div>
  );
}

function ActuatorDetail({
  k,
  pos,
  target,
  manual,
  reasons,
  available,
  onManual,
  onAuto,
  graphHref,
}: {
  k: ActuatorKey;
  pos: string;
  target: string;
  manual?: number;
  reasons: { code: string; params?: Record<string, string | number> }[];
  available: boolean;
  onManual: () => void;
  onAuto: () => void;
  graphHref: string;
}) {
  const s = useStore();
  const t = s.t;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{t(`var.${k}`)}</h3>
        {manual ? (
          <Badge tone="manual">
            <Hand size={12} /> {t("sec.manualActive", { t: fmtTime(manual, SITE.geo.tz) })}
          </Badge>
        ) : (
          <Badge tone="good">{t("common.auto")}</Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-[12px] text-muted">{t("sec.position")}</div>
          <div className="num mt-0.5 text-xl font-semibold">{pos}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-[12px] text-muted">{t("sec.target")}</div>
          <div className="num mt-0.5 text-xl font-semibold">{target}</div>
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-ink">{t("sec.reason")}</div>
        <ReasonList reasons={reasons} />
      </div>
      {available && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onManual}>
            <Hand size={15} /> {t("sec.override")}
          </Button>
          {manual && (
            <Button variant="ghost" size="sm" onClick={onAuto}>
              <RotateCcw size={15} /> {t("sec.overrideBack")}
            </Button>
          )}
          <Link href={graphHref} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2">
            <ChartLine size={15} /> {t("sec.graphIt")}
          </Link>
        </div>
      )}
    </div>
  );
}

function OverrideDialog({ sectionId, k, current, onClose }: { sectionId: string; k: ActuatorKey; current: number; onClose: () => void }) {
  const s = useStore();
  const t = s.t;
  const binary = k === "lamps" || k === "pad" || k === "fog";
  const isPipe = k === "pipe";
  const [value, setValue] = useState(Math.round(isPipe ? Math.max(30, current) : current));
  const [mins, setMins] = useState(120);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("sec.overrideTitle", { a: t(`var.${k}`) })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              s.setOverride(sectionId, k, value, mins);
              onClose();
            }}
          >
            {t("common.apply")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t("sec.overrideValue")}>
          {binary ? (
            <Segmented value={value > 0 ? 100 : 0} onChange={setValue} options={[{ value: 0, label: t("common.off") }, { value: 100, label: t("common.on") }]} />
          ) : (
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={isPipe ? 80 : 100} step={isPipe ? 1 : 5} value={value} onChange={(e) => setValue(+e.target.value)} className="flex-1 accent-[var(--brand)]" />
              <span className="num w-16 text-end text-lg font-semibold">
                {value}
                {isPipe ? "°C" : "%"}
              </span>
            </div>
          )}
        </Field>
        <Field label={t("sec.overrideFor")}>
          <Segmented
            value={mins}
            onChange={setMins}
            options={[30, 60, 120, 240, 480].map((m) => ({ value: m, label: m < 60 ? `${m} ${t("u.min")}` : `${m / 60} ${t("u.h")}` }))}
          />
        </Field>
        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">{t("sec.overrideHint")}</p>
      </div>
    </Dialog>
  );
}
