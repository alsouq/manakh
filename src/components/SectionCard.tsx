"use client";
import Link from "next/link";
import { Blinds, Fan, Flame, Lightbulb, Wind, CloudFog, Leaf, Hand, AlertOctagon } from "lucide-react";
import { store, useStore } from "@/lib/store";
import { fmt } from "@/lib/vars";
import { tData } from "@/lib/i18n";
import { Sparkline } from "./TimeChart";
import { Badge, Card, cx } from "./ui";

export function ActuatorPill({ icon, value, active, manual, title }: { icon: React.ReactNode; value: string; active: boolean; manual?: boolean; title: string }) {
  return (
    <span
      title={title}
      className={cx(
        "num inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[12px] font-medium",
        manual ? "bg-[#6250d6]/12 text-[#6250d6] dark:text-[#9085e9]" : active ? "bg-surface-2 text-ink" : "text-muted",
      )}
    >
      {icon}
      {value}
    </span>
  );
}

export function SectionCard({ id }: { id: string }) {
  const s = useStore();
  const t = s.t;
  const L = s.twin!.live[id];
  const d = L.def;
  const sp = L.ctrl.setpoints;
  const a = L.phys.act;
  const H = s.twin!.history;
  const n = H.t.length;
  const from = Math.max(0, n - 288);
  const alarms = s.activeAlarms().filter((x) => x.sectionId === id);
  const manual = new Set(L.overrides.map((o) => o.actuator));
  const T = L.phys.temp;
  const tooCold = T < sp.heat - 1;
  const tooWarm = T > sp.vent + 2;
  const lang = s.s.lang;

  return (
    <Link href={`/sections/${id}`} className="group block">
      <Card className={cx("h-full p-4 transition-shadow group-hover:shadow-md", alarms.length > 0 && "border-critical/50")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-sm font-bold text-brand">{d.code}</span>
              <span className="truncate font-semibold text-ink">{lang === "ar" ? d.nameAr : d.name}</span>
            </div>
            <div className="mt-1 truncate text-[12px] text-muted">
              {lang === "ar" ? d.cropAr : d.crop} · {t("sec.area", { n: d.area.toLocaleString("en-US") })}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {alarms.length > 0 && (
              <Badge tone="critical">
                <AlertOctagon size={12} /> {alarms.length}
              </Badge>
            )}
            {manual.size > 0 && (
              <Badge tone="manual">
                <Hand size={12} /> {t("common.manual")}
              </Badge>
            )}
            <Badge>{tData(lang, L.ctrl.periodName)}</Badge>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className={cx("num text-[34px] leading-none font-semibold tracking-tight", tooCold ? "text-[var(--s1)]" : tooWarm ? "text-[var(--s2)]" : "text-ink")}>
              {fmt(T, 1)}
              <span className="text-lg font-normal text-muted">°C</span>
            </div>
            <div className="num mt-1 text-[12px] text-muted">
              {t("var.heat").split(" ")[0]} {fmt(sp.heat, 1)} · {t("var.vent").split(" ")[0]} {fmt(sp.vent, 1)}
            </div>
          </div>
          <div className="num grid grid-cols-2 gap-x-4 gap-y-0.5 text-[13px]">
            <span className="text-muted">RH</span>
            <span className="text-end text-ink">{fmt(L.rh, 0)}%</span>
            <span className="text-muted">CO₂</span>
            <span className="text-end text-ink">{fmt(L.phys.co2, 0)}</span>
            <span className="text-muted">HD</span>
            <span className="text-end text-ink">{fmt(L.hd, 1)}</span>
          </div>
        </div>

        <div className="mt-3">
          <Sparkline values={H.sec[id].temp.slice(from)} color="var(--s2)" band={[H.sec[id].heatSp.slice(from), H.sec[id].ventSp.slice(from)]} />
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          <ActuatorPill icon={<Wind size={13} />} value={`${fmt(Math.max(a.ventLee, a.ventWind), 0)}%`} active={a.ventLee > 1} manual={manual.has("ventLee") || manual.has("ventWind")} title={t("var.ventLee")} />
          <ActuatorPill icon={<Flame size={13} />} value={L.target.pipe > 0 ? `${fmt(L.phys.pipeT, 0)}°` : t("common.off")} active={L.target.pipe > 0} manual={manual.has("pipe")} title={t("var.pipe")} />
          <ActuatorPill icon={<Blinds size={13} />} value={`${fmt(Math.max(a.energyScreen, a.shadeScreen), 0)}%`} active={a.energyScreen > 1 || a.shadeScreen > 1} manual={manual.has("energyScreen") || manual.has("shadeScreen")} title={t("var.energyScreen")} />
          <ActuatorPill icon={<Leaf size={13} />} value={`${fmt(a.co2Valve, 0)}%`} active={a.co2Valve > 1} manual={manual.has("co2Valve")} title={t("var.co2Valve")} />
          {d.phys.hasPadFan && <ActuatorPill icon={<Fan size={13} />} value={`${fmt(a.fans, 0)}%`} active={a.fans > 1} manual={manual.has("fans")} title={t("var.fans")} />}
          {d.phys.hasLamps && <ActuatorPill icon={<Lightbulb size={13} />} value={a.lamps > 0 ? t("common.on") : t("common.off")} active={a.lamps > 0} manual={manual.has("lamps")} title={t("var.lamps")} />}
          {d.phys.hasFog && <ActuatorPill icon={<CloudFog size={13} />} value={a.fog > 0 ? t("common.on") : t("common.off")} active={a.fog > 0} manual={manual.has("fog")} title={t("var.fog")} />}
        </div>
      </Card>
    </Link>
  );
}

export const sectionLabel = (id: string) => store.sectionName(id);
