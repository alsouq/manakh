"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Hand } from "lucide-react";
import { useStore } from "@/lib/store";
import { SECTIONS } from "@/sim/seed";
import { tData } from "@/lib/i18n";
import { Badge, cx, Empty } from "@/components/ui";

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const s = useStore();
  const t = s.t;
  const d = SECTIONS.find((x) => x.id === id);
  if (!d) return <Empty title={t("sec.notFound")} />;
  const L = s.twin!.live[id];
  const lang = s.s.lang;
  const tabs = [
    { href: `/sections/${id}`, label: t("sec.live") },
    { href: `/sections/${id}/strategy`, label: t("sec.strategy") },
    { href: `/sections/${id}/versions`, label: t("sec.versions") },
  ];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-lg font-bold text-brand">{d.code}</span>
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight">{lang === "ar" ? d.nameAr : d.name}</h1>
          <div className="text-[13px] text-muted">
            {lang === "ar" ? d.cropAr : d.crop} · {t("sec.area", { n: d.area.toLocaleString("en-US") })}
          </div>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <Badge tone="brand">
            {t("sec.periodNow")}: {tData(lang, L.ctrl.periodName)}
          </Badge>
          <Badge>{t("sec.activeVersion", { v: L.version })}</Badge>
          {L.overrides.length > 0 && (
            <Badge tone="manual">
              <Hand size={12} /> {L.overrides.length} {t("common.manual")}
            </Badge>
          )}
        </div>
      </div>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {SECTIONS.length > 1 && (
          <div className="me-2 flex items-center gap-1 lg:hidden">
            {SECTIONS.map((x) => (
              <Link
                key={x.id}
                href={path.replace(`/sections/${id}`, `/sections/${x.id}`)}
                className={cx("rounded-lg px-2.5 py-1 text-sm font-semibold", x.id === id ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-2")}
              >
                {x.code}
              </Link>
            ))}
          </div>
        )}
        {tabs.map((tb) => {
          const active = path === tb.href;
          return (
            <Link key={tb.href} href={tb.href} className={cx("relative px-3 py-2.5 text-sm font-medium whitespace-nowrap", active ? "text-ink" : "text-muted hover:text-ink-2")}>
              {tb.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
