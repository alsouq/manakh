// Pure row <-> domain mappers. Isolated from any Supabase I/O so they can be unit-tested
// (a round-trip test guards against field-name / type drift between the app and the schema).
import type { ActuatorKey, Strategy } from "@/engine/types";
import type { AlarmRule, IrrigationSettings, Recipe } from "@/sim/seed";
import type { Override, StrategyVersion } from "@/sim/twin";
import type { GraphView } from "@/lib/store";

const ms = (iso: string) => new Date(iso).getTime();
const iso = (t: number) => new Date(t).toISOString();

// ---- strategy versions ----
export interface StrategyInsert {
  id: string;
  org_id: string;
  section_id: string;
  version: number;
  doc: Strategy;
  note: string;
  source: StrategyVersion["source"];
  author_name: string;
  is_active: boolean;
}
export function strategyToRow(orgId: string, sectionId: string, v: StrategyVersion): StrategyInsert {
  return { id: v.id!, org_id: orgId, section_id: sectionId, version: v.version, doc: v.doc, note: v.note, source: v.source, author_name: v.author, is_active: true };
}
export function rowToStrategy(r: Record<string, unknown>): StrategyVersion {
  const t = ms(r.created_at as string);
  return { id: r.id as string, version: r.version as number, doc: r.doc as Strategy, note: (r.note as string) ?? "", createdAt: t, activeFrom: t, author: (r.author_name as string) ?? "—", source: r.source as StrategyVersion["source"] };
}

// ---- recipes ----
export function recipeToRow(orgId: string, r: Recipe) {
  return { id: r.id, org_id: orgId, name: r.name, crop: r.crop, stage: r.stage, note: r.note, doc: r.doc, built_in: !!r.builtIn, author_name: r.author };
}
export function rowToRecipe(r: Record<string, unknown>): Recipe {
  return { id: r.id as string, name: r.name as string, crop: (r.crop as string) ?? "", stage: (r.stage as string) ?? "", note: (r.note as string) ?? "", doc: r.doc as Strategy, createdAt: ms(r.created_at as string), author: (r.author_name as string) ?? "—", builtIn: r.built_in as boolean };
}

// ---- alarm rules (section scope is kept client-side as 'all' | sectionId) ----
export function ruleToRow(orgId: string, r: AlarmRule) {
  return { id: r.id, org_id: orgId, section_id: null, scope: r.sectionId, name: r.name, variable: r.variable, condition: r.condition, threshold: r.threshold, hysteresis: r.hysteresis, delay_min: r.delayMin, active_from: r.activeFrom, active_to: r.activeTo, priority: r.priority, enabled: r.enabled };
}
export function rowToRule(r: Record<string, unknown>): AlarmRule {
  return { id: r.id as string, name: (r.name as string) ?? "", sectionId: (r.scope as string) ?? "all", variable: r.variable as AlarmRule["variable"], condition: r.condition as AlarmRule["condition"], threshold: r.threshold as number, hysteresis: r.hysteresis as number, delayMin: r.delay_min as number, activeFrom: (r.active_from as string) ?? "", activeTo: (r.active_to as string) ?? "", priority: r.priority as AlarmRule["priority"], enabled: r.enabled as boolean };
}

// ---- overrides ----
export function overrideToRow(orgId: string, sectionId: string, o: Override) {
  return { id: o.id, org_id: orgId, section_id: sectionId, actuator: o.actuator, value: o.value, from_at: iso(o.from), until_at: iso(o.until), by_name: o.by };
}
export function rowToOverride(r: Record<string, unknown>, localSectionId: string): Override {
  return { id: r.id as string, sectionId: localSectionId, actuator: r.actuator as ActuatorKey, value: r.value as number, from: ms(r.from_at as string), until: ms(r.until_at as string), by: (r.by_name as string) ?? "—", cancelledAt: r.cancelled_at ? ms(r.cancelled_at as string) : undefined };
}

// ---- irrigation ----
export function rowToIrrigation(r: Record<string, unknown>): IrrigationSettings {
  return r.settings as IrrigationSettings;
}

// ---- graph views ----
export function viewToRow(orgId: string, userId: string, v: GraphView) {
  return { id: v.id, org_id: orgId, user_id: userId, name: v.name, series: v.series, range_h: v.rangeH };
}
export function rowToView(r: Record<string, unknown>): GraphView {
  return { id: r.id as string, name: r.name as string, series: r.series as string[], rangeH: r.range_h as number };
}

// ---- audit ----
export function rowToAudit(r: Record<string, unknown>) {
  return { id: r.id as string, t: ms(r.created_at as string), user: (r.user_name as string) ?? "—", code: r.code as string, params: (r.params as Record<string, string | number>) ?? {} };
}
