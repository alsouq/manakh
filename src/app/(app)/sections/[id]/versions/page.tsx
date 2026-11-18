"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BookOpen, GitCompare, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { diffStrategy } from "@/lib/diff";
import { tData } from "@/lib/i18n";
import { fmtTime } from "@/lib/vars";
import { SITE } from "@/sim/seed";
import type { StrategyVersion } from "@/sim/twin";
import { Badge, Button, Card, Dialog } from "@/components/ui";
import { SaveRecipeDialog } from "@/components/SaveRecipeDialog";

export default function VersionsPage() {
  const { id } = useParams<{ id: string }>();
  const s = useStore();
  const t = s.t;
  const lang = s.s.lang;
  const list = [...s.versions(id)].reverse();
  const active = s.activeVersion(id);
  const [compare, setCompare] = useState<StrategyVersion | null>(null);
  const [toRecipe, setToRecipe] = useState<StrategyVersion | null>(null);
  const L = s.twin!.live[id];

  return (
    <Card>
      <ul className="divide-y divide-line">
        {list.map((v) => {
          const isActive = v.version === active.version;
          const n = diffStrategy(active.doc, v.doc).length;
          return (
            <li key={v.version} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="num inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-surface-2 px-2 text-sm font-semibold">v{v.version}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {isActive && <Badge tone="good">{t("st.active")}</Badge>}
                  <Badge>{v.source}</Badge>
                  <span className="truncate text-ink">{v.note || "—"}</span>
                </div>
                <div className="num mt-0.5 text-[12px] text-muted">
                  {v.createdAt ? fmtTime(v.createdAt, SITE.geo.tz, true) : "—"} · {v.author}
                  {!isActive && ` · ${t("rc.diff", { n })}`}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!isActive && (
                  <Button size="sm" variant="ghost" onClick={() => setCompare(v)}>
                    <GitCompare size={15} /> {t("st.compareActive")}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setToRecipe(v)}>
                  <BookOpen size={15} /> {t("st.saveRecipe")}
                </Button>
                {!isActive && (
                  <Button size="sm" onClick={() => s.rollback(id, v.version)}>
                    <RotateCcw size={15} /> {t("st.rollback")}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {compare && (
        <Dialog open onClose={() => setCompare(null)} title={`v${compare.version} ${t("st.compareActive")} (v${active.version})`} wide>
          <ul className="space-y-1 text-[13px]">
            {diffStrategy(active.doc, compare.doc).map((c, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-line py-1">
                <span className="text-ink-2">
                  <span className="text-muted">{c.scope ? (c.scope.startsWith("st.") ? t(c.scope) : tData(lang, c.scope)) : ""} · </span>
                  {t(c.label)}
                </span>
                <span className="num">
                  <span className="text-muted">{c.from.startsWith("st.") ? t(c.from) : c.from}</span> → <b>{c.to.startsWith("st.") ? t(c.to) : c.to}</b>
                </span>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
      {toRecipe && (
        <SaveRecipeDialog
          defaultName={`${L.def.name} v${toRecipe.version}`}
          crop={L.def.crop}
          onClose={() => setToRecipe(null)}
          onSave={(name, crop, stage) => {
            s.saveRecipe({ name, crop, stage, note: toRecipe.note, doc: toRecipe.doc });
            s.toast(`✓ ${name}`);
            setToRecipe(null);
          }}
        />
      )}
    </Card>
  );
}

