# Neo Urbe ruleset

Neo Urbe is the same city builder as Urbe, running `ruleset: 'neon'`. The classic ruleset is
untouched: every new rule behind this flag has its own unit test in `tests/unit/neon-*.test.ts`,
and the classic suites keep passing with the same hashes for the same seeds.

Constants live in [packages/shared/src/balance/neon.ts](../packages/shared/src/balance/neon.ts).
This document holds the formulas and their provenance.

## How the ruleset is selected

- `EngineOptions.ruleset` (`'classic' | 'neon'`, default `'classic'`) is stored in the snapshot and
  in the save state, so a loaded city keeps playing by its own rules.
- The save envelope is versioned (`SAVE_VERSION = 2`); a v1 file migrates to `ruleset: 'classic'`.
- Neo Urbe writes its own envelope (`neon-city-save`, `.neon.json`), so the two games never import
  each other's files. IndexedDB uses the same `SaveStore` with the neon prefix.
- `pnpm sim --preset neon-balanced` runs the ruleset headless; `pnpm bench` keeps the 128×128
  budget honest.

## 1. Unstable power grid

`packages/simulation/src/systems/neon/grid.ts`, driven by `NEON_GRID`.

The classic solver already finds connected power components and serves them nearest-first. The
neon layer reads the **same** components (`powerNetworkComponents` in `systems/utilities.ts`,
including the hop over a road tile) and adds three failure modes:

| Quantity | Formula |
| --- | --- |
| Component stress | `demand / supply >= overloadThreshold` (0.9) |
| Cascade probability | `cascadeChance` (0.08) per day while short **and** stressed |
| Buildings taken offline | `max(1, round(targets * cascadeShare))`, `cascadeShare = 0.35` |
| Outage length | `cascadeOutageDays * 4` ticks (2 days) |
| Substation supply | `+400` while online |
| Battery discharge | `min(batteryOutput, shortfall / banks)` power, draining `1/240` charge per tick |
| Battery charge | `+1/240` per tick while the component has headroom |

Cascade targets are chosen with `engine.rng` over the component's buildings in id order, skipping
batteries and substations, so a seed plus a command log reproduces every blackout. Overloaded
components are exposed in `CityStats.neon.overloaded` and `isOverloaded()` backs the inspector.

Provenance: **New**. The failure modes are the cyberpunk fantasy; capacity, demand and the
component solver come from the classic model (`Code`).

## 2. Megacorporations

`packages/simulation/src/systems/neon/corporations.ts`, driven by `NEON_CORPS`.

Four corporations exist from the first month, each with starting capital, a preferred quadrant and
a portfolio. Once a month, in id order:

1. Skip the corporation when `capital < startingCapital * buyReserve` (0.35).
2. Roll `expandChance` (0.5) on `engine.rng`.
3. Buy the first vacant **zoned** lot inside its quadrant (index order): no owner, not abandoned,
   `occupancy <= maxOccupancy` (6), and not a full-capacity lot with residents.
4. Pay `round(capital * lotPrice)` (0.18), own the lot, and stamp land value.

The stamp adds `round(landValue * (1 - d / (radius + 1)))` to `influence.landValue` inside
`landValueRadius` (5), capped at 255; the normal influence pass averages it out again. The city
also loses `round(price * taxSkim)` (0.12) to the corporation, tracked in `neon.skimmed`.

Nothing new is spawned, so the classic growth pipeline is untouched; a corporation only takes over
lots the city failed to fill. `BuildingRecord.owner` is optional and ignored by the classic rules.

Provenance: **New**. The land-value stamp reuses the influence model (`Observed`); the agent
behaviour is ours.

## 3. Hackers and ICE

`packages/simulation/src/systems/neon/intrusion.ts`, driven by `NEON_INTRUSION`.

| Quantity | Formula |
| --- | --- |
| Attempt chance | `min(maxChance, baseChance + population/1000 * populationChance)` |
| Base / per 1000 / cap | `0.35` / `0.12` / `0.8` |
| Firewall coverage at a building | `max(1 - d / (radius + 1))` over powered, online nodes, capped at 1 |
| Block chance | `coverage * firewallMitigation` (0.75) |
| Outage | `offlineTicks` (60) |
| Theft | `min(theft, funds)`, `theft = 400` |

Only services (non-zone buildings with jobs) can be targeted. Coverage needs a **powered** node
within `firewallRadius` (6). `tickIntrusions` counts the outage down and clears `offline` when it
expires; the utilities pass already treats `offline > 0` as unpowered. Every attempt and every
target uses `engine.rng`, in building order after the firewall scan.

Provenance: **New**. Integration with `SimEvent` (`intrusion`) and the existing `offline` counter
is `Code`.

## 4. Drone air traffic

`packages/simulation/src/systems/neon/airTraffic.ts`, driven by `NEON_DRONES`.

The aerial layer is additive by construction: it never writes the ground `traffic` layer. The
traffic pass reads `droneRelief(engine, roadTiles)` and subtracts it from the congestion it
reports.

| Quantity | Formula |
| --- | --- |
| Capacity | `onlinePorts * perPort` (4) |
| Relief | `relief * min(1, capacity / max(1, roadTiles / 24))`, `relief = 0.15` |
| Lane length | longest straight run of road tiles leaving one side of the port |

A port only counts while powered and online. Lanes are a derived read model rebuilt for the
renderer (`droneLanes`), so the only serialized state is the port buildings themselves.

Provenance: **New**.

## 5. Vertical density

`packages/simulation/src/systems/neon/vertical.ts`, driven by `NEON_VERTICAL`.

| Quantity | Formula |
| --- | --- |
| Dense level cap | `maxLevelDense` (7) |
| Light level cap | `maxLevelLight` (3) |
| Capacity above the classic table | `classic[5] * capacityPerLevel^(level - 5)`, 1.35 |
| Power above the classic table | `classic[5] * powerPerLevel^(level - 5)`, 1.2 |
| Water above the classic table | `classic[5] * waterPerLevel^(level - 5)`, 1.15 |

`neonCapacity`, `neonPower` and `neonWater` are exact at or below level 5, so the classic table
stays authoritative and only the extra spires extrapolate. `growth.ts` and `utilities.ts` branch on
`ruleset === 'neon'` and call these functions; the classic path is byte-identical.

Provenance: **New** formulas over the `Observed` level caps.

## Theme, audio and copy

- `@theme/core` holds the colourless `Theme` interface. `@theme/urbe` is the current Urbe palette;
  `@theme/neon` is the cyberpunk palette, its CSS custom properties and its audio parameters.
- `@view/city` never hardcodes a colour: `SpriteFactory`, `chunkDraw` and `AnimationLayer` receive a
  `Theme` in the constructor.
- `apps/neon` wraps `apps/web`'s `App` with `theme={neon} ruleset="neon"` and its own synthwave
  composer (`apps/neon/src/audio/composer.ts`, a pure bar generator tested in
  `tests/unit/neon-music.test.ts`), so the shared board keeps mute and the audio bus.
- Copy lives in the same five catalogues as Urbe; `apps/neon/src/i18n.ts` overrides the labels with
  cyberpunk vocabulary instead of translating Urbe literally.

## Acceptance

- Classic Urbe: same unit, scenario and E2E suites, same hashes for the same seeds.
- Neo Urbe: same seed plus the same command log produces the same `hashState`.
- The five mechanics are playable through the UI and explained by the inspector.
- `pnpm check`, `pnpm test:e2e` and `pnpm build:site` (with `site/neon/`) are green.
