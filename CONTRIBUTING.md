# Contributing to Urbe

Thanks for wanting to remix the city. Code, comments and docs are in English.
Player-facing text is in Brazilian Portuguese (`apps/web/src/i18n/pt-BR.ts`).

## Quick start

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm check      # lint, types, unit/integration/scenario tests, production build
pnpm test:e2e   # Playwright
```

Docker: `docker compose up`.

## Rules that keep the sim honest

1. `packages/simulation` is pure TypeScript: no DOM, no Node APIs, no wall-clock
   time, no `Math.random`, no transcendental `Math`. Lint enforces this.
2. React components send commands and read state. They do not contain growth or
   economy rules.
3. The renderer never mutates simulation state.
4. Every random decision uses the engine RNG, in a deterministic order.
5. Constants live in `packages/shared/src/balance/balance.ts`. Formulas live in
   `docs/simulation-spec.md`. Provenance lives in `docs/mechanics-matrix.md`.
6. Do not copy code, sprites, sounds or names from SimCity, Micropolis (GPLv3)
   or OpenSC2K. Study them in `references/` (git-ignored) and write original work.
7. Interactive elements that tests touch need a `data-testid`.

A fuller map of the repo is in [AGENTS.md](AGENTS.md).

## Good first issues

Browse open [good first issues](https://github.com/gamestudio42/urbe/labels/good%20first%20issue)
and [discussions](https://github.com/gamestudio42/urbe/discussions).

## Pull requests

- Keep the change small and covered by a test at the right layer (unit for a
  rule, scenario for an emergent effect, E2E for UI).
- Run `pnpm check`. Run `pnpm test:e2e` when the UI changes.
- If a rule or constant changes, update the docs and compare a headless run
  (`pnpm sim`) with the numbers in `docs/balancing.md`.
- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`).
- No new dependency without a written reason in the commit message.
