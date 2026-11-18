"use client";
import Link from "next/link";
import { Bell, CheckCircle2, Droplets, Flame, Hand, Sun, Wind, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { SECTIONS, SITE } from "@/sim/seed";
import { fmt, fmtTime } from "@/lib/vars";
import { fmtMinutes } from "@/engine/sun";
import { tData } from "@/lib/i18n";
import { SectionCard } from "@/components/SectionCard";
import { Card, CardHeader, PageHeader, PriorityBadge, Stat } from "@/components/ui";

export default function Overview() {
  const s = useStore();
  const t = s.t;
  const tw = s.twin!;
  const o = tw.outside;
  const lt = tw.lt;
  const alarms = s.unhandledAlarms();
  const overrides = s.activeOverrides();
  const gasToday = SECTIONS.reduce((x, d) => x + tw.live[d.id].totals.gasM3, 0);
  const totalArea = SECTIONS.reduce((x, d) => x + d.area, 0);
  const waterToday = SECTIONS.reduce((x, d) => x + tw.live[d.id].totals.waterLm2 * d.area, 0) / 1000;
  const radSum = tw.live.a.totals.radSum;

  return (
    <div>
      <PageHeader
        title={t("ov.title")}
        sub={
          <span className="num">
            {s.s.lang === "ar" ? SITE.nameAr : SITE.name} · {t("ov.sun", { a: fmtMinutes(lt.sunriseMin), b: fmtMinutes(lt.sunsetMin) })}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Link href="/weather" className="col-span-2 block">
          <Card className="flex h-full items-center gap-4 p-4 hover:shadow-md">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--s4)]/15">
              <Sun className="text-[var(--s4)]" size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-ink-2">{t("top.outside")}</div>
              <div className="num text-2xl font-semibold tracking-tight">
                {fmt(o.temp, 1)}
                <span className="text-sm font-normal text-muted">°C</span>
                <span className="ms-3 text-base font-medium text-ink-2">{fmt(o.rh, 0)}%</span>
              </div>
              <div className="num mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
                <span>{fmt(o.radiation, 0)} W/m²</span>
                <span className="inline-flex items-center gap-1">
                  <Wind size={12} /> {fmt(o.wind, 1)} m/s
                </span>
                <span>
                  {t("ov.radSum")} {fmt(radSum, 0)} J/cm²
                </span>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/alarms" className="block">
          <Stat icon={<Bell size={15} />} label={t("ov.activeAlarms")} value={alarms.length} tone={alarms.length ? "critical" : undefined} />
        </Link>
        <Stat icon={<Hand size={15} />} label={t("ov.manual")} value={overrides.length} tone={overrides.length ? "manual" : undefined} />
        <Link href="/energy" className="block">
          <Stat icon={<Flame size={15} />} label={t("ov.gasNow")} value={fmt(tw.siteNow.gasM3h, 0)} unit="m³/h" sub={`${t("ov.gasToday")} ${fmt(gasToday, 0)} m³`} />
        </Link>
        <Link href="/water" className="block">
          <Stat icon={<Droplets size={15} />} label={t("ov.waterToday")} value={fmt(waterToday, 1)} unit="m³" sub={`${fmt((waterToday * 1000) / totalArea, 2)} L/m²`} />
        </Link>
      </div>

      <h2 className="mt-7 mb-3 text-[15px] font-semibold text-ink">{t("ov.sections")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((d) => (
          <SectionCard key={d.id} id={d.id} />
        ))}
      </div>

      <div className="mt-7 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("ov.activeAlarms")} right={<Link className="text-[13px] font-medium text-brand" href="/alarms">{t("nav.alarms")} →</Link>} />
          {alarms.length === 0 ? (
            <div className="flex items-center gap-2 px-4 pb-4 text-sm text-ink-2">
              <CheckCircle2 size={18} className="text-good" /> {t("ov.allOk")}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {alarms.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <PriorityBadge p={a.priority} label={t(`al.p.${a.priority}`)} />
                    <div className="truncate text-sm text-ink">
                      {tData(s.s.lang, a.ruleName)} · {s.sectionName(a.sectionId)}
                    </div>
                  </div>
                  <span className="num shrink-0 text-[12px] text-muted">{fmtTime(a.raisedAt, SITE.geo.tz)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={t("ov.manual")} />
          {overrides.length === 0 ? (
            <div className="px-4 pb-4 text-sm text-muted">{t("common.none")}</div>
          ) : (
            <ul className="divide-y divide-line">
              {overrides.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <Link href={`/sections/${o.sectionId}`} className="min-w-0 truncate text-ink hover:underline">
                    {s.sectionName(o.sectionId)} · {t(`var.${o.actuator}`)} = <span className="num">{fmt(o.value, 0)}</span>
                  </Link>
                  <span className="num shrink-0 text-[12px] text-[#6250d6] dark:text-[#9085e9]">{t("sec.manualActive", { t: fmtTime(o.until, SITE.geo.tz) })}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 px-4 pt-1 pb-4 text-[12px] text-muted">
            <Zap size={13} /> {t("ov.elecNow")} <span className="num">{fmt(tw.siteNow.elecKw, 0)} kW</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
