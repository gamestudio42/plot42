# City Builder

An isometric city builder that runs in the browser, inspired by the mechanics of classic
city simulators: zoning, growth driven by demand, power and water networks, traffic, budget,
public services, pollution, crime, land value and disasters.

The game interface is in Brazilian Portuguese. Code and docs are in English.

## Quick start

```sh
pnpm install
pnpm dev        # http://localhost:5173
```

Or with Docker: `docker compose up`.

## Playing

Pick a name, seed, map size, difficulty and terrain in the menu. Lay roads, zone residential,
commercial and industrial areas, and connect them to power and water; the city grows where
there is demand, access and services. The toolbar shows each tool's cost and hotkey; `Esc`
cancels, `P` pauses, `M` toggles the sound and the system panel lists every shortcut.
Cars follow the simulated traffic, chimneys smoke, water shimmers and fire engines drive to
covered fires; the animations can be switched off in the system panel (they never change the
simulation). Cities are saved in the browser (IndexedDB, with autosave) and can be exported to a
`.city.json` file.

## Scripts

| Command         | Description                                                   |
| --------------- | ------------------------------------------------------------- |
| `pnpm dev`      | Development server                                            |
| `pnpm build`    | Production build (`apps/web/dist`)                            |
| `pnpm preview`  | Serve the production build                                    |
| `pnpm check`    | Lint, type check, unit/integration/scenario tests and build   |
| `pnpm test:e2e` | Playwright end-to-end tests                                   |
| `pnpm sim`      | Headless simulation over presets and seeds (JSON reports)     |
| `pnpm bench`    | Tick timing benchmark against the budgets (`--strict` for CI) |

## Deploy

The game is a static site. `.github/workflows/deploy.yml` builds it with
`BASE_PATH=/<repository>/` and publishes `apps/web/dist` to GitHub Pages on every push to
`main` (enable Pages with "GitHub Actions" as the source). To host it elsewhere, run
`BASE_PATH=/path/ pnpm build` and serve the `dist` folder.

## Documentation

- [Architecture](docs/architecture.md)
- [Simulation specification](docs/simulation-spec.md)
- [Balancing and performance](docs/balancing.md)
- [Mechanics matrix](docs/mechanics-matrix.md) (provenance of every rule)
- [Roadmap](docs/roadmap.md)
- [Testing strategy](docs/testing-strategy.md)
- [Agent guide](AGENTS.md)

## Credits and licence

Original code, procedurally generated sprites and synthesized sounds, MIT licence. Micropolis (GPLv3) and OpenSC2K
were studied as references for behaviour only; no code or assets were copied.
