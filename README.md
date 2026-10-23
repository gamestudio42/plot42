<p align="center">
  <img src="apps/web/public/favicon.svg" width="88" alt="Plot 42">
</p>

<h1 align="center">Plot 42</h1>

<p align="center"><strong>Five browser games on one studio lot.</strong></p>

<p align="center">
  A static platform: a lobby plus Horta, Posto and Mata. Urbe and Neo Urbe open
  from their own sites. No install, no server. Saves stay in the browser or in exported files.
</p>

<p align="center">
  Play it at <a href="https://gamestudio42.github.io/plot42/">gamestudio42.github.io/plot42</a>.
</p>

## Games

| Game | What it is | Dev |
| --- | --- | --- |
| **Urbe** | Isometric city builder. Zone the land, keep power and water flowing, watch demand and disasters. | [gamestudio42.github.io/urbe](https://gamestudio42.github.io/urbe/) |
| **Horta** | Plant, wait, harvest on a small isometric grid. | `pnpm horta` → [localhost:5174](http://localhost:5174) |
| **Posto** | Three units, a 10×10 board. Move, attack, then the enemy answers. | `pnpm posto` → [localhost:5175](http://localhost:5175) |
| **Mata** | Restore a scar before the drought. Seeds and cistern are limited; mix species or lose. | `pnpm mata` → [localhost:5177](http://localhost:5177) |
| **Neo Urbe** | Urbe under the `neon` ruleset: unstable grid, megacorps buying lots, hackers, drone lanes and seven-storey spires. | [gamestudio42.github.io/neo-urbe](https://gamestudio42.github.io/neo-urbe/) |

The lobby (`pnpm lobby`, [localhost:5176](http://localhost:5176)) lists the five. Urbe and Neo Urbe leave this site and open the addresses above. Horta, Posto and Mata are built into it.

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

Urbe and Neo Urbe are published from their own repositories. This site links to them and does not build or overwrite those Pages deployments. `pnpm dev` and `pnpm neon` still run the copies in this tree.

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
| `pnpm build:site`  | Lobby + Horta, Posto and Mata into `site/`                  |
| `pnpm preview:site`| Serve `site/` on http://localhost:4173                      |

`pnpm build:site` reads `BASE_PATH` (default `/`). GitHub Pages uses
`/<repository>/`. The assembled tree is `site/index.html` plus `horta/`, `posto/`
and `mata/`.

Docs: [architecture](docs/architecture.md) · [simulation spec](docs/simulation-spec.md) · [neon spec](docs/neon-spec.md) · [balancing](docs/balancing.md) · [mechanics](docs/mechanics-matrix.md) · [roadmap](docs/roadmap.md) · [testing](docs/testing-strategy.md) · [agents](AGENTS.md) · [contributing](CONTRIBUTING.md)

## Licence

Original code, procedural sprites and synthesized sound and music, MIT licence.
Micropolis (GPLv3) and OpenSC2K were studied as references for behaviour only;
no code or assets were copied.
