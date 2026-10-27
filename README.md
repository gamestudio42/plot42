<p align="center">
  <img src="apps/lobby/public/favicon.svg" width="88" alt="Plot 42">
</p>

<h1 align="center">Plot 42</h1>

<p align="center"><strong>Six browser games on one studio lot.</strong></p>

<p align="center">
  A static platform: a lobby plus Horta, Posto, Mata and Sítio. Urbe and Neo Urbe open
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
| **Sítio** | Grow coffee, keep the families fed and turn a farm into a village. | `pnpm sitio` → [localhost:5178](http://localhost:5178) |
| **Neo Urbe** | Urbe under the `neon` ruleset: unstable grid, megacorps buying lots, hackers, drone lanes and seven-storey spires. | [gamestudio42.github.io/neo-urbe](https://gamestudio42.github.io/neo-urbe/) |

The lobby (`pnpm lobby`, [localhost:5176](http://localhost:5176)) lists the six. Urbe and Neo Urbe leave this site and open the addresses above. Horta, Posto, Mata and Sítio are built into it.

Horta, Posto, Mata and Sítio ship the five interface languages (English, Portuguese,
Spanish, French, German). Saves: `.horta.json`, `.posto.json`, `.mata.json`,
`.sitio.json`.

Urbe and Neo Urbe are published from their own repositories. This site links to
them and does not contain their source.

## Develop

```sh
pnpm install
pnpm dev        # lobby, http://localhost:5176
pnpm horta      # http://localhost:5174
pnpm posto      # http://localhost:5175
pnpm mata       # http://localhost:5177
pnpm sitio      # http://localhost:5178
```

Or with Docker: `docker compose up` serves the lobby on port 5176.

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `pnpm check`       | Lint, type check, unit tests and the site build |
| `pnpm test:e2e`    | Playwright test for the lobby                    |
| `pnpm build:site`  | Lobby + Horta, Posto, Mata and Sítio into `site/` |
| `pnpm preview:site`| Serve `site/` on http://localhost:4173           |

`pnpm build:site` reads `BASE_PATH` (default `/`). GitHub Pages uses
`/<repository>/`. The assembled tree is `site/index.html` plus `horta/`, `posto/`,
`mata/` and `sitio/`.

Docs: [architecture](docs/architecture.md) · [agents](AGENTS.md) · [contributing](CONTRIBUTING.md)

## Licence

Original code, original pixel art and synthesized sound and music, MIT licence.
Micropolis (GPLv3) and OpenSC2K were studied as references for behaviour only;
no code or assets were copied.
