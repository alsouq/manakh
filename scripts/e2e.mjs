// End-to-end click-through of the main flows. Usage: node scripts/e2e.mjs [baseUrl] [screenshotDir]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = process.argv[2] || "http://localhost:3000";
const shots = process.argv[3] || ".";
let failures = 0;
const seen = async (loc, ms = 8000) => {
  try {
    await loc.first().waitFor({ timeout: ms });
    return true;
  } catch {
    return false;
  }
};
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// F00 login (Arabic by default), then switch to English
await p.goto(base + "/");
await p.waitForURL(/\/login/);
ok((await p.getAttribute("html", "dir")) === "rtl", "default UI is Arabic RTL");
await p.fill("input[type=email]", "qa@example.com");
await p.fill("input[autocomplete=name]", "QA");
await p.click("button[type=submit]");
await p.waitForURL(base + "/");
await p.getByRole("button", { name: "English" }).click();
await p.waitForTimeout(300);
ok((await p.getAttribute("html", "dir")) === "ltr", "language switch to English sets LTR");

// F01 overview
await p.getByRole("heading", { name: "Overview" }).waitFor();
ok((await p.locator('a[href^="/sections/"]').count()) >= 4, "overview lists the four sections");

// F02 change strategy with preview, save as v2
await p.goto(base + "/sections/a/strategy");
await p.getByText("Preview next 24 h").waitFor();
await p.locator('[data-testid="p4-heat"]').fill("18");
await p.waitForTimeout(1500);
ok(await p.getByText("Heating °C").first().isVisible(), "changes list shows the edited field");
ok(await seen(p.locator("text=/\\+\\d+%\\)/")), "preview shows a % impact for the draft (more gas for a warmer night)");
await p.getByPlaceholder("What did you change and why?").fill("QA warmer day");
await p.getByRole("button", { name: /Save as version 2/ }).click();
await p.getByText("Strategy v2 is now active").waitFor();
ok(true, "strategy saved as v2 with toast");
await p.goto(base + "/sections/a/versions");
ok(await seen(p.getByText("QA warmer day")), "version list shows v2 with its note");

// F02b invalid strategy blocks save
await p.goto(base + "/sections/a/strategy");
await p.locator('[data-testid="p1-vent"]').fill("10");
await p.waitForTimeout(300);
ok(await p.getByText("Fix before saving").isVisible(), "validation shows problems");
ok(await p.getByRole("button", { name: /Save as version/ }).isDisabled(), "save is disabled while invalid");
await p.getByRole("button", { name: "Discard" }).click();

// F03 apply recipe to section C
await p.goto(base + "/recipes");
await p.getByRole("button", { name: "Apply to sections" }).first().click();
await p.getByRole("dialog").getByText("C · Sweet pepper").click();
await p.getByRole("dialog").getByRole("button", { name: "Apply" }).click();
await p.getByText("Recipe applied to 1 section(s)").waitFor();
ok(true, "recipe applied with toast");
await p.goto(base + "/sections/c/versions");
ok(await seen(p.getByText("v2", { exact: true })), "section C has a v2 from the recipe");

// F06 manual override on vents
await p.goto(base + "/sections/a");
await p.locator("li button", { hasText: "Vents lee side" }).click();
await p.getByRole("button", { name: "Manual", exact: true }).click();
await p.getByRole("dialog").locator('input[type="range"]').fill("60");
await p.getByRole("dialog").getByRole("button", { name: "Apply" }).click();
await p.waitForTimeout(1500);
ok(await seen(p.getByText(/Manual until/)), "override shows 'Manual until'");
await p.screenshot({ path: `${shots}/e2e-override.png`, fullPage: false });

// F05 custom alarm rule fires and can be acknowledged
await p.goto(base + "/alarms");
await p.getByRole("button", { name: /Rules/ }).click();
await p.getByRole("button", { name: "New rule" }).click();
const dlg = p.getByRole("dialog");
await dlg.locator("input").first().fill("QA always on");
await dlg.locator('input[type="number"]').first().fill("5");
await dlg.locator('input[type="number"]').nth(2).fill("0");
await dlg.getByRole("button", { name: "Save" }).click();
await p.getByRole("button", { name: "600×" }).click();
await p.waitForTimeout(3500);
await p.getByRole("button", { name: "1×" }).click();
await p.getByRole("button", { name: /Active \(/ }).click();
ok(await seen(p.getByText("QA always on")), "custom rule raised an alarm");
await p.getByRole("button", { name: "Acknowledge" }).first().click();
ok(await seen(p.getByText(/Acknowledged by QA/)), "alarm acknowledged by user");

// F04 one-click graph from a value
await p.goto(base + "/sections/a");
await p.getByRole("link", { name: /Relative humidity/ }).first().click();
await p.waitForURL(/\/graphs\?s=a:rh/);
ok(true, "one-click graph opens graphs with that series");

// activity log has the changes
await p.goto(base + "/activity");
await seen(p.locator("ol li"));
const act = await p.locator("ol li").count();
ok(act >= 4, `activity log recorded changes (${act})`);

// dark mode + mobile
await p.getByRole("button", { name: "Theme" }).click();
await p.goto(base + "/");
await p.waitForTimeout(1200);
await p.screenshot({ path: `${shots}/e2e-dark-en.png`, fullPage: true });
const m = await b.newContext({ ...require("playwright").devices["iPhone 13"] });
await m.addInitScript((s) => localStorage.setItem("manakh:v2", s), await p.evaluate(() => localStorage.getItem("manakh:v2")));
const mp = await m.newPage();
await mp.goto(base + "/sections/a");
await mp.waitForTimeout(2500);
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok(overflow <= 1, `no horizontal scroll on phone (${overflow}px)`);
await mp.screenshot({ path: `${shots}/e2e-mobile-section.png`, fullPage: false });

ok(errors.length === 0, `no console/page errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
await b.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
