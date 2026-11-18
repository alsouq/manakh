"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button, Dialog, Field, Input } from "./ui";

export function SaveRecipeDialog({ defaultName, crop: crop0, onClose, onSave }: { defaultName: string; crop: string; onClose: () => void; onSave: (name: string, crop: string, stage: string) => void }) {
  const s = useStore();
  const t = s.t;
  const [name, setName] = useState(defaultName);
  const [crop, setCrop] = useState(crop0);
  const [stage, setStage] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("st.saveRecipe")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), crop, stage)}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t("rc.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("rc.crop")}>
          <Input value={crop} onChange={(e) => setCrop(e.target.value)} />
        </Field>
        <Field label={t("rc.stage")}>
          <Input value={stage} onChange={(e) => setStage(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
