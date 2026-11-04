# Architecture

Plot 42 is a static browser game platform. There is no backend: each title runs
on the client, and saves live in IndexedDB or in exported files.

Urbe, Sítio, Neo Urbe, Urbe Oasis and Vazante are not in this repository. They ship from
[gamestudio42/urbe](https://github.com/gamestudio42/urbe),
[gamestudio42/sitio](https://github.com/gamestudio42/sitio),
[gamestudio42/neo-urbe](https://github.com/gamestudio42/neo-urbe),
[gamestudio42/urbe-oasis](https://github.com/gamestudio42/urbe-oasis) and
[gamestudio42/vazante](https://github.com/gamestudio42/vazante). The lobby
links to those Pages sites.

## Packages

| Package             | Responsibility                                               | May depend on   |
| ------------------- | ------------------------------------------------------------ | --------------- |
| `packages/kernel`   | RNG, hash, base64, save envelope, command queue, tick runner | nothing         |
| `packages/bridge`   | Worker clock and RPC inbox shared by every game              | nothing         |
| `packages/view-iso` | Isometric projection, camera, chunk grid                     | pixi.js         |
| `packages/chrome`   | Store, boot/pause/toasts, Logo, locale, saves                | react           |
| `packages/horta`    | Horta: plant / grow / harvest grid and `horta-save`          | `@shell/kernel` |
| `packages/posto`    | Posto: 10×10 tactics, deterministic enemy turn, `posto-save` | `@shell/kernel` |
| `packages/mata`     | Mata: living grove, plant interactions, `mata-save`          | `@shell/kernel` |
| `apps/lobby`        | Game store: catalog (`src/games.ts`), shelves, five locales  | react + chrome  |
| `apps/horta`        | Horta web app                                                | horta + shell   |
| `apps/posto`        | Posto web app                                                | posto + shell   |
| `apps/mata`         | Mata web app                                                 | mata + shell    |
| `tools/`            | `build-site` and `preview-site`                              | nothing         |
| `tests/`            | Unit tests (Vitest) and browser game journeys                | the apps above  |

Packages expose their TypeScript sources directly (`"exports": "./src/index.ts"`). Vite, Vitest
and `tsx` compile them on the fly, so there is no package build step.

## Static site

`pnpm build:site` (`tools/build-site.ts`) builds the lobby plus Horta, Posto and Mata with
`BASE_PATH` prefixes and copies them into `site/`. The lobby sends Urbe, Sítio, Neo Urbe, Urbe Oasis and
Vazante to `gamestudio42.github.io/<repo>/` (`urbe`, `sitio`, `neo-urbe`, `urbe-oasis`, `vazante`).

| Path      | App          |
| --------- | ------------ |
| `/`       | `apps/lobby` |
| `/horta/` | `apps/horta` |
| `/posto/` | `apps/posto` |
| `/mata/`  | `apps/mata`  |

Development uses one Vite port per app (`5174` Horta, `5175` Posto, `5176` lobby,
`5177` Mata) with `base: '/'`. `pnpm preview:site` serves the assembled folder.
GitHub Pages publishes `site/` (`BASE_PATH` from the repository name).

IndexedDB names stay per title: Horta `horta`, Posto `posto`, Mata `mata`.

## Session recovery

The live world and its persistent checkpoint are separate. Returning to the menu
pauses Horta/Mata and preserves the worker state and camera. **Resume session**
returns to that state; after a page reload, **Continue** loads the latest stored
checkpoint. Creating a world or importing a file assigns a new browser-local UUID.
Loading an existing slot retains its ID, including the legacy `autosave` slot.
Worlds with identical names or seeds still have independent slots.

Checkpoints are written after successful player commands, on menu entry, every
ten seconds during a game, and when the document becomes hidden. Horta/Mata pause
when hidden. Writes are serialized; replacing a live world waits for its checkpoint
to commit. On storage failure, replacement is blocked and the current session
remains available to resume or export. The UI keeps a recovery notice visible.
Exported saves retain their existing formats and checksums.

A browser crash or forced process termination can still lose simulation time since
the last committed checkpoint. Asynchronous writes are not guaranteed during tab
closure; pending/failed writes trigger the browser's leave warning where supported.
Checkpointing is not cloud backup or cross-tab conflict resolution.

Worker RPCs time out after 15 seconds and reject outstanding requests on worker
failure or disposal. A failed boot/worker exposes a reload action instead of an
indefinite loader. Storage failure alone does not prevent a first game from starting.

## Mata

Mata is a 16×16 grove. The player spends seeds to plant five species and cistern
water to irrigate; the engine ticks moisture, nutrients, soil, shade, fauna and
health. Light is `255 - shade` with a min/max window per species: grass needs sun,
ferns need shade, Ingá feeds neighbors, cactus holds the dry. Adults return a seed
on a fixed interval. A drought is announced on tick 24, runs from 32 to 44, and
then the grove is judged won or lost. Saves use `mata-save` v2 (`.mata.json`); v1
files migrate in health, bag and cistern.

New games start paused with a field guide. The guide explains the resource tradeoffs,
the drought timeline and the win thresholds (6 plants, 3 species, 16 balance), drawn
from simulation constants. Players can plant and water while paused, reopen the
guide, and inspect progress toward the goal. Reopening the guide pauses the season.
Outcomes show the final counts and offer a retry on the same seed.

The normal clock advances one ecological day every eight seconds. A 44-day season
takes 352 seconds (5m52s) at 1×; 2× and 3× multiply that rate exactly. This changes
wall-clock pacing, not the simulation rules, RNG order or save format. Existing
saves resume at their stored ecological day with the slower clock, initially paused.

## Verification

`pnpm check` runs lint, all package type checks, deterministic unit tests and the
static-site build. The Pages deployment runs the same quality checks and browser
suite with its repository URL prefix before uploading the tested site.
`pnpm test:e2e` exercises the lobby plus all three game sessions:
actions, checkpoint selection, independent worlds, reload and continuation. The
suite also checks malformed files, legacy slots, denied storage, worker startup
failure, Mata's paused introduction and a narrow HUD layout.

Mata has a normal-resource winning strategy tested both headlessly and through the
actual UI. The browser scenario runs a complete season at 3× (about two minutes);
it does not inject a winning state or accelerate the worker clock. The unit version
uses only public commands and ticks, without modifying soil, inventory or plant ages.

## Determinism

Horta, Posto and Mata compile with `lib: ["ES2023"]` and no ambient types, so any
accidental use of DOM or Node APIs fails the type check. ESLint additionally bans
`Math.random`, `Date`, `window` and `document` inside those packages and inside
`packages/kernel`. Every random decision uses the kernel RNG, in a deterministic order.
React components send commands and read state. The renderer never mutates simulation state.
