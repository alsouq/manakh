# Architecture: Manakh (working name), a greenhouse process computer

Working name **Manakh / مناخ** ("climate"). One constant to rename (`src/lib/brand.ts`).

## Stack

| layer | choice | why |
| --- | --- | --- |
| web app | Next.js 15 App Router + TypeScript | one codebase for desktop and phone browser, deploys anywhere |
| styling | Tailwind CSS v4 + CSS variable tokens | light/dark and RTL with logical properties |
| charts | uPlot | 100k points without lag; graphs are the product |
| control engine | `src/engine/*`, pure TypeScript, no I/O | the SAME code runs on the edge box, in the cloud and in the browser preview |
| digital twin | `src/sim/*` greenhouse + weather physics | lets us build and demo without hardware, and run "what if" |
| database (phase 2) | Postgres on Supabase | one database; auth, RLS and realtime included |
| time series (phase 2) | `readings` table partitioned by month + BRIN index | no extra database; enough for 100s of sensors at 1 min |
| auth (phase 2) | Supabase Auth, email + magic link | roles in our own table |
| edge (phase 3) | Node 22 service on an industrial PC / Pi CM4, SQLite buffer | control keeps running with the internet down |
| hardware I/O (phase 3) | adapters: Modbus TCP/RTU, MQTT, simulated | open protocols, no vendor lock-in |
| jobs | edge loop every 10 s; cloud cron for forecast pull, rollups, alarm digests | |
| hosting | Vercel (web) + Supabase | managed, cheap at zero users |

## The shape (better than the original)

```
           sensors/actuators
                 |
     +-----------v-------------+       +-----------------------------+
     | EDGE (on site)          |  sync | CLOUD                       |
     | io adapters (modbus/mqtt)| <---> | Postgres: strategies, recipes|
     | engine.tick() every 10 s |       | readings, alarms, audit log |
     | local SQLite buffer      |       | forecast puller (GPS)       |
     | local web UI fallback    |       | Next.js UI + API            |
     +--------------------------+       +--------------+--------------+
                                                       |
                                       browser / phone (EN + AR RTL)
                                       engine.preview() runs locally
```

Rules:
1. Control never depends on the cloud. The edge owns the active strategy copy.
2. A strategy is a versioned document. Every change = new version + audit row. Rollback is one click.
3. The engine is pure: `computeSetpoints(strategy, inputs, t) -> { setpoints, breakdown }`.
   `breakdown` lists base value + every influence, so the UI can always answer "why".
4. Preview uses the same engine on a 24 h forecast, so what you see before saving is what the controller will do.
5. Manual overrides carry an expiry (default 2 h). No forgotten manual mode.

## Engine (phase 1, built now)

```
inputs:  outside {temp, rh, radiation, wind, windDir}, sun {elevation, sunrise, sunset},
         inside {temp, rh, co2, par}, forecast
strategy per section:
  periods[1..6]: start {ref: sunrise|sunset|clock, offsetMin}, ramp min,
                 heatingTemp, ventTemp, rhMax, co2Target, lampsAllowed
  ventilation: pBand, minVent, maxVent, windLimit, leeWindSplit
  humidity: mode (rh|hd), rhMax/hdMin, ventIncrease per % over, minPipeOnHumidity
  co2: target, reduce when vents > x%, maxDosingWhenVentsOpen
  screens: energyScreen {closeBelowRadiation, closeBelowOutsideTemp, gapOnHumidity}
           shadeScreen {closeAboveRadiation, maxClose}
  lighting: on/off windows, onBelow, offAbove radiation, target daily light integral
  cooling (our addition): padFan {startAbove temp}, fog {startBelow rh, above temp}
  influences[]: { target: heating|vent|co2, source: radiation|outsideTemp|rh, curve: [[x,y],...] }
outputs: calculated setpoints + actuator positions (pipe temp, vents lee/wind, screens,
         lamps, CO2 valve, fans, pads, fog)
```

## Schema (phase 2)

See `schema.sql`. 14 tables. Access: Supabase RLS on `org_id` via `memberships`.

## API (phase 2)

| method path | what | who | flow |
| --- | --- | --- | --- |
| GET /api/sites/:id/live | latest reading per sensor + actuator state | member | F01 |
| GET /api/readings?sensor=..&from=..&to=..&step=.. | downsampled series | member | F04 |
| GET /api/sections/:id/strategy | active strategy version | member | F02 |
| POST /api/sections/:id/strategy | new version (validated by engine) | grower+ | F02 |
| POST /api/sections/:id/strategy/rollback | activate an older version | grower+ | F02 |
| POST /api/sections/:id/preview | run engine on forecast, return 24 h curves | member | F02 |
| GET/POST /api/recipes, POST /api/recipes/:id/apply | library + apply to sections | grower+ | F03 |
| GET /api/alarms, POST /api/alarms/:id/ack, /snooze | alarm handling | operator+ | F01 |
| GET/POST/PATCH /api/alarm-rules | custom alarms | grower+ | F05 |
| POST /api/actuators/:id/override | manual position + expiry | operator+ | F06 |
| GET /api/audit | change log | member | |
| POST /api/edge/sync | edge pushes readings/alarms, pulls strategy versions (mTLS + device token) | device | all |
| cron hourly /api/cron/forecast | pull forecast by site lat/lon | system | |
| cron 5 min /api/cron/rollups | 5-min and 1-h rollups | system | F04 |

## The parts that bite

- Time zones: periods are relative to local sunrise/sunset; compute sun with site lat/lon, store UTC.
- Clock jumps / DST: engine uses minutes-since-local-midnight from the site tz, never the browser tz.
- Edge offline: readings buffered in SQLite, sync is idempotent by (sensor_id, ts).
- Two growers editing one strategy: optimistic lock on `version`; second save gets a diff.
- Alarm flapping: delay + hysteresis on every rule.
- Safety: hard limits per actuator outside any strategy (max pipe temp, wind limit closes vents).
- Realtime: Supabase Realtime on `live_state`; graph pages poll 30 s.
- Volume: 200 sensors x 1/min = 105M rows/year; monthly partitions + rollups.

## Build order

1. **Vertical slice (now):** engine + digital twin + S02 overview + S03 section with visualization + "why" breakdown.
2. **Must-haves (now):** S05 strategy editor with 24 h preview + diff/confirm + versions, S07 graphs (one-click), S09 alarms, S08 recipes, overrides, language AR/EN, dark mode.
3. **Should-haves (now, lighter):** S10 custom alarm rules, S11 weather/forecast, S12 irrigation, S13 energy, S15 activity log, S16 settings.
4. **Phase 2:** Supabase schema + auth + API, readings persisted.
5. **Phase 3:** edge service + Modbus/MQTT adapters + sync.
