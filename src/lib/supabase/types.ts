// Hand-written DB row types for the tables the app reads/writes. Mirrors supabase/migrations.
import type { Strategy } from "@/engine/types";
import type { IrrigationSettings } from "@/sim/seed";
import type { Physical } from "@/sim/greenhouse";

export type Role = "owner" | "grower" | "operator" | "viewer";

export interface OrgRow {
  id: string;
  name: string;
}
export interface MembershipRow {
  id: string;
  org_id: string;
  user_id: string;
  role: Role;
  language: "en" | "ar";
}
export interface SiteRow {
  id: string;
  org_id: string;
  name: string;
  name_ar: string | null;
  lat: number;
  lon: number;
  timezone: string;
}
export interface SectionRow {
  id: string;
  org_id: string;
  site_id: string;
  code: string;
  name: string;
  name_ar: string | null;
  crop: string | null;
  crop_ar: string | null;
  area_m2: number | null;
  phys: Physical;
  sort: number;
}
export interface StrategyVersionRow {
  id: string;
  org_id: string;
  section_id: string;
  version: number;
  doc: Strategy;
  note: string | null;
  source: "seed" | "manual" | "recipe" | "rollback";
  author_name: string | null;
  is_active: boolean;
  created_at: string;
}
export interface RecipeRow {
  id: string;
  org_id: string;
  name: string;
  crop: string | null;
  stage: string | null;
  note: string | null;
  doc: Strategy;
  built_in: boolean;
  author_name: string | null;
  created_at: string;
}
export interface AlarmRuleRow {
  id: string;
  org_id: string;
  section_id: string | null;
  scope: string;
  variable: string;
  condition: "above" | "below" | "deviation";
  threshold: number;
  hysteresis: number;
  delay_min: number;
  active_from: string;
  active_to: string;
  priority: "low" | "medium" | "high" | "critical";
  enabled: boolean;
}
export interface OverrideRow {
  id: string;
  org_id: string;
  section_id: string;
  actuator: string;
  value: number;
  from_at: string;
  until_at: string;
  by_name: string | null;
  cancelled_at: string | null;
}
export interface IrrigationRow {
  org_id: string;
  section_id: string;
  settings: IrrigationSettings;
}
export interface GraphViewRow {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  series: string[];
  range_h: number;
}
export interface AuditRow {
  id: string;
  org_id: string;
  user_name: string | null;
  code: string;
  params: Record<string, string | number>;
  created_at: string;
}
