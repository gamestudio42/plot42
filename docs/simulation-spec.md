# Simulation specification

This document defines the rules of the engine. Every numeric constant lives in
`packages/shared/src/balance/balance.ts`; the values quoted here are the initial calibration.
Each rule is classified in [mechanics-matrix.md](mechanics-matrix.md).

Notation: `clamp(v, a, b)`, all normalized inputs are in `[0, 1]` unless stated otherwise.
Byte maps (0..255) are normalized by dividing by 255.

## 1. World and terrain

- Grid `size × size` (default 128). Tile `(x, y)` has four corners: north `(x, y)`, east
  `(x + 1, y)`, south `(x + 1, y + 1)`, west `(x, y + 1)` in vertex coordinates.
- Vertex heights are integers `0..MAX_HEIGHT` (12). Adjacent vertices differ by at most 1.
- A tile is **flat** when its four corners are equal; its **elevation** is its lowest corner.
- Terrain generation (seeded): three octaves of value noise for height, a moisture noise for
  forests, one or two rivers carved by a seeded random walk, sea level by percentile, then a
  relaxation pass to enforce the slope constraint. Water tiles have all corners at height 0.
- Rules:
  - Water blocks zones and buildings. Roads over water are bridges (higher cost); power
    lines may cross water; pipes are underground and may cross anything.
  - Zones and buildings need flat tiles (all footprint tiles flat and at the same height).
  - Roads, power lines and pipes accept flat tiles and simple slopes (`max − min ≤ 1`).
  - The level tool flattens a rectangle to the height of the drag start tile and propagates
    the slope constraint outwards; it is refused if a neighbour with construction would change.

## 2. Construction

Commands are validated tile by tile. Invalid tiles are skipped and reported with the most
frequent `RejectReason`. If the total cost exceeds the funds, the whole command is refused.
Construction never makes funds negative. A bankrupt city cannot build.

| Tool       | Shape     | Notes                                                    |
| ---------- | --------- | -------------------------------------------------------- |
| Road       | L-path    | Clears trees. Bridge on water.                           |
| Power line | L-path    | May share a tile with a road.                            |
| Water pipe | L-path    | Underground layer, independent of the surface.           |
| Zone       | Rectangle | R/C/I, light or dense. Re-zoning needs an empty tile.    |
| Building   | Point     | Plants, pump, services, park. Footprint must be valid.   |
| Demolish   | Rectangle | Removes whole buildings, networks, zones, trees, rubble. |
| Level      | Rectangle | Cost per vertex height unit changed.                     |

Roads choose their sprite from a 4-bit mask of orthogonal road neighbours (auto-tiling).

## 3. Buildings

Zone buildings are 1×1 aggregated buildings: `level 1..5`, `capacity`, `occupancy`,
`condition 0..100`, `age` (months), `abandoned`.

| Level | Residents | Commercial jobs | Industrial jobs |
| ----- | --------- | --------------- | --------------- |
| 1     | 10        | 4               | 8               |
| 2     | 30        | 12              | 20              |
| 3     | 80        | 30              | 45              |
| 4     | 180       | 70              | 90              |
| 5     | 400       | 150             | 160             |

- Light zones cap at level 2, dense zones at level 5.
- Without water service a building caps at level 2.

## 4. Demand (RCI), monthly

Inputs: residents `P`, workforce `W = 0.45 · P`, job capacity `Jc`, `Ji`, housing capacity `Hc`,
tax rates `tR, tC, tI` (percent), tax pressure `T(t) = (t − 7) / 13`.

Residential (blueprint hypothesis `D_R = clamp(a1·J + a2·Q − a3·T − a4·H)`):

```
J  = clamp((Jc + Ji + EXTERNAL_JOBS − W) / max(W, 50), −1, 1)
Q  = mean over developed residential tiles of (landValue − pollution − crime) / 255 − 0.15
     (0 while no residential building exists)
H  = max(0, (Hc − P) / max(Hc, 1) − 0.10)          (10% natural vacancy is tolerated)
DR = clamp(0.7·J + 0.3·Q − 0.5·T(tR) − 0.6·H, −1, 1)
```

Commercial:

```
labor  = clamp((W − (Jc + Ji)) / max(W, 20), −1, 1)
market = (0.20·P + 0.05·Ji + 2 − Jc) / max(0.20·P + 0.05·Ji + 2, Jc, 10)
DC     = clamp(0.8·market + 0.3·labor − 0.5·T(tC), −1, 1)
```

Industrial (external market grows with the city; a road on the map edge adds a regional bonus
of 0.1):

```
market = (30 + 0.25·P − Ji) / max(30 + 0.25·P, Ji, 10)
DI     = clamp(0.8·market·crisis + 0.4·labor − 0.5·T(tI) + edgeBonus, −1, 1)
```

The per-capita market factors (0.20 and 0.25) are tuned so that a balanced city keeps roughly
one job per resident in the workforce; lower values stall residential demand on `J`.

Smoothing: `demand ← demand + 0.5 · (target − demand)` every month.

## 5. Attractiveness, monthly per zone tile

```
residential = 0.25·access + 0.20·landValue + 0.15·services + 0.15·power + 0.10·water
            + 0.15·transport − 0.25·pollution − 0.20·crime
commercial  = 0.25·access + 0.20·landValue + 0.15·transport + 0.15·power + 0.10·water
            + 0.10·services + 0.05 − 0.15·crime − 0.10·pollution
industrial  = 0.25·access + 0.20·transport + 0.20·power + 0.05·water + 0.10·(1 − landValue)
            + 0.10·fireCover + 0.10 − 0.10·crime
```

- `access` is zone-specific (section 7): job access for R, customers for C, workers for I.
- `transport` is 1.0 / 0.7 / 0.4 for a road within 1 / 2 / 3 tiles (Chebyshev), multiplied by
  `1 − 0.5 · congestion` of that road, and 0 without road access.
- `services`: R uses the mean of police, fire, health and education coverage; C uses police
  and fire.

## 6. Growth, monthly per zone tile

Requirements for any development: road within 3 tiles and power.

- **Empty zone:** if `D > 0`, spawn a level-1 building with probability `0.5 · D · A`.
- **Occupancy:** target `= capacity · clamp(0.6 + 0.4·A + 0.5·D, 0, 1) · epidemic` for
  residential; job buildings use `capacity · clamp(laborRatio, 0, 1) · clamp(0.6 + 0.4·A, 0, 1)`
  with `laborRatio = (W + 10) / max(Jc + Ji, 1)`. Occupancy moves 35% of the gap per month
  (rounded away from zero, so it always converges). Without power or road the target is 0.
- **Upgrade:** occupancy ≥ 80%, `D > 0.02`, `A ≥ threshold(level)` (0.30, 0.45, 0.55, 0.65)
  and level below the cap: probability `0.25 · clamp(0.3 + 2·D, 0, 1)`. The bias keeps
  growing cities densifying while demand hovers near zero.
- **Downgrade:** occupancy < 30%, `D < −0.2`, level > 1: probability 0.2.
- **Decay:** condition −10 per month when `A < 0.15`, unpowered or without road; +5 otherwise.
  Condition 0, or six months empty, abandons the building.
- **Recovery:** an abandoned building with `A ≥ 0.35` and `D > 0.2` is restored at level 1 with
  probability 0.1.

## 7. Roads, accessibility and traffic, monthly

1. Road tiles form a graph with orthogonal edges; connected components are labelled by BFS.
2. Each tile gets an access road: a multi-source BFS over the 8-neighbourhood starting from
   all road tiles in index order, limited to Chebyshev distance 3. Ties go to the road reached
   first, which keeps the result deterministic. Roads are recomputed lazily, only when the
   world's `roadVersion` changes.
3. Per component: residents, workforce, commercial and industrial jobs, edge connection.
   A component touching the map edge counts as a source of external jobs and workers (the
   neighbouring region), so edge roads also seed the Dijkstra below.
4. Multi-source Dijkstra from job sites (C and I access roads) and from homes (R access roads).
   Edge cost `1 + 2 · max(0, congestion − 0.6)²` using last month's congestion. Ties are broken
   by tile index.
5. Distance decay: `1` up to 15 road tiles, linear to 0 at 50.
6. Access values:
   - R: `clamp((jobs + external) / max(workforce, 1)) · decay(distance to jobs)`
   - C: `clamp(0.12 · residents / max(commercial jobs, 4)) · decay(distance to homes)`
   - I: `clamp(workforce / max(jobs, 10)) · decay(distance to homes)`
7. Trip assignment: each residential building sends `0.45 · occupancy` commuters to its nearest
   job site and `0.25 · occupancy` shoppers to its nearest commercial site, following the
   Dijkstra parent pointers. Flow accumulates per road tile.
8. Congestion `= flow / capacity`, capacity `= 120 · (0.5 + 0.5 · transportFunding)`. The traffic
   map stores `min(255, congestion · 128)`.

## 8. Power and water

Conductors:

- Power: power lines, building footprints and zoned tiles. Laying a power line on a zone or a
  building is refused with `ALREADY_BUILT`, because those tiles already conduct.
- Water: pipes and building footprints. Pumps only run when powered.
- Conduction jumps over a single plain road tile between two conductors (a road with no line
  or pipe on it). This mirrors the classic behaviour where a street between two blocks does
  not break the grid; two or more road tiles in a row do.
- Empty zoned tiles orthogonally adjacent to a watered tile are marked watered, so a growing
  block can draw water before its first building appears.

For each component (flood fill from the plant or pump with the lowest building id): supply
is the sum of capacities; consumers are served in BFS discovery order until the first one
that does not fit (explicit nearest-first policy). That consumer and every later one are
unserved, which makes brownouts spread from the far end of the network.

| Element    | Power              | Water                                    |
| ---------- | ------------------ | ---------------------------------------- |
| Coal plant | +800 (3×3)         | –                                        |
| Gas plant  | +400 (2×2)         | –                                        |
| Wind       | +60 (1×1)          | –                                        |
| Pump       | −10                | +400 next to water, +150 otherwise (2×2) |
| Res L1..L5 | −1, 2, 4, 7, 12    | −2, 4, 9, 18, 36                         |
| Com L1..L5 | −3, 6, 10, 16, 25  | −2, 5, 10, 18, 30                        |
| Ind L1..L5 | −6, 12, 18, 25, 35 | −4, 8, 14, 20, 28                        |

Networks rebuild immediately after a command and at the start of every day. Network state is
derived (not serialized): it is a pure function of the saved world, so loading a save does
not need to rebuild it to keep the state hash identical.

## 8.1 Clock

One tick is a quarter of a day; a month is 30 days (120 ticks). Each tick: queued commands run,
networks rebuild at the start of each day, per-tick systems run (fire), the tick counter
advances and, when it reaches a month boundary, the monthly pipeline closes the month that just
ended: roads → traffic → services → influence maps → totals → demand → growth → budget →
history.

## 9. Services and influence maps, monthly

- Stations (police, fire, school, hospital; 2×2) need a road within 1 tile of the footprint.
  Coverage spreads along roads from the access roads up to radius `R` (22, 20, 24, 26 road
  tiles) with strength `255 · funding · (powered ? 1 : 0.5) · (1 − d / R)`. Each tile takes the
  best road coverage within 2 tiles, minus 15% per tile of distance. Tiles within 3 tiles of the
  station get full strength.
- Parks raise land value within radius 4.
- **Pollution:** sources (industry `18·level`, coal 120, gas 50, commerce `3·level`, traffic
  `0.3·traffic`, fire 80) blurred twice with a 5×5 box filter and multiplied by a gain of 4
  (the blur spreads a source over 25 tiles), minus `4·trees` and 20 near parks.
- **Land value:** `60 + water proximity (30) + 3·elevation + 2·trees + parks + 0.1·(education +
health) + 0.05·police + 10·(road access) + city centre bonus max(0, 40 − d/2) − 0.5·pollution −
0.3·crime − 0.1·traffic`, blurred once. Water tiles are 0.
- **Crime** (developed tiles): `40 + 12·level + 90·abandoned + (128 − landValue)/2 − 0.6·police`,
  blurred once.

## 10. Economy, monthly

```
revenueR = Σ residents · (0.6 + landValue/255) · tR/100 · 3.0
revenueC = Σ commercial workers · (0.6 + landValue/255) · tC/100 · 4.0
revenueI = Σ industrial workers · tI/100 · 3.5
balance(t+1) = balance(t) + revenue − expenses
```

Expenses are monthly upkeep (roads 0.25/tile, bridges 1/tile, power lines 0.05/tile, pipes
0.05/tile, plants, pumps, stations, parks) multiplied by the department funding (transport,
police, fire, health, education; 0..100%). Power and water upkeep is fixed.

Debt: every month with a negative balance increments `monthsInDebt`; twelve consecutive months
declare bankruptcy (no construction until the balance is positive again).

## 11. Events and disasters

- **Fire** (tick): intensity grows by 1 per tick; at 100 the tile burns out (building → rubble,
  trees removed). Each tick, every orthogonal flammable neighbour (building or trees) ignites
  with probability `0.025 · (1 − 0.8 · cover)`. The fire is extinguished with probability
  `0.002 + 0.05 · cover`. Monthly random ignition per building: `0.0015 · (1 − cover)`.
- **Flood:** water spreads from a shore tile onto low land (≤ 1 level above the shore) for 30
  days; flooded buildings lose condition and may be destroyed.
- **Earthquake:** radius 20; buildings are destroyed or ignite, networks are cut, with
  probability decreasing with distance.
- **Economic crisis:** 12 months, `crisis = 0.6` in industrial demand, revenue × 0.8.
- **Blackout:** a random plant is offline for 30 days.
- **Epidemic:** 6 months; residential occupancy target × (0.85 + 0.15 · health coverage),
  commercial revenue × 0.85.
- Random disasters (if enabled): 1.5% per month.

## 12. Diagnostics

`diagnoseTile(world, buildings, stats, x, y)` returns problem codes ordered by severity:
`NO_ROAD`, `NO_POWER`, `BROWNOUT`, `NO_WATER_FOR_LEVEL`, `LOW_DEMAND`, `NO_JOB_ACCESS`,
`NO_CUSTOMERS`, `NO_WORKERS`, `POLLUTION`, `CRIME`, `LOW_LAND_VALUE`, `CONGESTION`,
`HIGH_TAXES`, `SLOPE`, `ABANDONED`, `ON_FIRE`, `RUBBLE`, `FLOODED`, `MAX_LEVEL`. The UI
translates each code into Portuguese.
