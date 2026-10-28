# AGENTS.md

Guidance for AI agents and humans working on this repository.

## Mission

Build Plot 42, a static browser game platform. This repository hosts the lobby
plus three games that share the shell (`kernel`, `bridge`, `view-iso`, `chrome`):

- Horta is a small harvest grid.
- Posto is a turn-based outpost on a 10×10 board.
- Mata is a living grove: plants shade, drink and feed each other.

Urbe, Sítio and Neo Urbe are separate repositories
([gamestudio42/urbe](https://github.com/gamestudio42/urbe),
[gamestudio42/sitio](https://github.com/gamestudio42/sitio),
[gamestudio42/neo-urbe](https://github.com/gamestudio42/neo-urbe)).
The lobby links to their published sites. Do not add their source back here.

## Golden rules

1. The simulations in `packages/horta`, `packages/posto`, `packages/mata`
   and `packages/kernel` are pure TypeScript: no DOM, no Node APIs, no wall-clock time,
   no `Math.random`, no transcendental `Math` functions. Lint and type check enforce this.
2. React components never contain growth or combat rules. They send commands and read state.
3. The renderer never mutates simulation state.
4. Every random decision uses the engine RNG, in a deterministic order.
5. Code, comments, technical docs, commit messages and pull requests (title and
   body) are in English. Player-facing text lives in each app's i18n catalog
   (`en`, `pt-BR`, `es`, `fr`, `de`). English is the type source. The first visit
   follows the browser language (or English).

## Commands

```sh
pnpm install          # install dependencies
pnpm dev              # lobby on http://localhost:5176
pnpm lobby            # same as dev
pnpm horta            # Horta on http://localhost:5174
pnpm posto            # Posto on http://localhost:5175
pnpm mata             # Mata on http://localhost:5177
pnpm lint             # ESLint
pnpm typecheck        # tsc for every package
pnpm test             # unit tests (Vitest)
pnpm test:e2e         # Playwright lobby test
pnpm build            # lobby + Horta, Posto and Mata into site/
pnpm preview:site     # serve site/ on http://localhost:4173
pnpm check            # lint + typecheck + test + build
```

Docker: `docker compose up` serves the lobby on port 5176.

## Work loop

1. Inspect the existing code before adding new modules.
2. Make a small, testable change.
3. Run `pnpm check`; for lobby UI changes also run `pnpm test:e2e`.
4. Fix regressions before moving on.
5. Commit with a descriptive English message (conventional commits: `feat:`, `fix:`, `test:`...).
   Open pull requests in English (title and body).
6. Update docs when a rule or constant changes.

Never declare a feature done just because it compiles.

## Layout

```
packages/kernel/   RNG, hash, base64, save envelope, command queue
packages/bridge/   worker clock + RPC inbox
packages/view-iso/ isometric camera, picking, chunk grid
packages/chrome/   Store, boot/pause/toasts, i18n helpers, audio graph, IndexedDB
packages/horta/    Horta sim (plant / grow / harvest)
packages/posto/    Posto sim (move / attack, enemy turn)
packages/mata/     Mata sim (shade / water / nutrients / fauna / health, `mata-save`)
apps/lobby/        Plot 42 landing page (marks, LocaleSelect, five locales)
apps/horta/        Horta web app (port 5174)
apps/posto/        Posto web app (port 5175)
apps/mata/         Mata web app (port 5177)
tests/unit/        Vitest for Horta, Posto and Mata
tests/e2e/         Playwright lobby test
tools/             build-site.ts, preview-site.ts
```

## Definition of done

- Behaviour covered by a test at the right layer.
- `pnpm check` green, E2E green for lobby UI changes.
- No new dependency without a written reason in the commit message.
- Docs updated.
