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
supabase/     migrations (schema + RLS) and a local RLS test suite
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
npm run test:map                       # row<->domain mapper round-trips
npm run test:rls                       # schema + RLS on a throwaway local Postgres
```

Sign in with any email (demo). Use the 1× / 60× / 600× control in the top bar to fast-forward the simulated day.

## Two modes

Manakh runs with or without a backend:

- **Demo mode** (default, no env needed): the digital twin runs in the browser; data lives in `localStorage`. This is what the screenshots and the e2e suite use.
- **Cloud mode** (set the Supabase env vars): real email/password auth, and all authored data — strategies & versions, recipes, alarm rules, overrides, irrigation, graph views, the audit log — persists to Postgres with per-org row-level security. Live readings still come from the twin until the edge controller (phase 3) is connected.

The app picks the mode from the environment (`src/lib/config.ts`); the same UI and control engine serve both.

### Turn on cloud mode

```bash
cp .env.example .env.local        # then fill in the two values
# create a Supabase project, then apply the schema:
supabase link --project-ref <ref>
supabase db push                  # applies supabase/migrations/*.sql
# Auth → Providers → Email: enable it (disable "Confirm email" for a quick demo)
```

`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` switch the app into cloud mode on the next start.

### Security model

Authorization is by the `memberships` table (never by user metadata). Roles: **owner / grower / operator / viewer**. RLS enforces:
- org isolation — a member sees only their own org's rows;
- owners/growers edit strategies, recipes, alarm rules, irrigation;
- operators and up create manual overrides; viewers are read-only;
- graph views are private to each user.

The one privileged step, `bootstrap_org` (creating the first org + owner membership), is a guarded `SECURITY DEFINER` function; everything else goes through RLS. All 27 policies are verified against a real Postgres in `supabase/test/` — run `npm run test:rls` (needs a local Postgres). The row⇄domain mappers have a round-trip test: `npm run test:map`.

## Roadmap

1. **Done:** UI + control engine + digital twin (demo mode).
2. **Done:** Supabase auth, roles, RLS, Postgres persistence (`supabase/migrations/`), cloud mode. *Verified: schema + RLS on real Postgres, mapper round-trips, typecheck, build, demo e2e. Not yet exercised against a live hosted project in this session.*
3. **Next:** edge service on site (Node + SQLite buffer), Modbus/MQTT adapters, sync, alarm notifications (SMS/WhatsApp/push), realtime multi-device sync.
