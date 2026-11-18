"use client";
// Opened by the [V] badge in the ACTUAL table. Edits one setpoint — a period setpoint shows
// the day curve plus a value per period; a field setpoint shows a single number. Saving
// creates a new strategy version (so it is audited and reversible), exactly like IIVO.
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { tData } from "@/lib/i18n";
import { getField, setField, type Param } from "@/lib/params";
import { SetpointCurve } from "@/components/SetpointCurve";
import type { Strategy } from "@/engine/types";
import { Button, Dialog, Field, NumberInput } from "@/components/ui";

const clone = (d: Strategy): Strategy => JSON.parse(JSON.stringify(d));

export function SetpointEditorDialog({ sectionId, param, onClose }: { sectionId: string; param: Param; onClose: () => void }) {
  const s = useStore();
  const t = s.t;
  const lang = s.s.lang;
  const tw = s.twin!;
  const active = s.activeVersion(sectionId);
  const [draft, setDraft] = useState<Strategy>(() => clone(active.doc));
  const lt = tw.lt;

  const edit = (fn: (d: Strategy) => void) =>
    setDraft((d) => {
      const n = clone(d);
      fn(n);
      return n;
    });

  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(active.doc), [draft, active.doc]);

  return (
    <Dialog
      open
      onClose={onClose}
      wide={param.scope === "period"}
      title={`${t(param.label)}${param.unit ? ` · ${param.unit}` : ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!changed}
            onClick={() => {
              const v = s.saveStrategy(sectionId, draft, t(param.label));
              s.toast(t("st.saved", { v }));
              onClose();
            }}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      {param.scope === "period" ? (
        <div className="space-y-4">
          <SetpointCurve strategy={draft} sunrise={lt.sunriseMin} sunset={lt.sunsetMin} now={lt.minuteOfDay} series={param.curve} unit={param.unit} digits={param.digits} height={190} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-[12px] text-muted">
                  <th className="px-2 py-1 text-start font-medium">{t("st.periodName")}</th>
                  {draft.periods.map((p) => (
                    <th key={p.id} className="px-1 py-1 text-center font-semibold text-ink">
                      {tData(lang, p.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 py-1 text-[13px] text-ink-2">
                    {t(param.label)} <span className="text-muted">{param.unit}</span>
                  </td>
                  {draft.periods.map((p, i) => (
                    <td key={p.id} className="px-1 py-1">
                      <NumberInput value={p[param.key]} min={param.min} max={param.max} step={param.step} onChange={(v) => edit((d) => void (d.periods[i][param.key] = v))} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-muted">{t("actual.editHint")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label={`${t(param.label)} (${param.unit})`}>
            <NumberInput className="w-40" value={getField(draft, param.path)} min={param.min} max={param.max} step={param.step} onChange={(v) => edit((d) => setField(d, param.path, v))} />
          </Field>
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-muted">{t("actual.editHintField")}</p>
        </div>
      )}
    </Dialog>
  );
}
