"use client";
import { useState } from "react";
import { BookOpen, Copy, Play, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { SECTIONS, type Recipe } from "@/sim/seed";
import { diffStrategy } from "@/lib/diff";
import { tData } from "@/lib/i18n";
import { fmt } from "@/lib/vars";
import { SaveRecipeDialog } from "@/components/SaveRecipeDialog";
import { Badge, Button, Card, cx, Dialog, IconButton, PageHeader, Select } from "@/components/ui";

function summary(r: Recipe) {
  const ps = r.doc.periods;
  const day = ps.reduce((a, p) => (p.co2 > a.co2 ? p : a), ps[0]);
  const night = ps.reduce((a, p) => (p.heat < a.heat ? p : a), ps[0]);
  return { dayHeat: day.heat, nightHeat: night.heat, dayVent: day.vent, co2: day.co2, n: ps.length };
}

export default function RecipesPage() {
  const s = useStore();
  const t = s.t;
  const lang = s.s.lang;
  const [apply, setApply] = useState<Recipe | null>(null);
  const [fromSec, setFromSec] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title={t("rc.title")}
        sub={t("rc.hint")}
        right={
          <Button variant="primary" size="sm" onClick={() => setFromSec("a")}>
            <Plus size={15} /> {t("rc.fromSection")}
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {s.s.recipes.map((r) => {
          const sm = summary(r);
          return (
            <Card key={r.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <BookOpen size={18} />
                  </span>
                  <div>
                    <div className="font-semibold text-ink">{tData(lang, r.name)}</div>
                    <div className="text-[12px] text-muted">
                      {tData(lang, r.crop)} {r.stage && `· ${tData(lang, r.stage)}`}
                    </div>
                  </div>
                </div>
                {r.builtIn && <Badge tone="brand">{t("rc.builtIn")}</Badge>}
              </div>
              {r.note && <p className="mt-2 text-[13px] text-ink-2">{tData(lang, r.note)}</p>}
              <dl className="num mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-2.5 text-center">
                <div>
                  <dt className="text-[11px] text-muted">{t("rc.dayNight")}</dt>
                  <dd className="text-sm font-semibold">
                    {fmt(sm.dayHeat, 1)} / {fmt(sm.nightHeat, 1)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted">{t("rc.dayVent")}</dt>
                  <dd className="text-sm font-semibold">{fmt(sm.dayVent, 1)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted">{t("rc.co2Day")}</dt>
                  <dd className="text-sm font-semibold">{sm.co2 || "–"}</dd>
                </div>
              </dl>
              <div className="mt-1.5 text-[12px] text-muted">{t("rc.periodsN", { n: sm.n })}</div>
              <div className="mt-auto flex items-center gap-1.5 pt-3">
                <Button size="sm" variant="primary" onClick={() => setApply(r)}>
                  <Play size={14} /> {t("rc.apply")}
                </Button>
                <IconButton
                  label={t("common.duplicate")}
                  onClick={() => s.saveRecipe({ name: `${tData(lang, r.name)} (2)`, crop: r.crop, stage: r.stage, note: r.note, doc: r.doc })}
                >
                  <Copy size={16} />
                </IconButton>
                {!r.builtIn && (
                  <IconButton label={t("common.delete")} onClick={() => s.deleteRecipe(r.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {apply && <ApplyDialog r={apply} onClose={() => setApply(null)} />}
      {fromSec && <FromSectionDialog onClose={() => setFromSec(null)} />}
    </div>
  );
}

function ApplyDialog({ r, onClose }: { r: Recipe; onClose: () => void }) {
  const s = useStore();
  const t = s.t;
  const [pick, setPick] = useState<string[]>([]);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("rc.applyTitle", { n: tData(s.s.lang, r.name) })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!pick.length}
            onClick={() => {
              s.applyRecipe(r.id, pick);
              onClose();
            }}
          >
            {t("common.apply")}
          </Button>
        </>
      }
    >
      <div className="mb-2 text-[13px] font-medium text-ink-2">{t("rc.pick")}</div>
      <div className="space-y-2">
        {SECTIONS.map((d) => {
          const on = pick.includes(d.id);
          const n = diffStrategy(s.activeVersion(d.id).doc, r.doc).length;
          return (
            <button
              key={d.id}
              onClick={() => setPick(on ? pick.filter((x) => x !== d.id) : [...pick, d.id])}
              className={cx("flex w-full items-center gap-3 rounded-xl border p-3 text-start", on ? "border-brand bg-brand-soft" : "border-line-strong")}
            >
              <input type="checkbox" readOnly checked={on} className="accent-[var(--brand)]" />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">{s.sectionName(d.id)}</div>
                <div className="text-[12px] text-muted">
                  {s.s.lang === "ar" ? d.cropAr : d.crop} · v{s.activeVersion(d.id).version} · {t("rc.diff", { n })}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}

function FromSectionDialog({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const t = s.t;
  const [sid, setSid] = useState("a");
  const d = SECTIONS.find((x) => x.id === sid)!;
  const [step, setStep] = useState<"pick" | "name">("pick");
  if (step === "name")
    return (
      <SaveRecipeDialog
        defaultName={`${d.name} · v${s.activeVersion(sid).version}`}
        crop={d.crop}
        onClose={onClose}
        onSave={(name, crop, stage) => {
          s.saveRecipe({ name, crop, stage, note: "", doc: s.activeVersion(sid).doc });
          onClose();
        }}
      />
    );
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("rc.fromSection")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={() => setStep("name")}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <Select value={sid} onChange={setSid} options={SECTIONS.map((x) => ({ value: x.id, label: s.sectionName(x.id) }))} />
    </Dialog>
  );
}
