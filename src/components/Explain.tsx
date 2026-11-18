"use client";
import type { Breakdown, Reason } from "@/engine/types";
import { tData } from "@/lib/i18n";
import { fmt } from "@/lib/vars";
import { useStore } from "@/lib/store";

export function BreakdownView({ b, unit, digits = 1 }: { b: Breakdown; unit: string; digits?: number }) {
  const s = useStore();
  const t = s.t;
  const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
  return (
    <div className="num space-y-1 text-[13px]">
      <div className="flex justify-between gap-3">
        <span className="text-ink-2">{t("sec.base", { p: tData(s.s.lang, b.periodName) })}</span>
        <span className="text-ink">
          {fmt(b.base, digits)} {unit}
        </span>
      </div>
      {b.items.map((it, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span className="text-ink-2">{t(it.code, { ...it.params, p: it.params?.p ? tData(s.s.lang, String(it.params.p)) : "" })}</span>
          {it.code !== "inf.ramp" && (
            <span className={it.delta > 0 ? "text-[var(--s2)]" : "text-[var(--s1)]"}>
              {sign(it.delta)}
              {fmt(Math.abs(it.delta), digits)}
            </span>
          )}
        </div>
      ))}
      <div className="flex justify-between gap-3 border-t border-line pt-1 font-semibold">
        <span className="text-ink">{t("sec.result")}</span>
        <span className="text-ink">
          {fmt(b.result, digits)} {unit}
        </span>
      </div>
    </div>
  );
}

export function ReasonList({ reasons }: { reasons: Reason[] }) {
  const s = useStore();
  return (
    <ul className="space-y-1 text-[13px] text-ink-2">
      {reasons.map((r, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          <span>{s.t(r.code, r.params)}</span>
        </li>
      ))}
    </ul>
  );
}
