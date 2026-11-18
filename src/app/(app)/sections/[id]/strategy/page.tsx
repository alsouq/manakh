"use client";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus, Save, Trash2, Undo2 } from "lucide-react";
import type { Influence, InfluenceSource, InfluenceTarget, Period, PeriodRef, Strategy } from "@/engine/types";
import { interpolate, periodStart, validateStrategy } from "@/engine/control";
import { fmtMinutes } from "@/engine/sun";
import { useStore } from "@/lib/store";
import { diffStrategy, fieldLabel, GROUP_LABEL } from "@/lib/diff";
import { tData } from "@/lib/i18n";
import { fmt } from "@/lib/vars";
import { forecastRun } from "@/sim/twin";
import { TimeCharts, type ChartPanelDef } from "@/components/TimeChart";
import { Button, Card, CardHeader, cx, IconButton, Input, NumberInput, Select, Switch } from "@/components/ui";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const uid = () => Math.random().toString(36).slice(2, 8);

type GroupKey = "ventilation" | "heating" | "co2" | "screens" | "lighting" | "cooling";
const GROUP_FIELDS: Record<GroupKey, { k: string; step?: number; bool?: boolean }[]> = {
  ventilation: [{ k: "pBand", step: 0.5 }, { k: "minVent", step: 5 }, { k: "maxVent", step: 5 }, { k: "windLimit", step: 1 }, { k: "humVentPerPct", step: 1 }, { k: "humVentMax", step: 5 }],
  heating: [{ k: "minPipe", step: 5 }, { k: "maxPipe", step: 5 }, { k: "minPipeOnHumidity", step: 5 }],
  co2: [{ k: "reduceFullAtVent", step: 5 }, { k: "minRadiation", step: 10 }, { k: "maxDoseGm2h", step: 1 }],
  screens: [
    { k: "energyEnabled", bool: true },
    { k: "energyCloseBelowRad", step: 5 },
    { k: "energyCloseBelowOutT", step: 1 },
    { k: "energyGapOnHumidity", step: 1 },
    { k: "shadeEnabled", bool: true },
    { k: "shadeAboveRad", step: 25 },
    { k: "shadeMax", step: 5 },
  ],
  lighting: [{ k: "enabled", bool: true }, { k: "onBelowRad", step: 10 }, { k: "offAboveRad", step: 10 }, { k: "targetDli", step: 1 }],
  cooling: [{ k: "padFanEnabled", bool: true }, { k: "padStart", step: 0.5 }, { k: "fogEnabled", bool: true }, { k: "fogBelowRh", step: 5 }, { k: "fogAboveTemp", step: 0.5 }],
};

export default function StrategyPage() {
  const { id } = useParams<{ id: string }>();
  const s = useStore();
  const t = s.t;
  const lang = s.s.lang;
  const tw = s.twin!;
  const L = tw.live[id];
  const active = s.activeVersion(id);
  const [draft, setDraft] = useState<Strategy>(() => clone(active.doc));
  const [baseVersion, setBaseVersion] = useState(active.version);
  const [note, setNote] = useState("");

  // if the active version changes elsewhere and the draft is untouched, follow it
  const untouched = useMemo(() => diffStrategy(active.doc, draft).length === 0, [active.doc, draft]);
  useEffect(() => {
    if (active.version !== baseVersion && untouched) {
      setDraft(clone(active.doc));
      setBaseVersion(active.version);
    }
  }, [active.version, active.doc, baseVersion, untouched]);

  const changes = useMemo(() => diffStrategy(active.doc, draft), [active.doc, draft]);
  const problems = useMemo(() => validateStrategy(draft), [draft]);
  const edit = (fn: (d: Strategy) => void) =>
    setDraft((d) => {
      const n = clone(d);
      fn(n);
      return n;
    });

  // preview: same engine, both strategies, on the forecast. Re-run on edits and every 10 sim-minutes.
  const bucket = Math.floor(s.simNow() / 600000);
  const draftKey = JSON.stringify(draft);
  const [preview, setPreview] = useState<{ cur: ReturnType<typeof forecastRun>; nxt: ReturnType<typeof forecastRun> } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const now = s.simNow();
      const cs = tw.ctrlStates[id];
      setPreview({ cur: forecastRun(L, cs, active.doc, now, 24), nxt: forecastRun(L, cs, JSON.parse(draftKey), now, 24) });
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, bucket, active.version, id]);

  const changedPeriod = (p: Period, k: keyof Period) => {
    const o = active.doc.periods.find((x) => x.id === p.id);
    return !o || o[k] !== p[k];
  };
  const changedField = (g: GroupKey, k: string) => (active.doc[g] as unknown as Record<string, unknown>)[k] !== (draft[g] as unknown as Record<string, unknown>)[k];

  const hasLamps = L.def.phys.hasLamps;
  const groups: GroupKey[] = ["ventilation", "heating", "co2", "screens", ...(hasLamps ? (["lighting"] as GroupKey[]) : []), "cooling"];

  const panels: ChartPanelDef[] | null = preview
    ? [
        {
          id: "pt",
          title: t("var.temp"),
          unit: "°C",
          series: [
            { label: `${t("var.temp")} · ${t("st.draft")}`, values: preview.nxt.temp, color: "--s2" },
            { label: `${t("var.temp")} · ${t("st.current")}`, values: preview.cur.temp, color: "--s2", dash: true, width: 1.5 },
            { label: `${t("var.heatSp")} · ${t("st.draft")}`, values: preview.nxt.heatSp, color: "--s8", width: 1.5 },
            { label: `${t("var.heatSp")} · ${t("st.current")}`, values: preview.cur.heatSp, color: "--s8", dash: true, width: 1 },
          ],
          height: 170,
        },
        {
          id: "pv",
          title: t("var.ventLee"),
          unit: "%",
          yMin: 0,
          yMax: 100,
          series: [
            { label: t("st.draft"), values: preview.nxt.vents, color: "--s1", digits: 0 },
            { label: t("st.current"), values: preview.cur.vents, color: "--s1", dash: true, width: 1.5, digits: 0 },
          ],
          height: 110,
        },
        {
          id: "prh",
          title: t("var.rh"),
          unit: "%",
          series: [
            { label: t("st.draft"), values: preview.nxt.rh, color: "--s3", digits: 0 },
            { label: t("st.current"), values: preview.cur.rh, color: "--s3", dash: true, width: 1.5, digits: 0 },
          ],
          height: 110,
        },
      ]
    : null;

  const impact = preview
    ? [
        { k: "st.gas", a: preview.cur.gasM3, b: preview.nxt.gasM3, unit: "m³", d: 0 },
        { k: "st.co2Use", a: preview.cur.co2Kg, b: preview.nxt.co2Kg, unit: "kg", d: 0 },
        ...(hasLamps || L.def.phys.hasPadFan ? [{ k: "st.elec", a: preview.cur.elecKwh, b: preview.nxt.elecKwh, unit: "kWh", d: 0 }] : []),
        { k: "st.maxT", a: preview.cur.maxT, b: preview.nxt.maxT, unit: "°C", d: 1 },
        { k: "st.minT", a: preview.cur.minT, b: preview.nxt.minT, unit: "°C", d: 1 },
        { k: "st.humidHours", a: preview.cur.hoursHumid, b: preview.nxt.hoursHumid, unit: t("u.h"), d: 1 },
      ]
    : [];

  const lt = tw.lt;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-4">
        {/* periods */}
        <Card>
          <CardHeader
            title={t("st.periods")}
            right={
              <Button
                size="sm"
                disabled={draft.periods.length >= 6}
                onClick={() =>
                  edit((d) => {
                    const last = d.periods[d.periods.length - 1];
                    d.periods.push({ ...last, id: uid(), name: `P${d.periods.length + 1}`, ref: "clock", offsetMin: 720 });
                  })
                }
              >
                <Plus size={15} /> {t("st.addPeriod")}
              </Button>
            }
          />
          <div className="overflow-x-auto px-2 pb-3">
            <table className="w-full min-w-[560px] text-sm">
              <tbody>
                <tr>
                  <th className="w-28 px-2 py-1.5 text-start text-[13px] font-medium text-ink-2">{t("st.periodName")}</th>
                  {draft.periods.map((p, i) => (
                    <td key={p.id} className="px-1 py-1">
                      <Input
                        value={lang === "ar" ? tData(lang, p.name) : p.name}
                        onChange={(e) => edit((d) => void (d.periods[i].name = e.target.value))}
                        className={cx("h-9 font-semibold", changedPeriod(p, "name") && "border-[#2a78d6]")}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="px-2 py-1.5 text-start text-[13px] font-medium text-ink-2">{t("st.start")}</th>
                  {draft.periods.map((p, i) => (
                    <td key={p.id} className="px-1 py-1">
                      <Select
                        value={p.ref}
                        onChange={(v: PeriodRef) =>
                          edit((d) => {
                            const st = periodStart(d.periods[i], lt.sunriseMin, lt.sunsetMin);
                            d.periods[i].ref = v;
                            d.periods[i].offsetMin = v === "clock" ? Math.round(st) : v === "sunrise" ? Math.round(st - lt.sunriseMin) : Math.round(st - lt.sunsetMin);
                          })
                        }
                        options={(["sunrise", "sunset", "clock"] as const).map((r) => ({ value: r, label: t(`st.ref.${r}`) }))}
                        className={cx("h-9", changedPeriod(p, "ref") && "border-[#2a78d6]")}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="px-2 py-1.5 text-start text-[13px] font-medium text-ink-2">
                    {t("st.offset")} / {t("st.clockTime")}
                  </th>
                  {draft.periods.map((p, i) => (
                    <td key={p.id} className="px-1 py-1">
                      {p.ref === "clock" ? (
                        <input
                          type="time"
                          value={fmtMinutes(p.offsetMin)}
                          onChange={(e) => {
                            const [h, m] = e.target.value.split(":").map(Number);
                            if (!Number.isNaN(h)) edit((d) => void (d.periods[i].offsetMin = h * 60 + (m || 0)));
                          }}
                          className={cx("num h-9 w-full rounded-lg border bg-surface px-2 text-sm", changedPeriod(p, "offsetMin") ? "border-[#2a78d6]" : "border-line-strong")}
                        />
                      ) : (
                        <NumberInput step={15} value={p.offsetMin} onChange={(v) => edit((d) => void (d.periods[i].offsetMin = v))} changed={changedPeriod(p, "offsetMin")} />
                      )}
                      <div className="num mt-0.5 px-1 text-[11px] text-muted">{t("st.startsAt", { t: fmtMinutes(periodStart(p, lt.sunriseMin, lt.sunsetMin)) })}</div>
                    </td>
                  ))}
                </tr>
                {(
                  [
                    ["rampMin", 15],
                    ["heat", 0.5],
                    ["vent", 0.5],
                    ["rhMax", 1],
                    ["co2", 50],
                  ] as const
                ).map(([k, step]) => (
                  <tr key={k}>
                    <th className="px-2 py-1.5 text-start text-[13px] font-medium text-ink-2">{t(k === "rampMin" ? "st.ramp" : `st.${k}`)}</th>
                    {draft.periods.map((p, i) => (
                      <td key={p.id} className="px-1 py-1">
                        <NumberInput data-testid={`p${i}-${k}`} step={step} value={p[k]} onChange={(v) => edit((d) => void (d.periods[i][k] = v))} changed={changedPeriod(p, k)} />
                      </td>
                    ))}
                  </tr>
                ))}
                {hasLamps && (
                  <tr>
                    <th className="px-2 py-1.5 text-start text-[13px] font-medium text-ink-2">{t("st.lamps")}</th>
                    {draft.periods.map((p, i) => (
                      <td key={p.id} className="px-1 py-1">
                        <Switch checked={p.lamps} onChange={(v) => edit((d) => void (d.periods[i].lamps = v))} />
                      </td>
                    ))}
                  </tr>
                )}
                <tr>
                  <th />
                  {draft.periods.map((p, i) => (
                    <td key={p.id} className="px-1 pt-1">
                      <button
                        disabled={draft.periods.length <= 1}
                        onClick={() => edit((d) => void d.periods.splice(i, 1))}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-muted hover:bg-critical-soft hover:text-critical disabled:opacity-40"
                      >
                        <Trash2 size={13} /> {t("st.removePeriod")}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <DayStrip draft={draft} sunrise={lt.sunriseMin} sunset={lt.sunsetMin} now={lt.minuteOfDay} />
        </Card>

        {/* parameter groups */}
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g}>
              <CardHeader title={t(GROUP_LABEL[g])} />
              <div className="space-y-2.5 px-4 pb-4">
                {GROUP_FIELDS[g]
                  .filter((f) => !(g === "cooling" && ((f.k.startsWith("pad") && !L.def.phys.hasPadFan) || (f.k.startsWith("fog") && !L.def.phys.hasFog))))
                  .map((f) => {
                    const val = (draft[g] as unknown as Record<string, number | boolean>)[f.k];
                    return (
                      <div key={f.k} className="flex items-center justify-between gap-3">
                        <span className={cx("text-[13px]", changedField(g, f.k) ? "font-semibold text-[#2a78d6]" : "text-ink-2")}>{t(fieldLabel(f.k))}</span>
                        {f.bool ? (
                          <Switch checked={!!val} onChange={(v) => edit((d) => void ((d[g] as unknown as Record<string, unknown>)[f.k] = v))} />
                        ) : (
                          <NumberInput
                            className="w-24"
                            step={f.step}
                            value={val as number}
                            onChange={(v) => edit((d) => void ((d[g] as unknown as Record<string, unknown>)[f.k] = v))}
                            changed={changedField(g, f.k)}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            </Card>
          ))}
        </div>

        {/* influences */}
        <Card>
          <CardHeader
            title={t("st.influences")}
            sub={t("st.influencesHint")}
            right={
              <Button
                size="sm"
                onClick={() =>
                  edit((d) =>
                    d.influences.push({ id: uid(), enabled: true, target: "heat", source: "radiation", points: [[200, 0], [600, 1]] }),
                  )
                }
              >
                <Plus size={15} /> {t("st.addInfluence")}
              </Button>
            }
          />
          <div className="grid gap-3 px-4 pb-4 lg:grid-cols-2">
            {draft.influences.map((inf, i) => (
              <InfluenceEditor
                key={inf.id}
                inf={inf}
                current={sourceNow(inf.source, tw.outside, L.rh, L.ctrl.setpoints.rhMax)}
                onChange={(n) => edit((d) => void (d.influences[i] = n))}
                onDelete={() => edit((d) => void d.influences.splice(i, 1))}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* preview + save */}
      <div className="min-w-0">
        <div className="space-y-4 xl:sticky xl:top-[72px]">
          <Card className="p-4">
            <h3 className="text-[15px] font-semibold">{t("st.preview")}</h3>
            <p className="mt-0.5 mb-3 text-[12px] text-muted">{t("st.previewHint")}</p>
            {panels && preview ? <TimeCharts x={preview.nxt.t} panels={panels} syncKey={`pv-${id}`} /> : <div className="h-64 animate-pulse rounded-xl bg-surface-2" />}
            {preview && (
              <div className="mt-4">
                <div className="mb-1.5 text-[13px] font-semibold">{t("st.impact")}</div>
                <table className="num w-full text-[13px]">
                  <thead>
                    <tr className="text-[11px] text-muted">
                      <th />
                      <th className="text-end font-medium">{t("st.current")}</th>
                      <th className="text-end font-medium">{t("st.draft")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impact.map((r) => {
                      const delta = r.b - r.a;
                      const pct = r.a > 0.5 ? (delta / r.a) * 100 : 0;
                      return (
                        <tr key={r.k} className="border-t border-line">
                          <td className="py-1.5 text-ink-2">{t(r.k)}</td>
                          <td className="py-1.5 text-end text-ink-2">
                            {fmt(r.a, r.d)} {r.unit}
                          </td>
                          <td className={cx("py-1.5 text-end font-semibold", Math.abs(delta) < 10 ** -r.d / 2 ? "text-ink" : "text-[#2a78d6]")}>
                            {fmt(r.b, r.d)} {r.unit}
                            {Math.abs(pct) >= 1 && (
                              <span className="ms-1 text-[11px] font-normal">
                                ({pct > 0 ? "+" : ""}
                                {fmt(pct, 0)}%)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">{t("st.changes")}</h3>
              <span className="num text-[12px] text-muted">v{active.version} → v{Math.max(...s.versions(id).map((v) => v.version)) + 1}</span>
            </div>
            {changes.length === 0 ? (
              <p className="text-sm text-muted">{t("st.noChanges")}</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-auto text-[13px]">
                {changes.map((c, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-ink-2">
                      <span className="text-muted">{c.scope ? (c.scope.startsWith("st.") ? t(c.scope) : tData(lang, c.scope)) : ""} · </span>
                      {t(c.label)}
                    </span>
                    <span className="num shrink-0 text-ink">
                      <span className="text-muted line-through">{c.from.startsWith("st.") ? t(c.from) : tData(lang, c.from)}</span> → <b>{c.to.startsWith("st.") ? t(c.to) : tData(lang, c.to)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {problems.length > 0 && (
              <div className="mt-3 rounded-xl bg-critical-soft p-3 text-[13px] text-critical">
                <div className="mb-1 flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={15} /> {t("st.problems")}
                </div>
                <ul className="list-inside list-disc">
                  {problems.map((p, i) => (
                    <li key={i}>{t(p.code, { ...p.params, p: p.params?.p ? tData(lang, String(p.params.p)) : "" })}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 space-y-2">
              <Input placeholder={t("st.saveNote")} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={changes.length === 0 || problems.length > 0}
                  onClick={() => {
                    const v = s.saveStrategy(id, draft, note);
                    setBaseVersion(v);
                    setNote("");
                    s.toast(t("st.saved", { v }));
                  }}
                >
                  <Save size={16} /> {t("st.saveVersion", { v: Math.max(...s.versions(id).map((v) => v.version)) + 1 })}
                </Button>
                <Button variant="ghost" disabled={changes.length === 0} onClick={() => setDraft(clone(active.doc))}>
                  <Undo2 size={16} /> {t("st.discard")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function sourceNow(src: InfluenceSource, out: { radiation: number; temp: number; wind: number }, rh: number, rhMax: number) {
  return src === "radiation" ? out.radiation : src === "outsideTemp" ? out.temp : src === "wind" ? out.wind : rh - rhMax;
}

/** 24 h strip showing where each period starts, with sunrise, sunset and now. */
function DayStrip({ draft, sunrise, sunset, now }: { draft: Strategy; sunrise: number; sunset: number; now: number }) {
  const lang = useStore().s.lang;
  const starts = draft.periods.map((p) => ({ p, s: periodStart(p, sunrise, sunset) })).sort((a, b) => a.s - b.s);
  const pct = (m: number) => `${(m / 1440) * 100}%`;
  const tones = ["var(--s1)", "var(--s3)", "var(--s4)", "var(--s7)", "var(--s5)", "var(--s2)"];
  return (
    <div className="px-4 pb-4" dir="ltr">
      <div className="relative h-7 overflow-hidden rounded-lg bg-surface-2">
        <div className="absolute inset-y-0 bg-[var(--s4)]/15" style={{ left: pct(sunrise), width: pct(sunset - sunrise) }} />
        {starts.map(({ p, s }, i) => (
          <div key={p.id} className="absolute inset-y-0 border-s-2" style={{ left: pct(s), borderColor: tones[i % tones.length] }}>
            <span className="absolute top-1 ms-1 text-[10px] font-semibold whitespace-nowrap text-ink-2">{tData(lang, p.name)}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: pct(now) }} />
      </div>
      <div className="num mt-1 flex justify-between text-[10px] text-muted">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}:00</span>
        ))}
      </div>
    </div>
  );
}

function InfluenceEditor({ inf, current, onChange, onDelete }: { inf: Influence; current: number; onChange: (i: Influence) => void; onDelete: () => void }) {
  const s = useStore();
  const t = s.t;
  const pts = inf.points;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const xMin = Math.min(...xs, current) - 1;
  const xMax = Math.max(...xs, current) + 1;
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(0, ...ys);
  const W = 260,
    Hh = 80;
  const X = (x: number) => ((x - xMin) / (xMax - xMin || 1)) * W;
  const Y = (y: number) => Hh - 6 - ((y - yMin) / (yMax - yMin || 1)) * (Hh - 12);
  const sorted = [...pts].sort((a, b) => a[0] - b[0]);
  const path = [[xMin, sorted[0]?.[1] ?? 0], ...sorted, [xMax, sorted[sorted.length - 1]?.[1] ?? 0]].map(([x, y], i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");
  const yNow = interpolate(pts, current);
  return (
    <div className={cx("rounded-xl border border-line p-3", !inf.enabled && "opacity-60")}>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[12px] text-muted">{t("st.target")}</span>
        <Select<InfluenceTarget> className="h-9 min-w-0 flex-1" value={inf.target} onChange={(v) => onChange({ ...inf, target: v })} options={(["heat", "vent", "co2"] as const).map((v) => ({ value: v, label: t(`st.tgt.${v}`) }))} />
        <Switch checked={inf.enabled} onChange={(v) => onChange({ ...inf, enabled: v })} />
        <IconButton label={t("common.delete")} onClick={onDelete}>
          <Trash2 size={15} />
        </IconButton>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="w-16 shrink-0 text-[12px] text-muted">{t("st.source")}</span>
        <Select<InfluenceSource>
          className="h-9 min-w-0 flex-1"
          value={inf.source}
          onChange={(v) => onChange({ ...inf, source: v })}
          options={(["radiation", "outsideTemp", "rhExcess", "wind"] as const).map((v) => ({ value: v, label: t(`st.src.${v}`) }))}
        />
      </div>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="mt-2 h-20 w-full" style={{ direction: "ltr" }} aria-hidden>
        <line x1="0" x2={W} y1={Y(0)} y2={Y(0)} stroke="var(--grid)" />
        <path d={path} fill="none" stroke="var(--s7)" strokeWidth="2" />
        {sorted.map(([x, y], i) => (
          <circle key={i} cx={X(x)} cy={Y(y)} r="3.5" fill="var(--surface)" stroke="var(--s7)" strokeWidth="2" />
        ))}
        <line x1={X(current)} x2={X(current)} y1="0" y2={Hh} stroke="var(--muted)" strokeDasharray="3 3" />
        <circle cx={X(current)} cy={Y(yNow)} r="4" fill="var(--s2)" />
      </svg>
      <div className="num mb-2 text-[12px] text-muted">
        {t("common.now")}: {fmt(current, 1)} → {yNow >= 0 ? "+" : ""}
        {fmt(yNow, inf.target === "co2" ? 0 : 1)}
      </div>
      <div className="space-y-1.5">
        {pts.map((p, j) => (
          <div key={j} className="flex items-center gap-2">
            <NumberInput className="flex-1" step={inf.source === "radiation" ? 50 : 1} value={p[0]} onChange={(v) => onChange({ ...inf, points: pts.map((q, k) => (k === j ? [v, q[1]] : q)) as [number, number][] })} />
            <span className="text-muted">→</span>
            <NumberInput className="flex-1" step={inf.target === "co2" ? 50 : 0.5} value={p[1]} onChange={(v) => onChange({ ...inf, points: pts.map((q, k) => (k === j ? [q[0], v] : q)) as [number, number][] })} />
            <IconButton label={t("common.delete")} disabled={pts.length <= 1} onClick={() => onChange({ ...inf, points: pts.filter((_, k) => k !== j) })}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        ))}
        <button
          className="text-[12px] font-medium text-brand"
          onClick={() => {
            const last = pts[pts.length - 1] ?? [0, 0];
            onChange({ ...inf, points: [...pts, [last[0] + (inf.source === "radiation" ? 100 : 2), last[1]]] });
          }}
        >
          + {t("st.addPoint")}
        </button>
      </div>
    </div>
  );
}
