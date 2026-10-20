# Testing strategy

## Layers

| Layer       | Location                | Runner     | Command                | Purpose                                                                |
| ----------- | ----------------------- | ---------- | ---------------------- | ---------------------------------------------------------------------- |
| Unit        | `tests/unit`            | Vitest     | `pnpm test`            | Pure functions: RNG, noise, geometry, validation, networks, save codec |
| Integration | `tests/integration`     | Vitest     | `pnpm test`            | Engine with several systems: commands + ticks + serialization          |
| Scenarios   | `tests/scenarios`       | Vitest     | `pnpm test:simulation` | Whole cities simulated for months or years, asserting trends           |
| End-to-end  | `tests/e2e`             | Playwright | `pnpm test:e2e`        | Real browser: menu, picking, tools, HUD, save/load                     |
| Reports     | `tools/headless-sim.ts` | tsx        | `pnpm sim`             | JSON reports for balancing                                             |
| Benchmarks  | `tools/benchmark.ts`    | tsx        | `pnpm bench`           | Tick timings and memory against budgets                                |

## Scenario rules

- Scenarios build cities with the helpers in `packages/simulation/src/scenarios`, on a flat map,
  so terrain randomness never breaks the layout.
- Assert **invariants and trends**, never exact growth numbers: "population with power is at
  least 5× population without power", not "population is 1234".
- Always use fixed seeds. When a scenario compares two variants, both use the same seed.
- Each scenario records its monthly metrics and named checks through `tests/scenarios/harness.ts`
  and writes `reports/scenarios/<name>.json` (git-ignored) before asserting, so a failing run
  still leaves a report to inspect.
- Scenarios that grow for years use `maintainTown`, a minimal automated player that adds
  plants and pumps when demand passes 85% of supply.
- `flatCity` disables random fires and disasters so trends are not luck. The repeated-simulation
  and save/load scenarios turn them on to exercise those RNG paths.
- A/B comparisons fork one city through `serialize()` / `fromSnapshot()` and change a single
  factor (the fire scenario cuts fire funding in the control), so both runs share every
  building.

## Required scenarios

| Scenario                 | Expected result                                             |
| ------------------------ | ----------------------------------------------------------- |
| City without power       | Growth limited by the missing service                       |
| Balanced city            | Sustained population growth, no bankruptcy                  |
| Very high taxes          | Lower demand and population than with neutral taxes         |
| Industry next to homes   | Lower residential land value and attractiveness             |
| Disconnected roads       | Lower job access and population                             |
| Insufficient budget      | Worse service coverage, debt, eventual bankruptcy           |
| Fire near a fire station | Less burnt area than the same fire without coverage         |
| Save/load                | Restored state has the same hash; both continue identically |
| Repeated simulation      | Same seed + same commands → same final hash                 |

## Determinism oracle

`hashState(engine)` hashes every layer, building, economy field and the RNG state. Tests compare
hashes, which makes any divergence visible immediately.

## End-to-end hooks

The web app exposes `window.__cityDebug` (always on, read-only helpers plus `runTicks` for tests):
the selected tile, tile lookup, statistics, camera helpers to project a tile to screen
coordinates, the engine hash, save export/import and disaster triggers. Playwright uses it to
click specific tiles and to assert results without parsing pixels. Screenshots are kept as
artifacts for visual review. Save tests cover IndexedDB across a reload, file export and
import, corrupted files (checksum, truncation, foreign JSON) and a simulated
`QuotaExceededError`.

## Performance budgets

- Monthly tick on a 128×128 balanced city: < 8 ms average (Node, desktop CPU).
- Fast tick: < 0.5 ms average.
- Rendering: 60 FPS on a common laptop at 1× zoom (checked manually and with the in-game FPS
  counter).
