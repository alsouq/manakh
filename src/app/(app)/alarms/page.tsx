"use client";
import Link from "next/link";
import { useState } from "react";
import { BellOff, Check, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { SECTIONS, SITE, type AlarmRule, type AlarmVar, type Priority } from "@/sim/seed";
import type { Alarm } from "@/sim/twin";
import { tData } from "@/lib/i18n";
import { fmt, fmtTime, unitOf, VARS } from "@/lib/vars";
import { Badge, Button, Card, cx, Dialog, Empty, Field, IconButton, Input, NumberInput, PageHeader, PriorityBadge, prioColor, Select, Switch, Tabs } from "@/components/ui";

const VAR_OPTS: AlarmVar[] = ["temp", "rh", "hd", "co2", "pipe", "outsideTemp", "wind"];

export default function AlarmsPage() {
  const s = useStore();
  const t = s.t;
  const [tab, setTab] = useState<"active" | "history" | "rules">("active");
  const [edit, setEdit] = useState<AlarmRule | null>(null);
  const active = s.activeAlarms();
  const history = (s.twin?.alarms ?? []).filter((a) => a.clearedAt !== undefined).slice().reverse().slice(0, 100);

  return (
    <div>
      <PageHeader
        title={t("al.title")}
        right={
          tab === "rules" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                setEdit({ id: "", name: "", sectionId: "all", variable: "temp", condition: "above", threshold: 30, hysteresis: 1, delayMin: 10, activeFrom: "", activeTo: "", priority: "medium", enabled: true })
              }
            >
              <Plus size={15} /> {t("al.newRule")}
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "active", label: `${t("al.active")} (${active.length})` },
          { value: "history", label: t("al.history") },
          { value: "rules", label: `${t("al.rules")} (${s.s.rules.length})` },
        ]}
      />
      <div className="mt-4">
        {tab === "active" &&
          (active.length === 0 ? (
            <Card>
              <Empty icon={<CheckCircle2 size={36} className="text-good" />} title={t("al.none")} hint={t("al.noneHint")} />
            </Card>
          ) : (
            <div className="space-y-2">
              {active.map((a) => (
                <AlarmRow key={a.id} a={a} />
              ))}
            </div>
          ))}
        {tab === "history" && (
          <Card>
            {history.length === 0 ? (
              <Empty title={t("common.none")} />
            ) : (
              <ul className="divide-y divide-line">
                {history.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-24 shrink-0">
                      <PriorityBadge p={a.priority} label={t(`al.p.${a.priority}`)} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {tData(s.s.lang, a.ruleName)} · {s.sectionName(a.sectionId)}
                    </span>
                    <span className="num text-[12px] text-muted">
                      {fmtTime(a.raisedAt, SITE.geo.tz, true)} → {fmtTime(a.clearedAt!, SITE.geo.tz)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {tab === "rules" && (
          <Card>
            <ul className="divide-y divide-line">
              {s.s.rules.map((r) => (
                <li key={r.id} className={cx("flex flex-wrap items-center gap-3 px-4 py-3", !r.enabled && "opacity-55")}>
                  <span className="w-24 shrink-0">
                    <PriorityBadge p={r.priority} label={t(`al.p.${r.priority}`)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{tData(s.s.lang, r.name)}</div>
                    <div className="num text-[12px] text-muted">
                      {r.sectionId === "all" ? t("al.allSections") : s.sectionName(r.sectionId)} · {t(`var.${r.variable}`)} {t(`al.cond.${r.condition}`)} {r.threshold}{" "}
                      {r.condition === "deviation" ? "°C" : unitOf(r.variable === "outsideTemp" ? "outTemp" : r.variable, s.s.lang)} · {r.delayMin} {t("u.min")}
                      {r.activeFrom && ` · ${r.activeFrom}–${r.activeTo}`}
                    </div>
                  </div>
                  <Switch checked={r.enabled} onChange={(v) => s.saveRule({ ...r, enabled: v })} />
                  <IconButton label={t("common.edit")} onClick={() => setEdit(r)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label={t("common.delete")} onClick={() => s.deleteRule(r.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {edit && <RuleDialog rule={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AlarmRow({ a }: { a: Alarm }) {
  const s = useStore();
  const t = s.t;
  const u = s.alarmUser(a.id);
  const now = s.simNow();
  const snoozed = u.snoozedUntil && u.snoozedUntil > now;
  const unit = a.condition === "deviation" ? "°C" : unitOf(a.variable === "outsideTemp" ? "outTemp" : a.variable, s.s.lang);
  const digits = VARS[(a.variable === "outsideTemp" ? "outTemp" : a.variable) as keyof typeof VARS]?.digits ?? 1;
  const morning = (() => {
    const lt = s.twin!.lt;
    const mins = (7 * 60 - lt.minuteOfDay + 1440) % 1440 || 1440;
    return now + mins * 60000;
  })();
  return (
    <Card className="flex flex-wrap items-center gap-3 p-3 ps-0" style={{ borderInlineStart: `4px solid ${prioColor(a.priority)}` }}>
      <div className="min-w-0 flex-1 ps-4">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge p={a.priority} label={t(`al.p.${a.priority}`)} />
          <span className="font-semibold text-ink">{tData(s.s.lang, a.ruleName)}</span>
          {a.sectionId !== "site" ? (
            <Link href={`/sections/${a.sectionId}`} className="text-sm text-brand hover:underline">
              {s.sectionName(a.sectionId)}
            </Link>
          ) : (
            <span className="text-sm text-ink-2">{t("common.site")}</span>
          )}
        </div>
        <div className="num mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
          <span>{t("al.raised", { t: fmtTime(a.raisedAt, SITE.geo.tz, true) })}</span>
          <span>
            {t("al.value", { v: `${fmt(a.value, digits)} ${a.condition === "deviation" ? "" : unit}` })} ({t(`al.cond.${a.condition}`)} {a.threshold} {unit})
          </span>
          {u.ackAt && <span className="text-good-ink">{t("al.acked", { u: u.ackBy ?? "" })}</span>}
          {snoozed && <span>{t("al.snoozed", { t: fmtTime(u.snoozedUntil!, SITE.geo.tz) })}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 pe-1">
        {!u.ackAt && (
          <Button size="sm" variant="primary" onClick={() => s.ack(a)}>
            <Check size={15} /> {t("al.ack")}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => s.snooze(a, now + 30 * 60000)}>
          <BellOff size={15} /> {t("al.snooze30")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => s.snooze(a, now + 2 * 3600000)}>
          {t("al.snooze2h")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => s.snooze(a, morning)}>
          {t("al.snoozeMorning")}
        </Button>
      </div>
    </Card>
  );
}

function RuleDialog({ rule, onClose }: { rule: AlarmRule; onClose: () => void }) {
  const s = useStore();
  const t = s.t;
  const [r, setR] = useState<AlarmRule>({ ...rule, name: tData(s.s.lang, rule.name) });
  const set = <K extends keyof AlarmRule>(k: K, v: AlarmRule[K]) => setR((x) => ({ ...x, [k]: v }));
  return (
    <Dialog
      open
      onClose={onClose}
      title={rule.id ? t("al.editRule") : t("al.newRule")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!r.name.trim()}
            onClick={() => {
              s.saveRule(r);
              onClose();
            }}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("al.ruleName")} className="col-span-2">
          <Input value={r.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label={t("common.section")}>
          <Select value={r.sectionId} onChange={(v) => set("sectionId", v)} options={[{ value: "all", label: t("al.allSections") }, ...SECTIONS.map((d) => ({ value: d.id, label: s.sectionName(d.id) }))]} />
        </Field>
        <Field label={t("al.variable")}>
          <Select<AlarmVar> value={r.variable} onChange={(v) => set("variable", v)} options={VAR_OPTS.map((v) => ({ value: v, label: t(`var.${v}`) }))} />
        </Field>
        <Field label={t("al.condition")}>
          <Select<AlarmRule["condition"]>
            value={r.condition}
            onChange={(v) => set("condition", v)}
            options={(["above", "below", ...(r.variable === "temp" ? ["deviation"] : [])] as AlarmRule["condition"][]).map((c) => ({ value: c, label: t(`al.cond.${c}`) }))}
          />
        </Field>
        <Field label={t("al.threshold")}>
          <NumberInput value={r.threshold} onChange={(v) => set("threshold", v)} step={r.variable === "co2" ? 50 : 0.5} />
        </Field>
        <Field label={t("al.hysteresis")}>
          <NumberInput value={r.hysteresis} onChange={(v) => set("hysteresis", v)} step={0.5} min={0} />
        </Field>
        <Field label={t("al.delay")}>
          <NumberInput value={r.delayMin} onChange={(v) => set("delayMin", Math.max(0, Math.round(v)))} step={5} min={0} />
        </Field>
        <Field label={t("al.window")} hint={t("al.windowHint")} className="col-span-2">
          <div className="flex items-center gap-2">
            <input type="time" value={r.activeFrom} onChange={(e) => set("activeFrom", e.target.value)} className="num h-10 flex-1 rounded-xl border border-line-strong bg-surface px-2" />
            <span className="text-muted">–</span>
            <input type="time" value={r.activeTo} onChange={(e) => set("activeTo", e.target.value)} className="num h-10 flex-1 rounded-xl border border-line-strong bg-surface px-2" />
          </div>
        </Field>
        <Field label={t("al.priority")} className="col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set("priority", p)}
                className={cx("rounded-xl border px-3 py-1.5", r.priority === p ? "border-ink bg-surface-2" : "border-line-strong")}
              >
                <PriorityBadge p={p} label={t(`al.p.${p}`)} />
              </button>
            ))}
          </div>
        </Field>
        <div className="col-span-2">
          <Switch checked={r.enabled} onChange={(v) => set("enabled", v)} label={t("common.enabled")} />
        </div>
        {r.condition === "deviation" && (
          <div className="col-span-2">
            <Badge>{t("al.cond.deviation")}</Badge>
          </div>
        )}
      </div>
    </Dialog>
  );
}
