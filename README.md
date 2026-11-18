# Manakh · مناخ

A greenhouse process computer interface, modelled on how climate computers like Hoogendoorn IIVO work, rebuilt from scratch and aimed at hot-climate growers (Egypt, the Gulf). Arabic (RTL) and English.

> واجهة كمبيوتر تحكم للصوب: مناخ وري وطاقة لكل قسم، بالعربي والإنجليزي، مع توأم رقمي للصوبة يخليك تجرب أي تغيير قبل ما تطبقه.

## What is in it

| Area | What it does |
| --- | --- |
| Overview | Every section live: temperature vs setpoints, RH, CO₂, HD, actuators, 24 h sparkline, alarms, manual overrides, gas and water today |
| Section · Live | Animated greenhouse schematic (vents, screens, pipes, lamps, CO₂, pad & fan, fog). Tap anything to see **why** it is doing what it does |
| Section · Strategy | Up to 6 day periods (relative to sunrise, sunset or clock), ventilation, heating, CO₂, screens, lighting, cooling, influence curves. **24 h preview** of draft vs running strategy on the forecast, impact on gas/CO₂/temperatures, diff, validation, versioned save |
| Section · Versions | Every change is a version: compare, roll back, save as recipe |
| Graphs | One panel per unit (no dual axes), synced cursor, compare sections, 6 h to 7 days, saved views, CSV export, one-click graph from any value |
| Alarms | Active / history / rules. Custom rules with delay, hysteresis, active window and priority. Acknowledge and snooze |
| Crop recipes | Library of complete strategies, apply to several sections with a diff |
| Weather | Outside now, past 48 h + 48 h forecast, hourly table |
| Water | Irrigation by light sum, EC/pH, drain, start log, manual start |
| Energy | Boiler, gas, heat per section, electricity, CO₂ dosed |
| Activity | Who changed what, when |

## How it works

```
src/engine/   pure control engine: strategy + measurements -> setpoints, actuator targets, reasons
src/sim/      digital twin: deterministic weather, greenhouse physics, alarms, irrigation, energy
src/lib/      store (persisted in the browser for now), i18n (ar/en), formatting
src/app/      Next.js App Router pages
replica/      research: recon map, feature matrix, architecture, SQL schema
```

The same `control()` function drives the live twin, the 24 h preview and, in phase 3, the on-site edge controller. See `replica/architecture.md`.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run build && npm start -- -p 3001
npm run e2e -- http://localhost:3001   # 18 click-through checks with Playwright
```

Sign in with any email (demo). Use the 1× / 60× / 600× control in the top bar to fast-forward the simulated day.

## Roadmap

1. **Now:** UI + control engine + digital twin, data in the browser.
2. **Phase 2:** Supabase (auth, roles, RLS), strategies/recipes/alarms/readings in Postgres (`replica/schema.sql`), API routes.
3. **Phase 3:** edge service on site (Node + SQLite buffer), Modbus/MQTT adapters, sync, alarm notifications (SMS/WhatsApp/push).
