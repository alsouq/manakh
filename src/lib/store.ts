"use client";
// Client-side app store: persisted settings + the running digital twin.
// Phase 2 swaps persistence for Supabase and the twin for live data from the edge controller.
import { useSyncExternalStore, useCallback } from "react";
import type { ActuatorKey, Strategy } from "@/engine/types";
import { translate, type Lang } from "./i18n";
import {
  DEFAULT_IRRIGATION,
  DEFAULT_RULES,
  DEFAULT_STRATEGIES,
  SECTIONS,
  defaultRecipes,
  type AlarmRule,
  type IrrigationSettings,
  type Recipe,
} from "@/sim/seed";
import { Twin, type Alarm, type Override, type StrategyVersion } from "@/sim/twin";
import { isCloud } from "@/lib/config";
import type { SupabaseRepo } from "@/lib/supabase/repo";

export interface AuditEntry {
  id: string;
  t: number;
  user: string;
  code: string;
  params: Record<string, string | number>;
}

export interface GraphView {
  id: string;
  name: string;
  series: string[];
  rangeH: number;
}

export interface AlarmUserState {
  ackAt?: number;
  ackBy?: string;
  snoozedUntil?: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: "good" | "bad";
}

interface Persisted {
  v: 2;
  user: { name: string; email: string } | null;
  lang: Lang;
  theme: "light" | "dark" | "system";
  clockOffset: number;
  speed: number;
  versions: Record<string, StrategyVersion[]>;
  overrides: Override[];
  recipes: Recipe[];
  rules: AlarmRule[];
  alarmState: Record<string, AlarmUserState>;
  audit: AuditEntry[];
  irrigation: Record<string, IrrigationSettings>;
  views: GraphView[];
}

const KEY = "manakh:v2";

function fresh(): Persisted {
  const versions: Record<string, StrategyVersion[]> = {};
  for (const s of SECTIONS)
    versions[s.id] = [{ version: 1, doc: DEFAULT_STRATEGIES[s.id](), note: "", createdAt: 0, activeFrom: 0, author: "Manakh", source: "seed" }];
  return {
    v: 2,
    user: null,
    lang: "ar",
    theme: "system",
    clockOffset: 0,
    speed: 1,
    versions,
    overrides: [],
    recipes: defaultRecipes(Date.now()),
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
    alarmState: {},
    audit: [],
    irrigation: JSON.parse(JSON.stringify(DEFAULT_IRRIGATION)),
    views: [
      { id: "v1", name: "Climate A + outside", series: ["a:temp", "a:heatSp", "a:ventSp", "out:outTemp", "a:rh", "out:radiation"], rangeH: 24 },
      { id: "v2", name: "All sections temperature", series: ["a:temp", "b:temp", "c:temp", "d:temp"], rangeH: 48 },
    ],
  };
}

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10));
const PREFS = "manakh:prefs";

class Store {
  s: Persisted = fresh();
  twin: Twin | null = null;
  ready = false;
  mode: "cloud" | "demo" = isCloud ? "cloud" : "demo";
  cloud: SupabaseRepo | null = null;
  rev = 0;
  toasts: Toast[] = [];
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastReal = 0;
  private ticks = 0;

  init() {
    void this.initAsync();
  }

  private async initAsync() {
    if (this.ready || typeof window === "undefined") return;
    // theme/speed are per-device UI prefs, kept out of the cloud
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS) ?? "{}");
      if (prefs.theme) this.s.theme = prefs.theme;
    } catch {
      /* ignore */
    }

    if (this.mode === "cloud") {
      const { SupabaseRepo } = await import("@/lib/supabase/repo");
      this.cloud = new SupabaseRepo();
      this.cloud.onError = (m) => this.toast(m, "bad");
      const user = await this.cloud.currentUser().catch(() => null);
      if (!user) {
        this.ready = true;
        this.emit();
        return; // AppShell / middleware will route to /login
      }
      this.s.user = { name: (user.user_metadata?.name as string) || user.email!.split("@")[0], email: user.email! };
      try {
        const snap = await this.cloud.loadOrBootstrap(this.s.lang, this.s.user.name);
        this.s.lang = snap.language;
        this.s.versions = snap.versions;
        this.s.recipes = snap.recipes;
        this.s.rules = snap.rules;
        this.s.overrides = snap.overrides;
        this.s.irrigation = snap.irrigation;
        this.s.views = snap.views;
        this.s.audit = snap.audit;
      } catch {
        // error already surfaced; fall back to local defaults so the UI still runs
      }
    } else {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const p = JSON.parse(raw) as Persisted;
          if (p.v === 2) this.s = { ...fresh(), ...p, theme: this.s.theme };
        }
      } catch {
        /* storage blocked: run with defaults */
      }
    }
    this.buildTwin();
    this.ready = true;
    this.lastReal = Date.now();
    this.timer = setInterval(() => this.tick(), 1000);
    this.emit();
  }

  private buildTwin() {
    const now = this.simNow();
    this.twin = new Twin(
      {
        versions: (id) => this.s.versions[id],
        overrides: () => this.s.overrides,
        rules: () => this.s.rules,
        irrigation: (id) => this.s.irrigation[id],
      },
      now - 50 * 3600000,
    );
    this.twin.advanceTo(now);
    const H = this.twin.history;
    const cut = H.t.findIndex((t) => t >= now - 48 * 3600000);
    if (cut > 0) {
      H.t.splice(0, cut);
      for (const k of Object.keys(H.out)) H.out[k as keyof typeof H.out].splice(0, cut);
      for (const id of Object.keys(H.sec)) for (const k of Object.keys(H.sec[id])) H.sec[id][k as keyof (typeof H.sec)[string]].splice(0, cut);
    }
  }

  simNow() {
    return Date.now() + this.s.clockOffset;
  }

  private tick() {
    const real = Date.now();
    const el = real - this.lastReal;
    this.lastReal = real;
    if (this.s.speed !== 1) this.s.clockOffset += el * (this.s.speed - 1);
    this.twin?.advanceTo(this.simNow());
    if (++this.ticks % 20 === 0) this.persist();
    this.emit();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getRev = () => this.rev;
  private emit() {
    this.rev++;
    for (const l of this.listeners) l();
  }

  persist() {
    try {
      localStorage.setItem(PREFS, JSON.stringify({ theme: this.s.theme }));
      if (this.mode === "demo") localStorage.setItem(KEY, JSON.stringify(this.s));
    } catch {
      /* ignore */
    }
  }

  /** Fire a cloud write without blocking the UI; the repo surfaces its own errors. */
  private push(p: Promise<unknown> | undefined) {
    if (p) p.catch(() => {});
  }

  private commit() {
    this.persist();
    this.emit();
  }

  toast(text: string, tone: Toast["tone"] = "good") {
    const id = Date.now() + Math.random();
    this.toasts = [...this.toasts, { id, text, tone }];
    this.emit();
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== id);
      this.emit();
    }, 3500);
  }

  t = (key: string, params?: Record<string, string | number>) => translate(this.s.lang, key, params);

  private audit(code: string, params: Record<string, string | number> = {}) {
    const id = uid();
    this.s.audit.unshift({ id, t: this.simNow(), user: this.s.user?.name ?? "—", code, params });
    if (this.s.audit.length > 500) this.s.audit.length = 500;
    this.push(this.cloud?.appendAudit(id, code, params));
  }

  sectionName(id: string) {
    if (id === "site") return this.t("common.site");
    const d = SECTIONS.find((s) => s.id === id);
    if (!d) return id;
    return `${d.code} · ${this.s.lang === "ar" ? d.nameAr : d.name}`;
  }

  // ---------- session ----------
  login(name: string, email: string) {
    this.s.user = { name: name || email.split("@")[0], email };
    this.audit("ac.login");
    this.commit();
  }
  logout() {
    if (this.cloud) {
      this.push(this.cloud.signOut().then(() => (window.location.href = "/login")));
      return;
    }
    this.s.user = null;
    this.commit();
  }
  setLang(l: Lang) {
    this.s.lang = l;
    this.push(this.cloud?.setLanguage(l));
    this.commit();
  }
  setTheme(th: Persisted["theme"]) {
    this.s.theme = th;
    this.commit();
  }
  setSpeed(sp: number) {
    this.s.speed = sp;
    this.commit();
  }

  // ---------- strategies ----------
  versions(sectionId: string) {
    return this.s.versions[sectionId];
  }
  activeVersion(sectionId: string) {
    const now = this.simNow();
    const list = this.s.versions[sectionId];
    for (let i = list.length - 1; i >= 0; i--) if (list[i].activeFrom <= now) return list[i];
    return list[0];
  }
  saveStrategy(sectionId: string, doc: Strategy, note: string, source: StrategyVersion["source"] = "manual") {
    const list = this.s.versions[sectionId];
    const v = Math.max(...list.map((x) => x.version)) + 1;
    const now = this.simNow();
    const row: StrategyVersion = { id: uid(), version: v, doc: JSON.parse(JSON.stringify(doc)), note, createdAt: now, activeFrom: now, author: this.s.user?.name ?? "—", source };
    list.push(row);
    this.push(this.cloud?.saveStrategyVersion(sectionId, row));
    if (source === "manual") this.audit("ac.strategy", { v, s: sectionId });
    this.commit();
    return v;
  }
  rollback(sectionId: string, version: number) {
    const old = this.s.versions[sectionId].find((x) => x.version === version);
    if (!old) return;
    const v = this.saveStrategy(sectionId, old.doc, `↺ v${version}`, "rollback");
    this.audit("ac.rollback", { from: version, v, s: sectionId });
    this.toast(this.t("st.rolledBack", { v: version, n: v }));
    this.commit();
  }

  // ---------- overrides ----------
  setOverride(sectionId: string, actuator: ActuatorKey, value: number, minutes: number) {
    const now = this.simNow();
    for (const o of this.s.overrides)
      if (o.sectionId === sectionId && o.actuator === actuator && o.until > now && o.cancelledAt === undefined) o.cancelledAt = now;
    const row: Override = { id: uid(), sectionId, actuator, value, from: now, until: now + minutes * 60000, by: this.s.user?.name ?? "—" };
    this.s.overrides.push(row);
    this.s.overrides = this.s.overrides.filter((o) => o.until > now - 72 * 3600000);
    this.push(this.cloud?.setOverride(row));
    this.audit("ac.override", { a: actuator, v: Math.round(value), s: sectionId, d: minutes });
    this.commit();
  }
  cancelOverride(sectionId: string, actuator: ActuatorKey) {
    const now = this.simNow();
    for (const o of this.s.overrides)
      if (o.sectionId === sectionId && o.actuator === actuator && o.until > now && o.cancelledAt === undefined) o.cancelledAt = now;
    this.push(this.cloud?.cancelOverride(sectionId, actuator));
    this.audit("ac.overrideEnd", { a: actuator, s: sectionId });
    this.commit();
  }
  activeOverrides() {
    const now = this.simNow();
    return this.s.overrides.filter((o) => o.from <= now && now < o.until && o.cancelledAt === undefined);
  }

  // ---------- alarms ----------
  alarmUser(id: string): AlarmUserState {
    return this.s.alarmState[id] ?? {};
  }
  activeAlarms(): Alarm[] {
    return (this.twin?.alarms ?? []).filter((a) => a.clearedAt === undefined).slice().reverse();
  }
  unhandledAlarms(): Alarm[] {
    const now = this.simNow();
    return this.activeAlarms().filter((a) => {
      const u = this.alarmUser(a.id);
      return !u.ackAt && !(u.snoozedUntil && u.snoozedUntil > now);
    });
  }
  ack(a: Alarm) {
    this.s.alarmState[a.id] = { ...this.alarmUser(a.id), ackAt: this.simNow(), ackBy: this.s.user?.name ?? "—" };
    this.audit("ac.ack", { r: a.ruleName, s: a.sectionId });
    this.commit();
  }
  snooze(a: Alarm, until: number) {
    this.s.alarmState[a.id] = { ...this.alarmUser(a.id), snoozedUntil: until };
    this.audit("ac.snooze", { r: a.ruleName, s: a.sectionId });
    this.commit();
  }
  saveRule(r: AlarmRule) {
    const i = this.s.rules.findIndex((x) => x.id === r.id);
    const row = i >= 0 ? r : { ...r, id: uid() };
    if (i >= 0) this.s.rules[i] = row;
    else this.s.rules.push(row);
    this.push(this.cloud?.saveRule(row));
    this.audit("ac.rule", { r: r.name });
    this.commit();
  }
  deleteRule(id: string) {
    const r = this.s.rules.find((x) => x.id === id);
    this.s.rules = this.s.rules.filter((x) => x.id !== id);
    this.push(this.cloud?.deleteRule(id));
    if (r) this.audit("ac.ruleDelete", { r: r.name });
    this.commit();
  }

  // ---------- recipes ----------
  saveRecipe(r: Omit<Recipe, "id" | "createdAt" | "author">) {
    const row: Recipe = { ...r, id: uid(), createdAt: this.simNow(), author: this.s.user?.name ?? "—" };
    this.s.recipes.unshift(row);
    this.push(this.cloud?.saveRecipe(row));
    this.audit("ac.recipeSave", { r: r.name });
    this.commit();
  }
  deleteRecipe(id: string) {
    const r = this.s.recipes.find((x) => x.id === id);
    this.s.recipes = this.s.recipes.filter((x) => x.id !== id);
    this.push(this.cloud?.deleteRecipe(id));
    if (r) this.audit("ac.recipeDelete", { r: r.name });
    this.commit();
  }
  applyRecipe(id: string, sectionIds: string[]) {
    const r = this.s.recipes.find((x) => x.id === id);
    if (!r) return;
    for (const sid of sectionIds) {
      this.saveStrategy(sid, r.doc, `📖 ${r.name}`, "recipe");
      this.audit("ac.recipe", { r: r.name, s: sid });
    }
    this.toast(this.t("rc.applied", { n: sectionIds.length }));
    this.commit();
  }

  // ---------- irrigation ----------
  setIrrigation(sectionId: string, s: IrrigationSettings) {
    this.s.irrigation[sectionId] = s;
    this.push(this.cloud?.setIrrigation(sectionId, s));
    this.audit("ac.irrigation", { s: sectionId });
    this.commit();
  }
  irrigateNow(sectionId: string) {
    this.twin?.startIrrigation(sectionId, this.s.irrigation[sectionId].doseMl);
    this.audit("ac.irrStart", { s: sectionId });
    this.toast(this.t("wa.started", { s: this.sectionName(sectionId) }));
    this.commit();
  }

  // ---------- graph views ----------
  saveView(v: Omit<GraphView, "id">) {
    const row = { ...v, id: uid() };
    this.s.views.push(row);
    this.push(this.cloud?.saveView(row));
    this.commit();
  }
  deleteView(id: string) {
    this.s.views = this.s.views.filter((v) => v.id !== id);
    this.push(this.cloud?.deleteView(id));
    this.commit();
  }

  reset() {
    if (this.mode === "cloud") return; // cloud data is managed in Supabase, not reset from here
    const user = this.s.user;
    const lang = this.s.lang;
    const theme = this.s.theme;
    this.s = { ...fresh(), user, lang, theme };
    this.persist();
    location.reload();
  }
}

export const store = new Store();

/** Subscribe to the store; re-renders on every tick and every change. */
export function useStore() {
  useSyncExternalStore(store.subscribe, store.getRev, () => 0);
  return store;
}

export function useT() {
  const s = useStore();
  return useCallback((key: string, params?: Record<string, string | number>) => translate(s.s.lang, key, params), [s.s.lang]);
}
