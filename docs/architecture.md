# Architecture

Plot 42 is a static browser game platform. There is no backend: each title runs
on the client, and saves live in IndexedDB or in exported files.

Urbe and Neo Urbe are not in this repository. They ship from
[gamestudio42/urbe](https://github.com/gamestudio42/urbe) and
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
| `packages/sitio`    | Sítio: coffee, families, institutions, `sitio-save`         | `@shell/kernel` |
| `apps/lobby`        | Landing page (marks, LocaleSelect, five locales)            | react + chrome  |
| `apps/horta`        | Horta web app                                               | horta + shell   |
| `apps/posto`        | Posto web app                                               | posto + shell   |
| `apps/mata`         | Mata web app                                                | mata + shell    |
| `apps/sitio`        | Sítio web app                                               | sitio + shell   |
| `tools/`            | `build-site` and `preview-site`                             | nothing         |
| `tests/`            | Unit tests (Vitest) and the lobby end-to-end test           | the apps above  |

Packages expose their TypeScript sources directly (`"exports": "./src/index.ts"`). Vite, Vitest
and `tsx` compile them on the fly, so there is no package build step.

## Static site

`pnpm build:site` (`tools/build-site.ts`) builds the lobby plus Horta, Posto, Mata and Sítio with
`BASE_PATH` prefixes and copies them into `site/`. The lobby sends Urbe and Neo Urbe to
`gamestudio42.github.io/urbe` and `gamestudio42.github.io/neo-urbe`.

| Path       | App            |
| ---------- | -------------- |
| `/`        | `apps/lobby`   |
| `/horta/`  | `apps/horta`   |
| `/posto/`  | `apps/posto`   |
| `/mata/`   | `apps/mata`    |
| `/sitio/`  | `apps/sitio`   |

Development uses one Vite port per app (`5174` Horta, `5175` Posto, `5176` lobby,
`5177` Mata, `5178` Sítio) with `base: '/'`. `pnpm preview:site` serves the assembled folder.
GitHub Pages publishes `site/` (`BASE_PATH` from the repository name).

IndexedDB names stay per title: Horta `horta`, Posto `posto`, Mata `mata`, Sítio `sitio`.

## Sítio

Sítio is a 24×24 coffee farm on a weekly clock: four seasons, four weeks per
season and three years, 48 weeks in total. A new farm starts from the landscape,
not a finished village. The player places a casa grande (3×2), one colono house
(2×2), one terreiro (2×2) and a free 4×2 coffee lot (eight cells, 16 pés). These
placements are free; the calendar is locked until the coffee lot is placed.
Every other building is paid and constructed later. The road and forest are
preserved and there is no road-access rule; roads reject planting, building and
clearing.

A colono house holds one family with two adults and two children. Each adult has
a morning and an afternoon period per week; routines persist until changed and a
person cannot work twice in one period. Children may work only in the yard, at
half adult output: their food feeds the family but can never be sold as surplus.
A child aged 6 or older may instead study at a completed school. Four study
periods educate the child; education persists. At the end of each year every
person ages one year; a 16-year-old becomes an adult and any idle or study
routine becomes yard work. A family is created when its house is placed. An empty
colono house can receive an invited family for 4 coins; invited families are
unrelated to the existing families, so siblings never marry each other. At the
end of each season a new family may also arrive if a house is empty and
reputation is at least 3.

The week is the only clock: validate routines, resolve morning and afternoon,
apply construction, study and production, mature or harvest coffee, apply the
season event, feed the families, update stock, wood, money, morale and
population, process arrivals, report and advance. The season controls frost and
drought, not a second simulation. A coffee work period covers four cells (eight
pés); two periods cover the 4×2 lot. Educated adults count as two units for
coffee and construction and add one food to each yard period. Coffee is
harvested in autumn and goes into stock; each terreiro holds 16 sacks, a tulha
adds 6, and harvest above the room is lost. Stock is sold manually at the
current price (a venda adds 1); the weekly report records sacks sold, sale
revenue and closing stock. Yard work yields food per period; families eat two
units per week; surplus is sold; hunger reduces morale. Frost damages mature
coffee and drought reduces yard output in the last week of their seasons.
Families leave at morale 0 and the farm is lost when no family remains.

Construction costs coins and wood and takes work periods; the site keeps its
progress and is drawn as a generic canteiro in three stages. A new farm starts
with 4 wood; clearing one forest tile yields 2 wood, wood can also be bought at
the market for 1 coin each, and planting one coffee cell costs 1 coin. Houses
and terreiros can be repeated; a tulha, a venda, an escola and a capela are
unique. The chain is tulha after terreiro, venda after tulha, escola after venda
and capela after escola.

Coffee inputs are fertilizer and limestone. Each lot can receive one of each
per crop: fertilizer adds 20 soil quality and one sack per harvested cell;
limestone adds 20 quality. Quality is 40 at base and grades as bad below 50,
medium from 50 to 69 and good at 70 or above. Bad sells for one less than base,
medium at base and good for one more; a venda adds one more. Harvested stock is
kept in the three grade piles and sold separately; the terreiro and tulha
capacity applies to the total.

A new coffee lot is a 4×2 order that needs 16 seedlings, bought as four-seedling
bundles for one coin. The order consumes two adult periods, four cells each,
before becoming a muda lot. Weekly history records coins, income, expenses and
harvest/stock by grade, and the Reports page draws the financial and production
lines. The interface uses a bottom book navigation with Families, Works, Coffee,
Market and Reports pages.

Roads are visually planned with the Road tool and saved as a queue. An adult
assigned to Road builds up to four queued tiles per week, regardless of whether
the adult is assigned in one or both periods. Roads cost no coins or wood and
do not gate construction. The school currently educates without a teacher or
staff; staffed institutions are the next stage. The game ends at week 48: the
farm wins if it has six families, a chapel, a school, a shop and morale of at
least 2; otherwise it ends. Saves use `sitio-save` v21 (`.sitio.json`); v20 and
earlier must start a new farm.

## Mata

Mata is a 16×16 grove. The player spends seeds to plant five species and cistern
water to irrigate; the engine ticks moisture, nutrients, soil, shade, fauna and
health. Light is `255 - shade` with a min/max window per species: grass needs sun,
ferns need shade, Ingá feeds neighbors, cactus holds the dry. Adults return a seed
on a fixed interval. A drought is announced on tick 24, runs from 32 to 44, and
then the grove is judged won or lost. Saves use `mata-save` v2 (`.mata.json`); v1
files migrate in health, bag and cistern.

## Determinism

Horta, Posto, Mata and Sítio compile with `lib: ["ES2023"]` and no ambient types, so any
accidental use of DOM or Node APIs fails the type check. ESLint additionally bans
`Math.random`, `Date`, `window` and `document` inside those packages and inside
`packages/kernel`. Every random decision uses the kernel RNG, in a deterministic order.
React components send commands and read state. The renderer never mutates simulation state.
