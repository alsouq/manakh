"use client";
import { History } from "lucide-react";
import { useStore } from "@/lib/store";
import { SITE } from "@/sim/seed";
import { tData } from "@/lib/i18n";
import { fmtTime } from "@/lib/vars";
import { Card, Empty, PageHeader } from "@/components/ui";

export default function ActivityPage() {
  const s = useStore();
  const t = s.t;
  const list = s.s.audit;
  const render = (code: string, p: Record<string, string | number>) => {
    const q: Record<string, string | number> = { ...p };
    if (p.s !== undefined) q.s = s.sectionName(String(p.s));
    if (p.a !== undefined) q.a = t(`var.${p.a}`);
    if (p.r !== undefined) q.r = tData(s.s.lang, String(p.r));
    if (p.d !== undefined) q.d = `${p.d} ${t("u.min")}`;
    return t(code, q);
  };
  return (
    <div>
      <PageHeader title={t("ac.title")} sub={t("ac.hint")} />
      <Card>
        {list.length === 0 ? (
          <Empty icon={<History size={30} />} title={t("ac.empty")} />
        ) : (
          <ol className="divide-y divide-line">
            {list.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5">
                <span className="num w-28 shrink-0 text-[12px] text-muted">{fmtTime(e.t, SITE.geo.tz, true)}</span>
                <span className="min-w-0 flex-1 text-sm text-ink">{render(e.code, e.params)}</span>
                <span className="text-[12px] text-muted">{e.user}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
