# Architecture

Plot 42 is a static browser game platform. There is no backend: each title runs
on the client, and saves live in IndexedDB or in exported files.

Urbe, Sítio and Neo Urbe are not in this repository. They ship from
[gamestudio42/urbe](https://github.com/gamestudio42/urbe),
[gamestudio42/sitio](https://github.com/gamestudio42/sitio) and
[gamestudio42/neo-urbe](https://github.com/gamestudio42/neo-urbe). The lobby
links to those Pages sites.

## Packages

| Package             | Responsibility                                              | May depend on   |
| ------------------- | ----------------------------------------------------------- | --------------- |
| `packages/kernel`   | RNG, hash, base64, save envelope, command queue, tick runner | nothing         |
| `packages/bridge`   | Worker clock and RPC inbox shared by every game             | nothing         |
| `packages/view-iso` | Isometric projection, camera, chunk grid                    | pixi.js         |
| `packages/chrome`   | Store, boot/pause/toasts, Logo, locale, saves               | react           |
| `packages/horta`    | Horta: plant / grow / harvest grid and `horta-save`         | `@shell/kernel` |
| `packages/posto`    | Posto: 10×10 tactics, deterministic enemy turn, `posto-save` | `@shell/kernel` |
| `packages/mata`     | Mata: living grove, plant interactions, `mata-save`         | `@shell/kernel` |
| `apps/lobby`        | Landing page (marks, LocaleSelect, five locales)            | react + chrome  |
| `apps/horta`        | Horta web app                                               | horta + shell   |
| `apps/posto`        | Posto web app                                               | posto + shell   |
| `apps/mata`         | Mata web app                                                | mata + shell    |
| `tools/`            | `build-site` and `preview-site`                             | nothing         |
| `tests/`            | Unit tests (Vitest) and the lobby end-to-end test           | the apps above  |

Packages expose their TypeScript sources directly (`"exports": "./src/index.ts"`). Vite, Vitest
and `tsx` compile them on the fly, so there is no package build step.

## Static site

`pnpm build:site` (`tools/build-site.ts`) builds the lobby plus Horta, Posto and Mata with
`BASE_PATH` prefixes and copies them into `site/`. The lobby sends Urbe, Sítio and Neo Urbe to
`gamestudio42.github.io/urbe`, `gamestudio42.github.io/sitio` and `gamestudio42.github.io/neo-urbe`.

| Path       | App            |
| ---------- | -------------- |
| `/`        | `apps/lobby`   |
| `/horta/`  | `apps/horta`   |
| `/posto/`  | `apps/posto`   |
| `/mata/`   | `apps/mata`    |

Development uses one Vite port per app (`5174` Horta, `5175` Posto, `5176` lobby,
`5177` Mata) with `base: '/'`. `pnpm preview:site` serves the assembled folder.
GitHub Pages publishes `site/` (`BASE_PATH` from the repository name).

IndexedDB names stay per title: Horta `horta`, Posto `posto`, Mata `mata`.

## Mata

Mata is a 16×16 grove. The player spends seeds to plant five species and cistern
water to irrigate; the engine ticks moisture, nutrients, soil, shade, fauna and
health. Light is `255 - shade` with a min/max window per species: grass needs sun,
ferns need shade, Ingá feeds neighbors, cactus holds the dry. Adults return a seed
on a fixed interval. A drought is announced on tick 24, runs from 32 to 44, and
then the grove is judged won or lost. Saves use `mata-save` v2 (`.mata.json`); v1
files migrate in health, bag and cistern.

## Determinism

Horta, Posto and Mata compile with `lib: ["ES2023"]` and no ambient types, so any
accidental use of DOM or Node APIs fails the type check. ESLint additionally bans
`Math.random`, `Date`, `window` and `document` inside those packages and inside
`packages/kernel`. Every random decision uses the kernel RNG, in a deterministic order.
React components send commands and read state. The renderer never mutates simulation state.
