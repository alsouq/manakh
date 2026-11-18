"use client";
import { useMemo, useState } from "react";
import { ChevronRight, Cpu, HardDrive, Network, Plus, Server, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { buildIoTree, MODULE_CATALOG, moduleSpec, type Channel, type ControlStation, type Datapoint, type IoModule, type ModuleKind } from "@/lib/io";
import { Badge, Button, Card, cx, Dialog, Empty, Field, NumberInput } from "@/components/ui";

const typeColor: Record<string, string> = { AO: "var(--s2)", AI: "var(--s1)", DO: "var(--s7)", DI: "var(--s3)" };

export default function IoConfigPage() {
  const s = useStore();
  const t = s.t;
  const [tree, setTree] = useState<ControlStation[]>(() => buildIoTree());
  const [open, setOpen] = useState<Set<string>>(() => new Set(tree.flatMap((c) => [c.id, ...c.ethercans.map((e) => e.id), ...c.ethercans.flatMap((e) => e.datapoints.map((d) => d.id))])));
  const [selId, setSelId] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<Datapoint | null>(null);

  const toggle = (id: string) => setOpen((o) => (o.has(id) ? new Set([...o].filter((x) => x !== id)) : new Set([...o, id])));

  const channelsById = useMemo(() => {
    const m = new Map<string, Channel>();
    for (const c of tree) for (const e of c.ethercans) for (const d of e.datapoints) for (const mo of d.modules) for (const ch of mo.channels) m.set(ch.id, ch);
    return m;
  }, [tree]);
  const sel = selId ? channelsById.get(selId) : null;

  const addModules = (dp: Datapoint, picks: { kind: ModuleKind; amount: number }[]) => {
    setTree((prev) =>
      prev.map((c) => ({
        ...c,
        ethercans: c.ethercans.map((e) => ({
          ...e,
          datapoints: e.datapoints.map((d) => {
            if (d.id !== dp.id) return d;
            const newMods: IoModule[] = [];
            for (const p of picks)
              for (let i = 0; i < p.amount; i++) {
                const spec = moduleSpec(p.kind);
                newMods.push({ id: `mod-${Math.random().toString(36).slice(2, 8)}`, kind: p.kind, channels: Array.from({ length: spec.count }, (_, j) => ({ id: `ch-${Math.random().toString(36).slice(2, 8)}-${j}`, name: `${spec.type} ${j + 1}`, type: spec.type, voltage: spec.voltage })) });
              }
            return { ...d, modules: [...d.modules, ...newMods] };
          }),
        })),
      })),
    );
    s.toast(t("io.added", { n: picks.reduce((a, p) => a + p.amount, 0) }));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-[13px] font-semibold text-ink">{t("io.tree")}</span>
          <Badge tone="brand">{t("common.demo")}</Badge>
        </div>
        <div className="max-h-[70vh] overflow-auto p-2 text-[13px]">
          {tree.map((cs) => (
            <TreeNode key={cs.id} label={cs.name} icon={<Server size={15} />} expanded={open.has(cs.id)} onToggle={() => toggle(cs.id)} depth={0}>
              {cs.ethercans.map((e) => (
                <TreeNode key={e.id} label={e.name} icon={<Network size={15} />} expanded={open.has(e.id)} onToggle={() => toggle(e.id)} depth={1}>
                  {e.datapoints.map((d) => (
                    <TreeNode
                      key={d.id}
                      label={d.name}
                      icon={<Cpu size={15} />}
                      expanded={open.has(d.id)}
                      onToggle={() => toggle(d.id)}
                      depth={2}
                      action={
                        <button onClick={(ev) => (ev.stopPropagation(), setAddTo(d))} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-brand" title={t("io.addModules")}>
                          <Plus size={14} />
                        </button>
                      }
                    >
                      {d.modules.map((mo) => (
                        <TreeNode key={mo.id} label={t(moduleSpec(mo.kind).label)} icon={<HardDrive size={14} />} expanded={open.has(mo.id)} onToggle={() => toggle(mo.id)} depth={3}>
                          {mo.channels.map((ch) => (
                            <button
                              key={ch.id}
                              onClick={() => setSelId(ch.id)}
                              className={cx("flex w-full items-center gap-2 rounded-md py-1 pe-2 text-start hover:bg-surface-2", selId === ch.id && "bg-brand-soft")}
                              style={{ paddingInlineStart: 4 * 16 }}
                            >
                              <span className="inline-flex h-4 w-6 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: typeColor[ch.type] }}>
                                {ch.type}
                              </span>
                              <span className="num text-muted">{ch.name}</span>
                              {ch.connectedTo && <span className="truncate text-ink-2">· {ch.connectedTo.startsWith("io.") || ch.connectedTo.startsWith("var.") ? t(ch.connectedTo) : ch.connectedTo}</span>}
                            </button>
                          ))}
                        </TreeNode>
                      ))}
                    </TreeNode>
                  ))}
                </TreeNode>
              ))}
            </TreeNode>
          ))}
        </div>
      </Card>

      <Card className="h-fit p-4">
        {sel ? <ChannelProps ch={sel} /> : <Empty icon={<Zap size={28} />} title={t("io.pickChannel")} hint={t("io.pickHint")} />}
      </Card>

      {addTo && <AddModulesDialog dp={addTo} onClose={() => setAddTo(null)} onAdd={(picks) => (addModules(addTo, picks), setAddTo(null))} />}
    </div>
  );
}

function TreeNode({ label, icon, expanded, onToggle, depth, children, action }: { label: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void; depth: number; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="group flex items-center gap-1 rounded-md hover:bg-surface-2" style={{ paddingInlineStart: depth * 16 }}>
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-start">
          <ChevronRight size={14} className={cx("shrink-0 text-muted transition-transform rtl:-scale-x-100", expanded && "rotate-90 rtl:-rotate-90")} />
          <span className="text-muted">{icon}</span>
          <span className="truncate font-medium text-ink">{label}</span>
        </button>
        {action}
      </div>
      {expanded && children}
    </div>
  );
}

function ChannelProps({ ch }: { ch: Channel }) {
  const s = useStore();
  const t = s.t;
  const analogue = ch.type === "AI" || ch.type === "AO";
  const io = ch.type === "AO" || ch.type === "DO" ? t("io.output") : t("io.input");
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold">{t("io.channelProps")}</h3>
        <p className="mt-0.5 text-[13px] text-muted">
          {t("io.channelType")}: {io}, {analogue ? t("io.analogue") : t("io.digital")}, {ch.voltage}
        </p>
      </div>
      <Row label={t("io.connected")} value={ch.connectedTo ? (ch.connectedTo.startsWith("io.") || ch.connectedTo.startsWith("var.") ? t(ch.connectedTo) : ch.connectedTo) : t("io.notConnected")} />
      {analogue && (
        <>
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="mb-1 text-[13px] font-semibold text-ink">{t("io.sensorCoupling")}</div>
            <div className="text-[13px] text-ink-2">{ch.sensor ? t(ch.sensor) : "—"}</div>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-ink">{t("io.conversion")}</div>
            <div className="num grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-lg bg-surface-2 p-2">
                <div className="text-[11px] text-muted">{t("io.gross")}</div>
                <div className="font-semibold">{ch.gross}</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-2">
                <div className="text-[11px] text-muted">{t("io.nett")}</div>
                <div className="font-semibold">{ch.nett}</div>
              </div>
            </div>
          </div>
          {ch.matrix && (
            <div>
              <div className="mb-1.5 text-[13px] font-semibold text-ink">{t("io.matrix")}</div>
              <table className="num w-full text-[13px]">
                <tbody>
                  <tr>
                    <td className="py-1 text-muted">{ch.matrix[0]}</td>
                    <td className="py-1 text-center text-muted">→</td>
                    <td className="py-1 text-end">{ch.matrix[2]}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted">{ch.matrix[1]}</td>
                    <td className="py-1 text-center text-muted">→</td>
                    <td className="py-1 text-end">{ch.matrix[3]}</td>
                  </tr>
                </tbody>
              </table>
              <div className="num mt-1 text-[12px] text-muted">{t("io.offset")}: {ch.offset}</div>
            </div>
          )}
        </>
      )}
      <TestSignal />
    </div>
  );
}

function TestSignal() {
  const s = useStore();
  const t = s.t;
  const [v, setV] = useState(32767);
  return (
    <div className="border-t border-line pt-3">
      <div className="mb-1.5 text-[13px] font-semibold text-ink">{t("io.testSignal")}</div>
      <div className="flex items-end gap-2">
        <Field label={t("io.withOffset")} className="flex-1">
          <NumberInput value={v} step={1000} onChange={setV} />
        </Field>
        <Button size="sm" onClick={() => s.toast(t("io.testSent", { v }))}>
          {t("io.test")}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function AddModulesDialog({ dp, onClose, onAdd }: { dp: Datapoint; onClose: () => void; onAdd: (picks: { kind: ModuleKind; amount: number }[]) => void }) {
  const s = useStore();
  const t = s.t;
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const total = Object.values(amounts).reduce((a, b) => a + (b || 0), 0);
  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={`${t("io.addModules")} · ${dp.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" disabled={total === 0} onClick={() => onAdd(MODULE_CATALOG.filter((m) => amounts[m.kind] > 0).map((m) => ({ kind: m.kind, amount: amounts[m.kind] })))}>
            {t("io.addN", { n: total })}
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-line">
        {MODULE_CATALOG.map((m) => {
          const amt = amounts[m.kind] || 0;
          return (
            <li key={m.kind} className="flex items-center gap-3 py-2.5">
              <input type="checkbox" checked={amt > 0} onChange={(e) => setAmounts((a) => ({ ...a, [m.kind]: e.target.checked ? 1 : 0 }))} className="accent-[var(--brand)]" />
              <span className="inline-flex h-5 w-7 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: typeColor[m.type] }}>
                {m.type}
              </span>
              <span className="flex-1 text-sm text-ink">{t(m.label)}</span>
              <span className="text-[12px] text-muted">{m.voltage}</span>
              {amt > 0 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setAmounts((a) => ({ ...a, [m.kind]: Math.max(1, amt - 1) }))} className="h-7 w-7 rounded-lg border border-line-strong text-ink-2">
                    −
                  </button>
                  <span className="num w-8 text-center font-semibold">{amt}</span>
                  <button onClick={() => setAmounts((a) => ({ ...a, [m.kind]: amt + 1 }))} className="h-7 w-7 rounded-lg border border-line-strong text-ink-2">
                    +
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
