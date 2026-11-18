"use client";
import { useRef, useState } from "react";
import { LayoutGrid, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { SECTIONS } from "@/sim/seed";
import { Button, Card, cx } from "@/components/ui";

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const GRID = 20;
const W = 720;
const H = 440;
const SLOT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

function autoLayout(): Box[] {
  return SECTIONS.map((d, i) => ({ id: d.id, x: 60 + (i % 2) * 300, y: 60 + Math.floor(i / 2) * 180, w: 240, h: 140 }));
}

export default function FloorplanPage() {
  const s = useStore();
  const t = s.t;
  const [boxes, setBoxes] = useState<Box[]>(() => autoLayout());
  const [sel, setSel] = useState<string>(SECTIONS[0].id);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const snap = (v: number) => Math.round(v / GRID) * GRID;

  const onDown = (e: React.PointerEvent, b: Box) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toSvg(e);
    drag.current = { id: b.id, dx: p.x - b.x, dy: p.y - b.y };
    setSel(b.id);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toSvg(e);
    const { id, dx, dy } = drag.current;
    setBoxes((bs) => bs.map((b) => (b.id === id ? { ...b, x: Math.max(0, Math.min(W - b.w, snap(p.x - dx))), y: Math.max(0, Math.min(H - b.h, snap(p.y - dy))) } : b)));
  };
  const onUp = () => (drag.current = null);

  const selBox = boxes.find((b) => b.id === sel)!;
  const selDef = SECTIONS.find((d) => d.id === sel)!;
  const resize = (dw: number, dh: number) => setBoxes((bs) => bs.map((b) => (b.id === sel ? { ...b, w: Math.max(80, Math.min(W - b.x, b.w + dw)), h: Math.max(60, Math.min(H - b.y, b.h + dh)) } : b)));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[13px] font-semibold text-ink">{t("fp.locations")}</span>
          <Button size="sm" variant="ghost" onClick={() => setBoxes(autoLayout())}>
            <Sparkles size={15} /> {t("fp.auto")}
          </Button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none rounded-xl border border-line bg-surface-2"
          style={{ height: "auto", direction: "ltr" }}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <defs>
            <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="var(--border)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />
          {boxes.map((b, i) => {
            const d = SECTIONS.find((x) => x.id === b.id)!;
            const active = b.id === sel;
            const c = SLOT[i % 4];
            return (
              <g key={b.id} onPointerDown={(e) => onDown(e, b)} style={{ cursor: "move" }}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={active ? c : "var(--surface)"} fillOpacity={active ? 0.12 : 1} stroke={active ? c : "var(--border-strong)"} strokeWidth={active ? 2.5 : 1.5} />
                <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 6} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--text)">
                  {d.code}
                </text>
                <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 14} textAnchor="middle" fontSize="12" fill="var(--muted)">
                  {s.s.lang === "ar" ? d.nameAr : d.name}
                </text>
                <text x={b.x + b.w / 2} y={b.y + b.h - 8} textAnchor="middle" fontSize="10" fill="var(--muted)" className="num">
                  {Math.round(b.w / GRID)} × {Math.round(b.h / GRID)}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="px-1 pt-2 text-[12px] text-muted">{t("fp.hint")}</p>
      </Card>

      <Card className="h-fit p-4">
        <div className="mb-3 flex items-center gap-2">
          <LayoutGrid size={16} className="text-brand" />
          <h3 className="text-[15px] font-semibold">{t("fp.selected")}</h3>
        </div>
        <div className="space-y-2">
          {SECTIONS.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setSel(d.id)}
              className={cx("flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-start", d.id === sel ? "border-brand bg-brand-soft" : "border-line")}
            >
              <span className="h-3 w-3 rounded" style={{ background: SLOT[i % 4] }} />
              <span className="flex-1 text-sm text-ink">
                <b>{d.code}</b> · {s.s.lang === "ar" ? d.nameAr : d.name}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 text-[13px] font-semibold text-ink">
            {selDef.code} · {t("fp.size")}
          </div>
          <div className="num grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-2 py-1.5">
              <button onClick={() => resize(-GRID, 0)} className="text-muted">−</button>
              <span>W {Math.round(selBox.w / GRID)}</span>
              <button onClick={() => resize(GRID, 0)} className="text-brand">+</button>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-2 py-1.5">
              <button onClick={() => resize(0, -GRID)} className="text-muted">−</button>
              <span>H {Math.round(selBox.h / GRID)}</span>
              <button onClick={() => resize(0, GRID)} className="text-brand">+</button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
