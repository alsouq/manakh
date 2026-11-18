"use client";
import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";
import { AlertTriangle, AlertOctagon, Info, Siren, X } from "lucide-react";
import type { Priority } from "@/sim/seed";

export function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-line bg-surface", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, right, className }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start justify-between gap-3 px-4 pt-4 pb-2", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-brand text-brand-ink hover:bg-brand-hover",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "bg-critical text-white hover:opacity-90",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx("inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "brand" | "good" | "warning" | "critical" | "manual"; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
        tone === "neutral" && "bg-surface-2 text-ink-2",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "good" && "bg-brand-soft text-good-ink",
        tone === "warning" && "bg-warning-soft text-ink",
        tone === "critical" && "bg-critical-soft text-critical",
        tone === "manual" && "bg-[#6250d6]/12 text-[#6250d6] dark:text-[#9085e9]",
        className,
      )}
    >
      {children}
    </span>
  );
}

const PRIO_ICON = { low: Info, medium: AlertTriangle, high: AlertOctagon, critical: Siren };
const PRIO_COLOR = { low: "var(--muted)", medium: "var(--warning)", high: "var(--serious)", critical: "var(--critical)" };
export function PriorityBadge({ p, label }: { p: Priority; label: string }) {
  const I = PRIO_ICON[p];
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink">
      <I size={15} color={PRIO_COLOR[p]} strokeWidth={2.4} />
      {label}
    </span>
  );
}
export const prioColor = (p: Priority) => PRIO_COLOR[p];

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-[10px] font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
            o.value === value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-line overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            "relative px-3 py-2.5 text-sm font-medium whitespace-nowrap",
            value === t.value ? "text-ink" : "text-muted hover:text-ink-2",
          )}
        >
          {t.label}
          {value === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  step = 0.5,
  min,
  max,
  changed,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: number; onChange: (v: number) => void; changed?: boolean }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
      className={cx(
        "num h-9 w-full rounded-lg border bg-surface px-2 text-sm text-ink focus:border-brand focus:outline-none",
        changed ? "border-[#2a78d6] bg-[#2a78d6]/8" : "border-line-strong",
        className,
      )}
      {...rest}
    />
  );
}

export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cx("h-10 w-full rounded-xl border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-brand focus:outline-none", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-ink">
      <span className={cx("relative inline-block h-6 w-10 rounded-full transition-colors", checked ? "bg-brand" : "bg-surface-3")}>
        <span
          className={cx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "start-[18px]" : "start-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          "max-h-[92vh] w-full overflow-auto rounded-t-2xl border border-line bg-surface shadow-2xl outline-none sm:rounded-2xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-surface px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, unit, sub, tone, icon }: { label: ReactNode; value: ReactNode; unit?: string; sub?: ReactNode; tone?: "critical" | "manual"; icon?: ReactNode }) {
  return (
    <Card className="h-full p-4">
      <div className="flex items-center gap-2 text-[13px] text-ink-2">
        {icon}
        {label}
      </div>
      <div className={cx("num mt-1.5 text-2xl font-semibold tracking-tight", tone === "critical" ? "text-critical" : tone === "manual" ? "text-[#6250d6] dark:text-[#9085e9]" : "text-ink")}>
        {value}
        {unit && <span className="ms-1 text-sm font-normal text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </Card>
  );
}

export function PageHeader({ title, sub, right, back }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {sub && <div className="mt-1 text-sm text-ink-2">{sub}</div>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div className="font-medium text-ink">{title}</div>
      {hint && <div className="max-w-sm text-sm text-muted">{hint}</div>}
    </div>
  );
}

export function Bar({ value, color = "var(--brand)", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
