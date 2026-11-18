"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { cx, PageHeader } from "@/components/ui";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const s = useStore();
  const t = s.t;
  const path = usePathname();
  const tabs = [
    { href: "/settings", label: t("set.general") },
    { href: "/settings/io", label: t("io.title") },
    { href: "/settings/floorplan", label: t("fp.title") },
  ];
  return (
    <div>
      <PageHeader title={t("nav.settings")} />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tb) => {
          const active = tb.href === "/settings" ? path === "/settings" : path.startsWith(tb.href);
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
