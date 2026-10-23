# Contributing to Plot 42

Thanks for wanting to remix a game. Code, comments and docs are in English.
Player-facing text lives in each app's i18n catalog (`en`, `pt-BR`, `es`, `fr`, `de`).
English is the type source.

Urbe and Neo Urbe are developed in their own repositories. Changes to those
cities do not belong in this tree.

## Quick start

```sh
pnpm install
pnpm dev        # lobby, http://localhost:5176
pnpm horta      # http://localhost:5174
pnpm posto      # http://localhost:5175
pnpm mata       # http://localhost:5177
pnpm check      # lint, types, unit tests, production site build
pnpm test:e2e   # Playwright lobby test
```

Docker: `docker compose up` serves the lobby on port 5176.

## Rules that keep the sims honest

1. `packages/horta`, `packages/posto`, `packages/mata` and `packages/kernel` are
   pure TypeScript: no DOM, no Node APIs, no wall-clock time, no `Math.random`,
   no transcendental `Math`. Lint enforces this.
2. React components send commands and read state. They do not contain growth or
   combat rules.
3. The renderer never mutates simulation state.
4. Every random decision uses the engine RNG, in a deterministic order.
5. Interactive elements that tests touch need a `data-testid`.

A fuller map of the repo is in [AGENTS.md](AGENTS.md).

## Pull requests

- Keep the change small and covered by a test at the right layer.
- Run `pnpm check`. Run `pnpm test:e2e` when the lobby UI changes.
- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`). Write PR titles and
  bodies in English.
- No new dependency without a written reason in the commit message.
