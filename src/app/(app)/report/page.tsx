"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { SECTIONS, SITE } from "@/sim/seed";
import type { SectionKey } from "@/sim/twin";
import { fmt, VARS } from "@/lib/vars";
import { Card, PageHeader, Segmented } from "@/components/ui";

const VARIABLES: { key: SectionKey; label: string }[] = [
  { key: "temp", label: "var.temp" },
  { key: "rh", label: "var.rh" },
  { key: "hd", label: "var.hd" },
  { key: "co2", label: "var.co2" },
  { key: "pipe", label: "var.pipe" },
];
const PERIODS = ["calendarDay", "day", "night"] as const;
type PeriodKind = (typeof PERIODS)[number];

export default function ReportPage() {
  const s = useStore();
  const t = s.t;
  const lang = s.s.lang;
  const tw = s.twin!;
  const [variable, setVariable] = useState<SectionKey>("temp");
  const unit = lang === "ar" ? VARS[variable].unitAr : VARS[variable].unit;
  const digits = VARS[variable].digits;
  const now = s.simNow();

  const { days, rows } = useMemo(() => {
    const H = tw.history;
    const offset = tw.lt.offsetMin * 60000;
    const dayOf = (tms: number) => Math.floor((tms + offset) / 86400000);
    const todayIdx = dayOf(now);
    // accumulators[sectionId][period][dayIdx] = {sum,n}
    const acc: Record<string, Record<PeriodKind, Record<number, { sum: number; n: number }>>> = {};
    for (const d of SECTIONS) {
      acc[d.id] = { calendarDay: {}, day: {}, night: {} };
    }
    const daySet = new Set<number>();
    for (let i = 0; i < H.t.length; i++) {
      const di = dayOf(H.t[i]);
      daySet.add(di);
      const isDay = H.out.radiation[i] > 5;
      for (const d of SECTIONS) {
        const v = H.sec[d.id][variable][i];
        if (v === undefined || Number.isNaN(v)) continue;
        const add = (k: PeriodKind) => {
          const b = (acc[d.id][k][di] ??= { sum: 0, n: 0 });
          b.sum += v;
          b.n += 1;
        };
        add("calendarDay");
        add(isDay ? "day" : "night");
      }
    }
    const days = [...daySet].sort((a, b) => a - b).slice(-10);
    const fmtr = new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { timeZone: SITE.geo.tz, weekday: "short", day: "2-digit", month: "short" });
    const cols = days.map((di) => ({ di, label: fmtr.format(new Date(di * 86400000 - offset + 12 * 3600000)), today: di === todayIdx }));

    const rows = SECTIONS.flatMap((d) =>
      PERIODS.map((k) => {
        const cells = days.map((di) => {
          const b = acc[d.id][k][di];
          return b && b.n ? b.sum / b.n : null;
        });
        const present = cells.filter((c): c is number => c !== null);
        const avg = present.length ? present.reduce((a, c) => a + c, 0) / present.length : null;
        return { sectionId: d.id, code: d.code, name: lang === "ar" ? d.nameAr : d.name, period: k, cells, avg };
      }),
    );
    return { days: cols, rows };
  }, [tw, variable, lang, now]);

  return (
    <div>
      <PageHeader
        title={t("nav.report")}
        sub={t("report.hint")}
        right={<Segmented value={variable} onChange={(v) => setVariable(v)} options={VARIABLES.map((v) => ({ value: v.key, label: t(v.label) }))} />}
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[12px] text-ink-2">
                <th className="sticky start-0 z-10 bg-surface-2 px-3 py-2 text-start font-semibold" colSpan={2}>
                  {t(`var.${variable}`)}: {t("report.measurement")}
                </th>
                {days.map((c) => (
                  <th key={c.di} className={`px-3 py-2 text-end font-medium whitespace-nowrap ${c.today ? "bg-brand-soft text-ink" : ""}`}>
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-end font-semibold whitespace-nowrap">{t("report.avgTotal")}</th>
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((r) => (
                <tr key={`${r.sectionId}-${r.period}`} className={`border-b border-line/60 ${r.period === "day" ? "bg-surface-2/40" : ""} hover:bg-surface-2`}>
                  <th className="sticky start-0 z-10 max-w-[260px] truncate bg-surface px-3 py-1.5 text-start font-normal text-ink-2" style={{ background: r.period === "day" ? "var(--surface-2)" : "var(--surface)" }}>
                    <span className="font-semibold text-ink">{r.code}</span> · {r.name} — {t(`report.${r.period}`)}
                  </th>
                  <td className="px-2 py-1.5 text-muted">{unit}</td>
                  {r.cells.map((v, j) => (
                    <td key={j} className={`px-3 py-1.5 text-end ${days[j].today ? "bg-brand-soft/50" : ""} ${v === null ? "text-muted" : "text-ink"}`}>
                      {v === null ? "–" : fmt(v, digits)}
                    </td>
                  ))}
                  <td className="bg-surface-2 px-3 py-1.5 text-end font-semibold text-ink">{r.avg === null ? "–" : fmt(r.avg, digits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-[12px] text-muted">{t("report.split")}</p>
    </div>
  );
}
