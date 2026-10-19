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

## Scripts

| Command         | Description                                                 |
| --------------- | ----------------------------------------------------------- |
| `pnpm dev`      | Development server                                          |
| `pnpm build`    | Production build (`apps/web/dist`)                          |
| `pnpm check`    | Lint, type check, unit/integration/scenario tests and build |
| `pnpm test:e2e` | Playwright end-to-end tests                                 |
| `pnpm sim`      | Headless simulation report (JSON)                           |
| `pnpm bench`    | Simulation benchmark                                        |

## Documentation

- [Architecture](docs/architecture.md)
- [Simulation specification](docs/simulation-spec.md)
- [Mechanics matrix](docs/mechanics-matrix.md) (provenance of every rule)
- [Roadmap](docs/roadmap.md)
- [Testing strategy](docs/testing-strategy.md)
- [Agent guide](AGENTS.md)

## Credits and licence

Original code and procedurally generated assets, MIT licence. Micropolis (GPLv3) and OpenSC2K
were studied as references for behaviour only; no code or assets were copied.
