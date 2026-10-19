# AGENTS.md

Guidance for AI agents and humans working on this repository.

## Mission

Build an original isometric city builder inspired by the mechanics of classic city simulators,
playable in the browser. The player creates conditions; the simulator decides the outcome.

## Golden rules

1. The simulation (`packages/simulation`) is pure TypeScript: no DOM, no Node APIs, no
   wall-clock time, no `Math.random`, no transcendental `Math` functions. Lint and type check
   enforce this.
2. React components never contain economic or growth rules. They send commands and read state.
3. The renderer never mutates simulation state.
4. Every random decision uses the engine RNG, in a deterministic order.
5. Constants belong in `packages/shared/src/balance/balance.ts`, formulas in
   `docs/simulation-spec.md`, and their provenance in `docs/mechanics-matrix.md`.
6. Do not copy code, sprites, sounds or names from SimCity, Micropolis (GPLv3) or OpenSC2K.
   Study them in `references/` (git-ignored) and write independent code.
7. Code, comments and technical docs are in English. Player-facing text is in Brazilian
   Portuguese (`apps/web/src/i18n/pt-BR.ts`).

## Commands

```sh
pnpm install          # install dependencies
pnpm dev              # dev server on http://localhost:5173
pnpm lint             # ESLint
pnpm typecheck        # tsc for every package
pnpm test             # unit + integration tests (Vitest)
pnpm test:simulation  # long scenario tests (Vitest)
pnpm test:e2e         # Playwright (builds and serves the app)
pnpm build            # production build of apps/web
pnpm sim -- --scenario balanced --months 120 --seed 1   # headless JSON report
pnpm bench            # tick timing benchmark
pnpm check            # lint + typecheck + test + test:simulation + build
```

Docker: `docker compose up` serves the dev build on port 5173.

## Work loop

1. Read the phase in `docs/roadmap.md` and the relevant section of `docs/simulation-spec.md`.
2. Inspect the existing code before adding new modules.
3. Make a small, testable change.
4. Run `pnpm check`; for UI changes also run `pnpm test:e2e`.
5. Run a headless report (`pnpm sim`) when the change touches the simulation and compare the
   key metrics with the previous run.
6. Fix regressions before moving on.
7. Commit with a descriptive message (conventional commits: `feat:`, `fix:`, `test:`...).
8. Update docs when a rule or constant changes.

Never declare a feature done just because it compiles.

## Layout

```
apps/web/src/
  renderer/   Pixi isometric renderer, camera, picking, procedural sprites
  tools/      Tool definitions and the pointer-to-command controller
  hud/        React HUD, toolbar, panels, minimap, charts
  components/ Generic React components
  state/      UI store and the CityClient (worker bridge + mirror world)
  worker/     Web Worker host for the engine
  persistence/IndexedDB saves
  i18n/       Portuguese strings
packages/simulation/src/
  world/ terrain/ construction/ zoning/ population/ economy/ utilities/
  traffic/ services/ disasters/ diagnostics/ persistence/ scenarios/ rng/
  engine.ts
packages/shared/src/
  types/ commands/ balance/ schemas/ protocol/ util/
tests/{unit,integration,scenarios,e2e}
tools/{headless-sim.ts,benchmark.ts}
```

## Definition of done

- Behaviour covered by tests at the right layer (unit for rules, scenario for emergent effects).
- `pnpm check` green, E2E green for UI changes.
- No new dependency without a written reason in the commit message.
- Docs updated.
