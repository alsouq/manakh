import * as m from "../src/lib/supabase/map";
import { tomatoStrategy, DEFAULT_RULES } from "../src/sim/seed";

let fails = 0;
const eq = (a: unknown, b: unknown, msg: string) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) { fails++; console.log("   a=", JSON.stringify(a), "\n   b=", JSON.stringify(b)); }
};
const ORG = "org-1", SEC = "sec-uuid", CREATED = "2026-01-02T03:04:05.000Z";

// strategy version
const sv = { id: "v-1", version: 3, doc: tomatoStrategy(), note: "warmer", createdAt: 0, activeFrom: 0, author: "Ahmed", source: "manual" as const };
const svRow = { ...m.strategyToRow(ORG, SEC, sv), created_at: CREATED };
const sv2 = m.rowToStrategy(svRow);
eq([sv.id, sv.version, sv.note, sv.author, sv.source], [sv2.id, sv2.version, sv2.note, sv2.author, sv2.source], "strategy fields round-trip");
eq(sv2.createdAt, new Date(CREATED).getTime(), "strategy createdAt from created_at");
eq(svRow.section_id, SEC, "strategy section_id set");
eq(JSON.stringify(sv.doc), JSON.stringify(sv2.doc), "strategy doc preserved");

// recipe
const rc = { id: "rc-1", name: "Tom winter", crop: "Tomato", stage: "Prod", note: "n", doc: tomatoStrategy(), createdAt: 0, author: "Manakh", builtIn: true };
const rc2 = m.rowToRecipe({ ...m.recipeToRow(ORG, rc), created_at: CREATED });
eq([rc.id, rc.name, rc.crop, rc.stage, rc.note, rc.builtIn, rc.author], [rc2.id, rc2.name, rc2.crop, rc2.stage, rc2.note, rc2.builtIn, rc2.author], "recipe round-trip");

// alarm rule (scope <-> sectionId, delayMin <-> delay_min, activeFrom <-> active_from)
const ar = { ...DEFAULT_RULES[0], id: "r-1", sectionId: "all", activeFrom: "22:00", activeTo: "06:00" };
const arRow = m.ruleToRow(ORG, ar);
eq(arRow.scope, "all", "rule scope = sectionId");
eq(arRow.delay_min, ar.delayMin, "rule delay_min = delayMin");
eq(arRow.active_from, "22:00", "rule active_from = activeFrom");
const ar2 = m.rowToRule(arRow as unknown as Record<string, unknown>);
eq(JSON.stringify(ar), JSON.stringify(ar2), "rule full round-trip");

// override (ms <-> iso, by <-> by_name)
const ov = { id: "o-1", sectionId: "a", actuator: "ventLee" as const, value: 60, from: Date.parse("2026-01-02T00:00:00.000Z"), until: Date.parse("2026-01-02T02:00:00.000Z"), by: "Sara" };
const ovRow = m.overrideToRow(ORG, SEC, ov);
eq(ovRow.by_name, "Sara", "override by_name = by");
eq(ovRow.until_at, "2026-01-02T02:00:00.000Z", "override until_at iso");
const ov2 = m.rowToOverride({ ...ovRow, cancelled_at: null }, "a");
eq([ov.id, ov.sectionId, ov.actuator, ov.value, ov.from, ov.until, ov.by], [ov2.id, ov2.sectionId, ov2.actuator, ov2.value, ov2.from, ov2.until, ov2.by], "override round-trip");

// graph view (rangeH <-> range_h)
const gv = { id: "g-1", name: "Climate", series: ["a:temp", "out:outTemp"], rangeH: 48 };
const gvRow = m.viewToRow(ORG, "user-1", gv);
eq(gvRow.range_h, 48, "view range_h = rangeH");
eq(JSON.stringify(gv), JSON.stringify(m.rowToView(gvRow as unknown as Record<string, unknown>)), "view round-trip");

// audit
const auRow = { id: "au-1", created_at: CREATED, user_name: "Ahmed", code: "ac.login", params: { s: "a" } };
eq(m.rowToAudit(auRow).t, new Date(CREATED).getTime(), "audit t from created_at");

console.log(fails ? `\n${fails} FAILED` : "\nALL MAPPER TESTS PASSED");
process.exit(fails ? 1 : 0);
