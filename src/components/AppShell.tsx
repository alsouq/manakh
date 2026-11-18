"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  ChartLine,
  CloudSun,
  Droplets,
  Flame,
  History,
  LayoutDashboard,
  Languages,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Sprout,
  Gauge,
} from "lucide-react";
import { store, useStore } from "@/lib/store";
import { SECTIONS, SITE } from "@/sim/seed";
import { fmt, fmtTime } from "@/lib/vars";
import { cx, IconButton, Segmented } from "./ui";

export function useApplyDocPrefs() {
  const s = useStore();
  const { lang, theme } = s.s;
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      html.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [lang, theme]);
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path d="M6 22 L16 9 L26 22" fill="none" stroke="var(--brand-ink)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M16 22 C 16 17, 19 15, 22 15 C 22 19, 19 22, 16 22 Z" fill="var(--brand-ink)" opacity="0.9" />
      <path d="M6 25 H26" stroke="var(--brand-ink)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

const NAV = [
  { href: "/", k: "nav.overview", icon: LayoutDashboard },
  { href: "/graphs", k: "nav.graphs", icon: ChartLine },
  { href: "/alarms", k: "nav.alarms", icon: Bell },
  { href: "/recipes", k: "nav.recipes", icon: BookOpen },
  { href: "/weather", k: "nav.weather", icon: CloudSun },
  { href: "/water", k: "nav.water", icon: Droplets },
  { href: "/energy", k: "nav.energy", icon: Flame },
  { href: "/activity", k: "nav.activity", icon: History },
  { href: "/settings", k: "nav.settings", icon: Settings },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

function SectionStatusDot({ id }: { id: string }) {
  const alarms = store.activeAlarms().filter((a) => a.sectionId === id);
  const manual = store.activeOverrides().some((o) => o.sectionId === id);
  const color = alarms.length ? "var(--critical)" : manual ? "#6250d6" : "var(--good)";
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />;
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const s = useStore();
  const path = usePathname();
  const t = s.t;
  const alarmN = s.unhandledAlarms().length;
  const tw = s.twin!;
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Link href="/" onClick={onNavigate} className="mb-3 flex items-center gap-2.5 px-2 py-1.5">
        <Logo />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-ink">{t("app.name")}</div>
          <div className="text-[11px] text-muted">{s.s.lang === "ar" ? SITE.nameAr : SITE.name}</div>
        </div>
      </Link>
      {NAV.slice(0, 1).map((n) => (
        <NavItem key={n.href} {...n} label={t(n.k)} active={isActive(path, n.href)} onClick={onNavigate} />
      ))}
      <div className="mt-2 mb-1 px-3 text-[11px] font-semibold tracking-wide text-muted uppercase">{t("nav.sections")}</div>
      {SECTIONS.map((sec) => {
        const href = `/sections/${sec.id}`;
        const L = tw.live[sec.id];
        return (
          <Link
            key={sec.id}
            href={href}
            onClick={onNavigate}
            className={cx(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm",
              path.startsWith(href) ? "bg-brand-soft font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <SectionStatusDot id={sec.id} />
            <span className="min-w-0 flex-1 truncate">
              {sec.code} · {s.s.lang === "ar" ? sec.nameAr : sec.name}
            </span>
            <span className="num text-[12px] text-muted">{fmt(L.phys.temp, 1)}°</span>
          </Link>
        );
      })}
      <div className="my-2 h-px bg-line" />
      {NAV.slice(1).map((n) => (
        <NavItem
          key={n.href}
          {...n}
          label={t(n.k)}
          active={isActive(path, n.href)}
          onClick={onNavigate}
          badge={n.href === "/alarms" && alarmN > 0 ? alarmN : undefined}
        />
      ))}
      <div className="mt-auto px-3 pt-4 text-[11px] leading-relaxed text-muted">{t("common.demo")}</div>
    </nav>
  );
}

function NavItem({ href, label, icon: Icon, active, badge, onClick }: { href: string; label: string; icon: typeof Bell; active: boolean; badge?: number; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cx(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
        active ? "bg-brand-soft font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      <Icon size={18} className={active ? "text-brand" : ""} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && <span className="num rounded-full bg-critical px-1.5 text-[11px] font-semibold text-white">{badge}</span>}
    </Link>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const s = useStore();
  const t = s.t;
  const tw = s.twin!;
  const now = s.simNow();
  const o = tw.outside;
  const dark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur sm:px-5">
      <IconButton label="Menu" className="lg:hidden" onClick={onMenu}>
        <Menu size={20} />
      </IconButton>
      <div className="flex items-center gap-2 lg:hidden">
        <Logo size={24} />
      </div>
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <div className="num font-semibold text-ink">{fmtTime(now, SITE.geo.tz)}</div>
        <div className="hidden text-muted sm:block">
          {new Intl.DateTimeFormat(s.s.lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { timeZone: SITE.geo.tz, weekday: "short", day: "numeric", month: "short" }).format(new Date(now))}
        </div>
        <Link href="/weather" className="hidden items-center gap-1.5 rounded-lg px-2 py-1 text-ink-2 hover:bg-surface-2 md:flex">
          <Sun size={15} className="text-[var(--s4)]" />
          <span className="num">{fmt(o.temp, 1)}°</span>
          <span className="num text-muted">{fmt(o.radiation, 0)} W/m²</span>
          <span className="num text-muted">{fmt(o.wind, 1)} m/s</span>
        </Link>
      </div>
      <div className="ms-auto flex items-center gap-1">
        <div className="hidden items-center gap-1.5 sm:flex" title={t("top.speed")}>
          <Gauge size={16} className="text-muted" />
          <Segmented
            size="sm"
            value={s.s.speed}
            onChange={(v) => s.setSpeed(v)}
            options={[
              { value: 1, label: "1×" },
              { value: 60, label: "60×" },
              { value: 600, label: "600×" },
            ]}
          />
        </div>
        <IconButton label={t("top.lang")} onClick={() => s.setLang(s.s.lang === "ar" ? "en" : "ar")}>
          <Languages size={18} />
        </IconButton>
        <IconButton label={t("top.theme")} onClick={() => s.setTheme(dark ? "light" : "dark")}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        <Link href="/alarms" className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 lg:hidden" aria-label={t("nav.alarms")}>
          <Bell size={18} />
          {s.unhandledAlarms().length > 0 && <span className="absolute end-1 top-1 h-2.5 w-2.5 rounded-full bg-critical ring-2 ring-bg" />}
        </Link>
        <IconButton label={t("top.signout")} onClick={() => s.logout()}>
          <LogOut size={18} className="rtl:-scale-x-100" />
        </IconButton>
      </div>
    </header>
  );
}

function BottomNav() {
  const s = useStore();
  const path = usePathname();
  const t = s.t;
  const items = [
    { href: "/", k: "nav.overview", icon: LayoutDashboard },
    { href: "/sections/a", k: "nav.sections", icon: Sprout, match: "/sections" },
    { href: "/graphs", k: "nav.graphs", icon: ChartLine },
    { href: "/alarms", k: "nav.alarms", icon: Bell },
    { href: "/water", k: "nav.water", icon: Droplets },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {items.map((n) => {
        const active = isActive(path, n.match ?? n.href);
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-brand" : "text-muted")}>
            <Icon size={20} />
            {t(n.k)}
          </Link>
        );
      })}
    </nav>
  );
}

function Toasts() {
  const s = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {s.toasts.map((x) => (
        <div key={x.id} className={cx("pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg", x.tone === "good" ? "bg-ink text-bg" : "bg-critical text-white")}>
          {x.text}
        </div>
      ))}
    </div>
  );
}

export function Boot({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted">
      <Logo size={40} />
      <div className="text-sm">{label}</div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const s = useStore();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => store.init(), []);
  useApplyDocPrefs();
  useEffect(() => {
    if (s.ready && !s.s.user) router.replace("/login");
  }, [s.ready, s.s.user, router]);

  if (!s.ready || !s.s.user) return <Boot label="…" />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-screen overflow-y-auto border-e border-line bg-surface lg:block">
        <SideNav />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 start-0 w-72 overflow-y-auto bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <SideNav onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <TopBar onMenu={() => setDrawer(true)} />
        <main className="mx-auto max-w-[1400px] px-4 pt-5 pb-28 sm:px-6 lg:pb-10">{children}</main>
      </div>
      <BottomNav />
      <Toasts />
    </div>
  );
}
