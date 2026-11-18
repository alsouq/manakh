"use client";
import { useState } from "react";
import { Droplets, Play, Settings2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { SECTIONS, SITE, type IrrigationSettings } from "@/sim/seed";
import { fmt, fmtTime } from "@/lib/vars";
import { Bar, Button, Card, Dialog, Empty, IconButton, NumberInput, PageHeader, Switch } from "@/components/ui";

export default function WaterPage() {
  const s = useStore();
  const t = s.t;
  const tw = s.twin!;
  const [edit, setEdit] = useState<string | null>(null);
  const log = tw.irrEvents.slice(-40).reverse();

  return (
    <div>
      <PageHeader title={t("wa.title")} />
      <EasyIrrigation />
      <h2 className="mt-6 mb-3 text-[15px] font-semibold text-ink">{t("wa.perValve")}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((d) => {
          const L = tw.live[d.id];
          const cfg = s.s.irrigation[d.id];
          const prog = Math.min(100, (L.irr.radSinceLast / cfg.startRadSum) * 100);
          return (
            <Card key={d.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--s1)]/12 text-sm font-bold text-[var(--s1)]">{d.code}</span>
                  <span className="font-semibold">{s.s.lang === "ar" ? d.nameAr : d.name}</span>
                </div>
                <IconButton label={t("wa.settings")} onClick={() => setEdit(d.id)}>
                  <Settings2 size={17} />
                </IconButton>
              </div>
              <div className="num mt-3 grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-ink-2">{t("wa.starts")}</span>
                <span className="text-end font-semibold">{L.irr.starts}</span>
                <span className="text-ink-2">{t("wa.given")}</span>
                <span className="text-end font-semibold">{fmt(L.totals.waterLm2, 2)} L/m²</span>
                <span className="text-ink-2">{t("wa.transp")}</span>
                <span className="text-end">{fmt(L.totals.transpLm2, 2)} L/m²</span>
                <span className="text-ink-2">{t("wa.drain")}</span>
                <span className="text-end font-semibold">{fmt(L.irr.drain, 0)}%</span>
                <span className="text-ink-2">
                  {t("wa.ec")} / {t("wa.ph")}
                </span>
                <span className="text-end">
                  {fmt(L.irr.ec, 2)} / {fmt(L.irr.ph, 2)}
                </span>
                <span className="text-ink-2">{t("wa.lastStart")}</span>
                <span className="text-end">{L.irr.lastStartT ? fmtTime(L.irr.lastStartT, SITE.geo.tz) : "–"}</span>
              </div>
              <div className="mt-3">
                <div className="num mb-1 flex justify-between text-[12px] text-muted">
                  <span>{t("wa.nextStart")}</span>
                  <span>
                    {fmt(L.irr.radSinceLast, 0)} / {cfg.startRadSum} J/cm²
                  </span>
                </div>
                <Bar value={prog} color="var(--s1)" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] text-muted">{cfg.enabled ? t("common.auto") : t("common.off")}</span>
                <Button size="sm" onClick={() => s.irrigateNow(d.id)}>
                  <Play size={14} /> {t("wa.manualStart")}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <div className="px-4 pt-4 pb-2 text-[15px] font-semibold">{t("wa.log")}</div>
        {log.length === 0 ? (
          <Empty icon={<Droplets size={30} />} title={t("wa.noStarts")} />
        ) : (
          <table className="num w-full text-[13px]">
            <tbody className="divide-y divide-line">
              {log.map((e, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-ink-2">{fmtTime(e.t, SITE.geo.tz, true)}</td>
                  <td className="px-2 py-2">{s.sectionName(e.sectionId)}</td>
                  <td className="px-2 py-2 text-end">{e.ml} ml</td>
                  <td className="px-2 py-2 text-end">EC {fmt(e.ec, 2)}</td>
                  <td className="px-4 py-2 text-end">pH {fmt(e.ph, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {edit && <IrrDialog id={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function IrrDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useStore();
  const t = s.t;
  const [c, setC] = useState<IrrigationSettings>({ ...s.s.irrigation[id] });
  const rows: [keyof IrrigationSettings, string, number][] = [
    ["startRadSum", "wa.startRadSum", 10],
    ["doseMl", "wa.doseMl", 10],
    ["drippersPerM2", "wa.drippers", 0.1],
    ["windowStartAfterSunrise", "wa.windowStart", 15],
    ["windowEndBeforeSunset", "wa.windowEnd", 15],
    ["minIntervalMin", "wa.minInterval", 5],
    ["ecTarget", "wa.ecTarget", 0.1],
    ["phTarget", "wa.phTarget", 0.1],
  ];
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t("wa.settings")} · ${s.sectionName(id)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              s.setIrrigation(id, c);
              onClose();
            }}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <Switch checked={c.enabled} onChange={(v) => setC({ ...c, enabled: v })} label={t("wa.enabled")} />
        {rows.map(([k, label, step]) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink-2">{t(label)}</span>
            <NumberInput className="w-28" step={step} value={c[k] as number} onChange={(v) => setC({ ...c, [k]: v })} />
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function EasyIrrigation() {
  const s = useStore();
  const t = s.t;
  const [included, setIncluded] = useState<Set<string>>(() => new Set(SECTIONS.map((d) => d.id)));
  const [duration, setDuration] = useState(10);
  const toggle = (id: string) => setIncluded((x) => (x.has(id) ? new Set([...x].filter((y) => y !== id)) : new Set([...x, id])));
  const startSeq = () => {
    SECTIONS.filter((d) => included.has(d.id)).forEach((d) => s.irrigateNow(d.id));
    s.toast(t("wa.seqStarted", { n: included.size }));
  };
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Droplets size={18} className="text-[var(--s1)]" />
          <h3 className="text-[15px] font-semibold">{t("wa.easy")}</h3>
        </div>
        <Button variant="primary" size="sm" onClick={startSeq} disabled={included.size === 0}>
          <Play size={15} /> {t("wa.startSeq")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-2.5 text-[13px]">
        <span className="text-ink-2">
          {t("wa.selected", { n: included.size })}
        </span>
        <label className="flex items-center gap-2">
          <span className="text-muted">{t("wa.duration")}</span>
          <NumberInput className="w-20" value={duration} step={1} min={1} onChange={setDuration} />
          <span className="text-muted">{t("u.min")}</span>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[12px] text-muted">
              <th className="px-4 py-2 text-start font-medium">{t("wa.valve")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("wa.startTime")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("wa.duration")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("wa.ec")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("wa.ph")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("wa.included")}</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="num divide-y divide-line">
            {SECTIONS.map((d) => {
              const cfg = s.s.irrigation[d.id];
              const on = included.has(d.id);
              return (
                <tr key={d.id} className={on ? "" : "opacity-50"}>
                  <td className="px-4 py-2 text-ink">
                    <b>{d.code}</b> · {s.s.lang === "ar" ? d.nameAr : d.name}
                  </td>
                  <td className="px-3 py-2 text-ink-2">{t("wa.asap")}</td>
                  <td className="px-3 py-2 text-end text-ink-2">{duration}m 00s</td>
                  <td className="px-3 py-2 text-end text-ink-2">{fmt(cfg.ecTarget, 1)}</td>
                  <td className="px-3 py-2 text-end text-ink-2">{fmt(cfg.phTarget, 1)}</td>
                  <td className="px-3 py-2 text-end">
                    <span className="inline-flex justify-end">
                      <Switch checked={on} onChange={() => toggle(d.id)} />
                    </span>
                  </td>
                  <td className="px-2 py-2 text-end">
                    <button onClick={() => s.irrigateNow(d.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-brand hover:bg-surface-2" title={t("wa.manualStart")}>
                      <Play size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
