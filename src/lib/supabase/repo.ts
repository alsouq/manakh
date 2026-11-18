"use client";
// Cloud persistence. Runs in the browser with the signed-in user's session, so every
// statement is checked by the RLS policies in supabase/migrations. The 4 sections are a
// fixed app constant (ids a..d); the DB stores them with code A..D, and this repo maps
// between the two. All other entities share UUIDs between local state and the DB.
import { supabaseBrowser } from "./client";
import type { GraphView } from "@/lib/store";
import type { AlarmRule, IrrigationSettings, Recipe } from "@/sim/seed";
import { DEFAULT_IRRIGATION, DEFAULT_STRATEGIES, DEFAULT_RULES, SECTIONS, SITE, defaultRecipes } from "@/sim/seed";
import type { Override, StrategyVersion } from "@/sim/twin";
import type { MembershipRow } from "./types";
import * as m from "./map";

export interface CloudSnapshot {
  orgId: string;
  role: MembershipRow["role"];
  language: "en" | "ar";
  versions: Record<string, StrategyVersion[]>;
  recipes: Recipe[];
  rules: AlarmRule[];
  overrides: Override[];
  irrigation: Record<string, IrrigationSettings>;
  views: GraphView[];
  audit: { id: string; t: number; user: string; code: string; params: Record<string, string | number> }[];
}

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const nowIso = () => new Date().toISOString();

export class SupabaseRepo {
  private sb = supabaseBrowser();
  orgId = "";
  userName = "";
  private localToId: Record<string, string> = {}; // "a" -> uuid
  private idToLocal: Record<string, string> = {}; // uuid -> "a"
  onError: (msg: string) => void = () => {};

  private wrap<T>(p: PromiseLike<{ error: { message: string } | null; data?: T }>) {
    return Promise.resolve(p).then((r) => {
      if (r.error) {
        this.onError(r.error.message);
        throw new Error(r.error.message);
      }
      return r.data as T;
    });
  }

  async currentUser() {
    const { data } = await this.sb.auth.getUser();
    return data.user;
  }
  private db(localId: string) {
    return this.localToId[localId];
  }

  async loadOrBootstrap(lang: "en" | "ar", userName: string): Promise<CloudSnapshot> {
    this.userName = userName;
    this.orgId = (await this.wrap(this.sb.rpc("bootstrap_org", { p_name: SITE.name, p_lang: lang }))) as unknown as string;

    let sections = await this.wrap<{ id: string; code: string }[]>(this.sb.from("sections").select("id, code").eq("org_id", this.orgId));
    if (!sections.length) {
      await this.seed();
      sections = await this.wrap<{ id: string; code: string }[]>(this.sb.from("sections").select("id, code").eq("org_id", this.orgId));
    }
    for (const s of sections) {
      const local = s.code.toLowerCase();
      this.localToId[local] = s.id;
      this.idToLocal[s.id] = local;
    }
    return this.load(lang);
  }

  private async seed() {
    const now = Date.now();
    const site = await this.wrap<{ id: string }[]>(
      this.sb.from("sites").insert({ org_id: this.orgId, name: SITE.name, name_ar: SITE.nameAr, lat: SITE.geo.lat, lon: SITE.geo.lon, timezone: SITE.geo.tz }).select("id"),
    );
    const siteId = site[0].id;
    const sectionRows = SECTIONS.map((d, i) => ({ id: uid(), org_id: this.orgId, site_id: siteId, code: d.code, name: d.name, name_ar: d.nameAr, crop: d.crop, crop_ar: d.cropAr, area_m2: d.area, phys: d.phys, sort: i }));
    await this.wrap(this.sb.from("sections").insert(sectionRows));
    const byLocal: Record<string, string> = {};
    for (const r of sectionRows) byLocal[r.code.toLowerCase()] = r.id;

    const strat = SECTIONS.map((d) => m.strategyToRow(this.orgId, byLocal[d.id], { id: uid(), version: 1, doc: DEFAULT_STRATEGIES[d.id](), note: "", createdAt: now, activeFrom: now, author: "Manakh", source: "seed" }));
    await this.wrap(this.sb.from("strategy_versions").insert(strat));
    await this.wrap(this.sb.from("recipes").insert(defaultRecipes(now).map((r) => m.recipeToRow(this.orgId, { ...r, id: uid() }))));
    await this.wrap(this.sb.from("alarm_rules").insert(DEFAULT_RULES.map((r) => m.ruleToRow(this.orgId, { ...r, id: uid() }))));
    await this.wrap(this.sb.from("irrigation_settings").insert(SECTIONS.map((d) => ({ org_id: this.orgId, section_id: byLocal[d.id], settings: DEFAULT_IRRIGATION[d.id] }))));
  }

  private async load(lang: "en" | "ar"): Promise<CloudSnapshot> {
    const [membership, sv, rec, ru, ov, ir, gv, au] = await Promise.all([
      this.wrap<MembershipRow[]>(this.sb.from("memberships").select("*").eq("org_id", this.orgId)),
      this.wrap<Record<string, unknown>[]>(this.sb.from("strategy_versions").select("*").eq("org_id", this.orgId).order("version")),
      this.wrap<Record<string, unknown>[]>(this.sb.from("recipes").select("*").eq("org_id", this.orgId).order("created_at")),
      this.wrap<Record<string, unknown>[]>(this.sb.from("alarm_rules").select("*").eq("org_id", this.orgId)),
      this.wrap<Record<string, unknown>[]>(this.sb.from("overrides").select("*").eq("org_id", this.orgId).is("cancelled_at", null).gt("until_at", nowIso())),
      this.wrap<Record<string, unknown>[]>(this.sb.from("irrigation_settings").select("*").eq("org_id", this.orgId)),
      this.wrap<Record<string, unknown>[]>(this.sb.from("graph_views").select("*").eq("org_id", this.orgId)),
      this.wrap<Record<string, unknown>[]>(this.sb.from("audit_log").select("*").eq("org_id", this.orgId).order("created_at", { ascending: false }).limit(200)),
    ]);
    const uidNow = (await this.currentUser())?.id;
    const mine = membership.find((x) => x.user_id === uidNow);
    const role = (mine?.role ?? "owner") as MembershipRow["role"];

    const versions: Record<string, StrategyVersion[]> = {};
    for (const d of SECTIONS) versions[d.id] = [];
    for (const r of sv) {
      const local = this.idToLocal[r.section_id as string];
      if (local) versions[local].push(m.rowToStrategy(r));
    }
    for (const d of SECTIONS) versions[d.id].sort((a, b) => a.version - b.version);

    const irrigation: Record<string, IrrigationSettings> = JSON.parse(JSON.stringify(DEFAULT_IRRIGATION));
    for (const r of ir) {
      const local = this.idToLocal[r.section_id as string];
      if (local) irrigation[local] = m.rowToIrrigation(r);
    }

    return {
      orgId: this.orgId,
      role,
      language: mine?.language ?? lang,
      versions,
      recipes: rec.map(m.rowToRecipe),
      rules: ru.map(m.rowToRule),
      overrides: ov.map((r) => m.rowToOverride(r, this.idToLocal[r.section_id as string])).filter((o) => o.sectionId),
      irrigation,
      views: gv.map(m.rowToView),
      audit: au.map(m.rowToAudit),
    };
  }

  // ---------- writes ----------
  async saveStrategyVersion(localSectionId: string, v: StrategyVersion) {
    const section = this.db(localSectionId);
    await this.wrap(this.sb.from("strategy_versions").update({ is_active: false }).eq("section_id", section).eq("is_active", true));
    await this.wrap(this.sb.from("strategy_versions").insert(m.strategyToRow(this.orgId, section, v)));
  }
  async saveRecipe(r: Recipe) {
    await this.wrap(this.sb.from("recipes").insert(m.recipeToRow(this.orgId, r)));
  }
  async deleteRecipe(id: string) {
    await this.wrap(this.sb.from("recipes").delete().eq("id", id));
  }
  async saveRule(r: AlarmRule) {
    await this.wrap(this.sb.from("alarm_rules").upsert(m.ruleToRow(this.orgId, r)));
  }
  async deleteRule(id: string) {
    await this.wrap(this.sb.from("alarm_rules").delete().eq("id", id));
  }
  async setOverride(o: Override) {
    const section = this.db(o.sectionId);
    await this.wrap(this.sb.from("overrides").update({ cancelled_at: nowIso() }).eq("section_id", section).eq("actuator", o.actuator).is("cancelled_at", null).gt("until_at", nowIso()));
    await this.wrap(this.sb.from("overrides").insert(m.overrideToRow(this.orgId, section, o)));
  }
  async cancelOverride(localSectionId: string, actuator: string) {
    await this.wrap(this.sb.from("overrides").update({ cancelled_at: nowIso() }).eq("section_id", this.db(localSectionId)).eq("actuator", actuator).is("cancelled_at", null).gt("until_at", nowIso()));
  }
  async setIrrigation(localSectionId: string, s: IrrigationSettings) {
    await this.wrap(this.sb.from("irrigation_settings").upsert({ org_id: this.orgId, section_id: this.db(localSectionId), settings: s }));
  }
  async saveView(v: GraphView) {
    const user = await this.currentUser();
    await this.wrap(this.sb.from("graph_views").insert(m.viewToRow(this.orgId, user!.id, v)));
  }
  async deleteView(id: string) {
    await this.wrap(this.sb.from("graph_views").delete().eq("id", id));
  }
  async appendAudit(id: string, code: string, params: Record<string, string | number>) {
    const user = await this.currentUser();
    await this.wrap(this.sb.from("audit_log").insert({ id, org_id: this.orgId, user_id: user?.id, user_name: this.userName, code, params }));
  }
  async setLanguage(lang: "en" | "ar") {
    const user = await this.currentUser();
    if (user) await this.wrap(this.sb.from("memberships").update({ language: lang }).eq("org_id", this.orgId).eq("user_id", user.id));
  }
  async signOut() {
    await this.sb.auth.signOut();
  }
}
