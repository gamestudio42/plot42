<p align="center">
  <img src="apps/web/public/favicon.svg" width="88" alt="Plot 42">
</p>

<h1 align="center">Plot 42</h1>

<p align="center"><strong>Four browser games on one studio lot.</strong></p>

<p align="center">
  A static platform: a lobby and four titles that share a deterministic TypeScript
  shell. No install, no server. Saves stay in the browser or in exported files.
</p>

## Games

| Game | What it is | Dev |
| --- | --- | --- |
| **Urbe** | Isometric city builder. Zone the land, keep power and water flowing, watch demand and disasters. | `pnpm dev` → [localhost:5173](http://localhost:5173) |
| **Horta** | Plant, wait, harvest on a small isometric grid. | `pnpm horta` → [localhost:5174](http://localhost:5174) |
| **Posto** | Three units, a 10×10 board. Move, attack, then the enemy answers. | `pnpm posto` → [localhost:5175](http://localhost:5175) |
| **Mata** | Restore a scar before the drought. Seeds and cistern are limited; mix species or lose. | `pnpm mata` → [localhost:5177](http://localhost:5177) |
| **Neo Urbe** | Urbe under the `neon` ruleset: unstable grid, megacorps buying lots, hackers, drone lanes and seven-storey spires. | `pnpm neon` → [localhost:5178](http://localhost:5178) |

The lobby (`pnpm lobby`, [localhost:5176](http://localhost:5176)) links the five.

All titles ship the five interface languages (English, Portuguese, Spanish, French,
German). Saves: `.city.json`, `.neon.json`, `.horta.json`, `.posto.json`, `.mata.json`.

## Urbe

<p align="center"><strong>You set the conditions. The city decides the rest.</strong></p>

<p align="center">
  <img src="docs/screenshots/menu.jpg" alt="Urbe main menu over a living city" width="920">
</p>

- **Play in the browser.** Found a city. Nothing to download.
- **You create the conditions.** Roads, zones, plants and pumps. The simulator grows — or abandons — the lots.
- **A living city.** Cars follow traffic, chimneys smoke, water shimmers, fire engines roll out.
- **A mayor's desk.** Taxes, department funding, charts, thematic maps and a tile inspector that tells you *why* a lot is not growing.
- **Original soundtrack.** Calm lo-fi, synthesized on the fly.
- **Your city stays with you.** Autosave in the browser, plus export and import of `.city.json` files.

The published Urbe at [gamestudio42.github.io/urbe](https://gamestudio42.github.io/urbe/) is a separate repository. This project does not overwrite that site.

Hotkeys in the city: `R` road · `1–6` zones · `E` power · `T` water · `P` pause · `M` sound.

## Develop

```sh
pnpm install
pnpm lobby      # http://localhost:5176
pnpm dev        # Urbe, http://localhost:5173
pnpm horta      # http://localhost:5174
pnpm posto      # http://localhost:5175
pnpm mata       # http://localhost:5177
pnpm neon       # Neo Urbe, http://localhost:5178
```

Or with Docker: `docker compose up` serves Urbe on port 5173.

| Command            | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| `pnpm check`       | Lint, type check, unit/integration/scenario tests and Urbe build |
| `pnpm test:e2e`    | Playwright end-to-end tests (Urbe and Neo Urbe)             |
| `pnpm sim`         | Headless city simulation over presets and seeds             |
| `pnpm bench`       | Tick timing benchmark (`--strict` for CI)                   |
| `pnpm build:site`  | Lobby + five games into `site/`                             |
| `pnpm preview:site`| Serve `site/` on http://localhost:4173                      |

`pnpm build:site` reads `BASE_PATH` (default `/`). GitHub Pages uses
`/<repository>/`. The assembled tree is `site/index.html` plus `urbe/`, `horta/`,
`posto/` and `mata/`.

Docs: [architecture](docs/architecture.md) · [simulation spec](docs/simulation-spec.md) · [neon spec](docs/neon-spec.md) · [balancing](docs/balancing.md) · [mechanics](docs/mechanics-matrix.md) · [roadmap](docs/roadmap.md) · [testing](docs/testing-strategy.md) · [agents](AGENTS.md) · [contributing](CONTRIBUTING.md)

## Licence

Original code, procedural sprites and synthesized sound and music, MIT licence.
Micropolis (GPLv3) and OpenSC2K were studied as references for behaviour only;
no code or assets were copied.
