# Recon map: Hoogendoorn IIVO (web, browser + mobile browser)

Scope: the IIVO grower loop. Watch every greenhouse section live, understand why the
computer does what it does, change the strategy safely, read graphs, handle alarms,
reuse crop recipes. Climate first, then water (irrigation) and energy.
For: a greenhouse operator / agri-tech business (working assumption: Egypt and the
Middle East, Arabic + English, hot climate with cooling, not only Dutch heating).
Date: 2026-11-18

## What was reachable

- `https://online.hoogendoorn.com` is **not** IIVO itself. It redirects to `/login` and
  is "Hoogendoorn Online, Central knowledge hub for support & learning": a Laravel-style
  portal (email + password, forgot password, create account, 6 languages EN NL ES ZH DE FR,
  feedback button). Everything behind it needs a customer account. Screenshot:
  `screens/ref-01-login.png`.
- IIVO itself runs on the grower's process computer and is reached through IIVO Remote
  in a browser. There is no public demo. So the screens below are **inferred** from
  public descriptions, grower interviews and how this class of climate computer works.
  Every row says how sure we are.
- Automated reads of hoogendoorn.com, hike.one and the brochure PDFs were blocked in
  this session. Findings come from search result extracts of those pages.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Hoogendoorn Online login (seen live) | https://online.hoogendoorn.com/login | support & learning portal, not the controller |
| 2 | IIVO product page | https://hoogendoorn.com/en/our-solutions/iivo | climate, water, energy in one UI |
| 3 | Introducing IIVO | https://hoogendoorn.com/en/projects/introducing-iivo | built from scratch, Plant Empowerment, launched Oct 2020 as iSii successor |
| 4 | Product brochure 2023 | https://www.tomatoworld.nl/media/2323/hgm-iivo-productbrochure-2023-en-230117-preview.pdf | UI "organised around crop sections, installations and technical rooms", graphs |
| 5 | Brochure IA update 2024 | https://tomatoworld.nl/media/xy5dpm1d/hgm-iivo-productbrochure-ia_update_2024-digital-d1.pdf | Intelligent Algorithms, sensor + forecast + plant models |
| 6 | Hike One UI case study | https://hike.one/work/hoogendoorn-climate-management-ui | redesign of iSii, "too complex", new back end, components, style guide, usability tests |
| 7 | Release 7.0 news | https://www.hortidaily.com/article/9793832/cultivation-management-iivo-release-7-0-launches | one-click graphs, graph window settings, lighting strategy, light/dark strategy |
| 8 | "Library of settings" | https://www.hortidaily.com/article/9377230/newest-climate-computer-helps-grower-build-library-of-settings/ | crop recipes = saved groups of settings |
| 9 | Elstgeest Potplanten | https://hoogendoorn.com/en/projects/elstgeest-potplanten-sustainable-market-oriented-and-year-round-cultivation-of-potted-plants | "4 or 5 influences at once", easy recipe switching |
| 10 | Elstgeest Young Plants | https://hoogendoorn.com/en/projects/elstgeest-young-plants | IIVO Remote, dashboard from any device |
| 11 | Weather Forecast feature | https://hoogendoorn.com/en/projects/weather-forecast | GPS-based forecast feeds control |
| 12 | Custom alarms (iSii era) | https://www.hortidaily.com/article/6020098/hoogendoorn-introduces-customized-alarms-in-process-computer/ | own conditions, periods, snooze, night silence |
| 13 | Alarm routing | https://www.hortidaily.com/article/6029194/handle-and-register-isii-alarms-from-multiple-locations-and-systems | priority, rosters, holidays |
| 14 | Intelligent Algorithms | https://hoogendoorn.com/en/our-solutions/intelligent-algorithms | autonomous micro-adjustment from grower settings + forecast |
| 15 | Hoogendoorn 360 | https://hoogendoorn.com/en/360 | IIVO + LetsGrow.com + IA + AI assistant, one ecosystem |
| 16 | Grodan integration | https://www.hortidaily.com/article/9754110/new-partnership-announced-to-integrate-rootzone-data-into-iivo-climate-computer | root-zone sensor data into IIVO |
| 17 | Dealer page | https://adeptag.com/?p=305 | sensor list: temp, RH, CO2, PAR, wind, radiation, plant temp; Aquabalance |
| 18 | Vent strategy doc (unverified origin) | https://www.scribd.com/document/663660655/I125-Vent-Strategy | P-band, lee/wind side, up to 6 periods |

## Core loop

The grower sets a day strategy per section (periods, temperatures, humidity, CO2,
screens, light), the computer turns it into calculated setpoints every minute using
influences (light, humidity, outside temperature, forecast), drives the actuators, and
the grower checks graphs and alarms, then nudges the strategy.

## What users praise and what hurts (from the sources)

- Praise: clear dashboard, graphs, remote access from a phone in the greenhouse,
  recipes, combining several influences at once, remote updates.
- Pain the redesign itself admits: the old system "proved too complex"; the UI must
  serve both expert growers and less technical newcomers.
- Gaps we can exploit: no public demo, no explanation layer of *why* a setpoint is
  what it is (inferred), Dutch/heating-centric (cooling, pad-and-fan and fogging matter
  more in hot climates), no Arabic/RTL, alarms routed by add-on modules.

## Screens (inferred unless marked)

| ID | screen | route / how to reach | purpose | key components | states | confidence |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | Login | `/login` | sign in, language | email, password, forgot, language switch | empty, error | high (seen on Online portal) |
| S02 | Overview / dashboard | home | all sections + outside at a glance | site map, section tiles, outside weather tile, alarm badge | normal, alarm, offline | high |
| S03 | Section (crop section) | tap a section | live climate of one compartment | value list, visualization panel, mini graphs | normal, actuator manual, sensor fault | high |
| S04 | Visualization panel | inside S03 | see installations working: vents, screens, pipes, lamps, CO2 | greenhouse schematic, % labels | animated, manual override | medium |
| S05 | Settings / strategy | section > settings | periods and setpoints for heating, vents, humidity, CO2, screens, light | period table, numeric inputs, influence curves | draft, saved, invalid | high |
| S06 | Influences | inside S05 | how light / RH / outside temp shift a setpoint | influence curve editor (x/y points) | on, off | high ("4 or 5 influences at once") |
| S07 | Graphs | menu > graphs | trend lines, compare sections, one-click graph from any value | chart, series picker, time range, graph window settings | empty, loading, filled | high (release 7.0) |
| S08 | Crop recipes library | menu > recipes | save, load and switch groups of settings | recipe list, apply dialog | empty, filled | high |
| S09 | Alarms | bell / menu | active and past alarms, acknowledge, snooze | alarm list, priority chips | none, active, acknowledged | high |
| S10 | Custom alarm editor | alarms > new | own conditions, period, priority, recipients | rule form | draft, invalid | medium |
| S11 | Weather & forecast | outside tile | outside now + forecast used by control | forecast chart | normal, offline | high |
| S12 | Irrigation (water) | menu > water | valves, groups, starts, EC/pH, drain | valve table, start log | idle, dosing, alarm | medium |
| S13 | Energy | menu > energy | boiler, buffer, CHP, heat demand, gas use | installation tiles, usage graph | normal, alarm | medium |
| S14 | Technical rooms / installations | menu | equipment status, manual control | installation list, manual switch | auto, manual, fault | medium |
| S15 | Activity / change log | menu | who changed what when | timeline | empty, filled | guess |
| S16 | User & system settings | menu | users, rights, units, language | forms | n/a | medium |

## Flows

```
F01 Morning check (the most frequent flow)
    S01 -> S02 -> S09 (ack alarms) -> S03 -> S07
    happy path clicks: 4-6
    edge: section offline, sensor fault shows impossible value, alarm during night silence

F02 Change a section's strategy
    S03 -> S05 -> edit period/setpoint -> (S06 influence) -> save
    happy path clicks: ~6-10, no preview of the result (inferred)
    edge: invalid range (vent temp below heating temp), change applies mid-period, two users editing

F03 Apply a crop recipe
    S08 -> pick recipe -> pick sections -> apply
    happy path clicks: 4
    edge: recipe made for another crop, section has manual overrides

F04 Investigate a problem with graphs
    S03 value -> one-click graph S07 -> add series -> change range
    happy path clicks: 3-5
    edge: data gap, compare two sections with different sensors

F05 Create a custom alarm
    S09 -> S10 -> variable, condition, period, priority -> save
    happy path clicks: ~7
    edge: flapping value, alarm during silence window

F06 Manual override of an installation
    S03/S14 -> actuator -> manual position -> back to auto
    edge: forgotten manual mode (must be visible everywhere)
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| App shell | sidebar (desktop), bottom bar (mobile) | collapsed, expanded | all |
| Section tile | climate, water, energy | normal, warning, alarm, offline, manual | S02 |
| Value row | measured, setpoint, calculated, actuator % | normal, out of range, fault, manual | S03, S12, S13 |
| Visualization schematic | glasshouse with vents, screen, pipes, lamps, CO2, fans, pads | animated, manual | S04 |
| Period table | 1-6 periods, start relative to sunrise/sunset/clock | edit, invalid | S05 |
| Influence curve | x/y points, linear interpolation | on, off | S06 |
| Time-series chart | lines, steps, bands (setpoint vs measured) | loading, empty, zoomed | S03, S07, S11, S13 |
| Alarm item | priority low/medium/high/critical | active, acknowledged, snoozed, cleared | S09 |
| Numeric input with unit | °C, %, ppm, g/m³, W/m², mS/cm | default, focus, invalid, changed | S05, S10 |
| Diff / confirm dialog | settings change, recipe apply | open | S05, S08 |
| Toast | success, error | | all |

## Inferred data model

```
Site         id, name, lat, lon, timezone, units
             evidence: weather forecast uses GPS (src 11) | confidence: high
Section      id, site_id, name, crop, area_m2, kind (crop|technical)
             evidence: "crop sections ... technical rooms" (src 4) | high
Sensor       id, section_id, kind (air_temp, rh, co2, par, pipe_temp, ...), unit
             evidence: dealer sensor list (src 17) | high
Actuator     id, section_id, kind (vent_lee, vent_wind, screen, heating_valve, lamps,
             co2_valve, fan, pad, fog), mode (auto|manual), manual_value
             evidence: visualization panel, manual control | medium
Reading      sensor_id, ts, value      (time series, 1 min)
             evidence: graphs | high
Strategy     id, section_id, periods[], heating, ventilation, humidity, co2, screens,
             lighting, influences[]  (versioned)
             evidence: settings, periods, influences | high
Period       start_ref (sunrise|sunset|clock), offset_min, setpoints{}
             evidence: vent doc "max 6 periods" | medium
Influence    target_setpoint, source (radiation|rh|outside_temp|forecast), curve[(x,y)]
             evidence: src 9 | high
Recipe       id, name, crop, stage, strategy_snapshot, created_by
             evidence: src 8 | high
AlarmRule    id, variable, condition, threshold, delay_min, active_window, priority,
             recipients
             evidence: src 12, 13 | medium
Alarm        id, rule_id|system, section_id, raised_at, acknowledged_by/at,
             snoozed_until, cleared_at
             evidence: src 12 | high
IrrigationGroup  id, section_id, valves, ec_target, ph_target, start_rules (radiation
             sum, time), drain_target   | medium
EnergyAsset  id, kind (boiler|buffer|chp|chiller), status, power, usage | medium
ChangeLog    id, user_id, entity, before, after, ts | guess
User         id, name, email, role (owner|grower|operator|viewer), language | medium
```

Relationships: Site 1-n Section, Section 1-n Sensor, Section 1-n Actuator,
Section 1-1 active Strategy (n versions), Strategy 1-n Period, Strategy 1-n Influence,
Recipe snapshot -> Strategy, AlarmRule 1-n Alarm, Section 1-n IrrigationGroup.

## System architecture of the original (inferred)

```
[sensors / actuators] -> [I/O modules + controllers in the greenhouse]
        -> [IIVO process computer on site: control loops every few seconds,
            strategy -> calculated setpoint -> outputs, local database]
        -> [IIVO Remote: browser UI served from the process computer through a
            Hoogendoorn relay, no TeamViewer needed]
        -> [cloud: weather forecast by GPS, Intelligent Algorithms, LetsGrow.com data,
            Hoogendoorn 360, remote software updates]
```

Key point to copy: **control runs on site** and keeps running when the internet drops.
The UI and the clever stuff live on top of it.

## Feature matrix

See `features.csv`. Must: 24, should: 15, could: 9, skip: 5.

## Out of scope (cannot or should not be cloned)

- Hoogendoorn hardware, I/O modules and their firmware, the certified installation.
- Intelligent Algorithms' trained models and Plant Empowerment course content (theirs).
- LetsGrow.com data network and benchmarks across their growers.
- Their partner integrations (Grodan, etc.) as such; we can integrate with the same
  vendors through their own public APIs later.
- The Hoogendoorn Online knowledge base content (their manuals, courses).

## Size

Screens 16, flows 6, entities 15. Hard parts: (1) a believable control engine and
simulation (influences, P-band, periods by sunrise/sunset), (2) real hardware I/O
(Modbus/MQTT) and offline-first edge control, (3) time-series storage and fast graphs.
Size: L for a production product with hardware; M for the software product with a
simulated greenhouse (digital twin) that we build first.
