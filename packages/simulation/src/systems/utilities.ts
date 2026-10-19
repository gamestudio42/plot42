import {
  Infra,
  PLACEABLE_SPECS,
  ZONE_SPECS,
  ZoneType,
  isZoneKind,
  type BuildingRecord,
  type UtilityStats,
} from '@city/shared';
import type { SimulationEngine } from '../engine';
import type { World } from '../world/world';

export interface UtilityResult extends UtilityStats {
  /** True when some consumer in a supplied component went unserved. */
  shortage: boolean;
}

interface NetworkSpec {
  conductor(i: number): boolean;
  supply(b: BuildingRecord): number;
  demand(b: BuildingRecord): number;
  /** Adjusts the computed layer before it is written to the world. */
  postProcess?(next: Uint8Array): void;
}

export function powerDemand(b: BuildingRecord): number {
  if (isZoneKind(b.kind)) return b.abandoned ? 0 : (ZONE_SPECS[b.kind].power[b.level] ?? 0);
  return PLACEABLE_SPECS[b.kind].powerUse;
}

export function waterDemand(b: BuildingRecord): number {
  if (isZoneKind(b.kind)) return b.abandoned ? 0 : (ZONE_SPECS[b.kind].water[b.level] ?? 0);
  return 0;
}

export function powerSupply(b: BuildingRecord): number {
  if (isZoneKind(b.kind) || b.offline > 0) return 0;
  return PLACEABLE_SPECS[b.kind].powerSupply;
}

export function pumpNearWater(world: World, b: BuildingRecord): boolean {
  for (let y = b.y - 1; y <= b.y + b.h; y++) {
    for (let x = b.x - 1; x <= b.x + b.w; x++) {
      if (world.inBounds(x, y) && world.isWater(world.index(x, y))) return true;
    }
  }
  return false;
}

export function waterSupply(world: World, b: BuildingRecord): number {
  if (b.kind !== 'waterPump' || !b.powered || b.offline > 0) return 0;
  const spec = PLACEABLE_SPECS.waterPump;
  return pumpNearWater(world, b) ? spec.waterSupplyNearWater : spec.waterSupply;
}

/**
 * Recomputes power, then water (pumps need power). With `write` it updates the `powered` /
 * `watered` layers and building flags; without it only the summary is computed.
 */
export function updateUtilities(
  engine: SimulationEngine,
  write = true,
): { power: UtilityResult; water: UtilityResult } {
  const w = engine.world;
  const power = solve(
    engine,
    write,
    'powered',
    (b) => b.powered,
    (b, on) => (b.powered = on),
    {
      conductor: (i) =>
        w.hasInfra(i, Infra.PowerLine) ||
        (w.buildingId[i] as number) !== 0 ||
        (w.zone[i] as number) !== ZoneType.None,
      supply: powerSupply,
      demand: powerDemand,
    },
  );
  const water = solve(
    engine,
    write,
    'watered',
    (b) => b.watered,
    (b, on) => (b.watered = on),
    {
      conductor: (i) => w.hasInfra(i, Infra.Pipe) || (w.buildingId[i] as number) !== 0,
      supply: (b) => waterSupply(w, b),
      demand: waterDemand,
      postProcess: (next) => spreadWaterToEmptyZones(w, next),
    },
  );
  return { power, water };
}

function solve(
  engine: SimulationEngine,
  write: boolean,
  layer: 'powered' | 'watered',
  getServed: (b: BuildingRecord) => boolean,
  setServed: (b: BuildingRecord, on: boolean) => void,
  spec: NetworkSpec,
): UtilityResult {
  const w = engine.world;
  const size = w.size;
  const next = new Uint8Array(w.tileCount);
  const visited = new Uint8Array(w.tileCount);
  const served = new Map<number, boolean>();
  const queue = new Int32Array(w.tileCount);
  const result: UtilityResult = { supply: 0, demand: 0, served: 0, shortage: false };
  let consumers = 0;
  let servedConsumers = 0;

  for (const source of engine.buildings.values()) {
    if (spec.supply(source) <= 0) continue;
    const start = w.index(source.x, source.y);
    if (visited[start] === 1) continue;
    // Breadth-first discovery from the source footprint.
    let tail = 0;
    for (const t of engine.buildings.footprint(source)) {
      visited[t] = 1;
      queue[tail++] = t;
    }
    const seen = new Set<number>();
    const order: BuildingRecord[] = [];
    const firstTile = new Map<number, number>();
    let supply = 0;
    for (let head = 0; head < tail; head++) {
      const t = queue[head] as number;
      const id = w.buildingId[t] as number;
      if (id !== 0 && !seen.has(id)) {
        seen.add(id);
        const b = engine.buildings.get(id);
        if (b) {
          supply += spec.supply(b);
          order.push(b);
          firstTile.set(id, head);
        }
      }
      const tx = t % size;
      const ty = (t / size) | 0;
      if (ty > 0)
        tail = enqueue(w, spec, visited, queue, tail, t - size, ty > 1 ? t - 2 * size : -1);
      if (tx < size - 1)
        tail = enqueue(w, spec, visited, queue, tail, t + 1, tx < size - 2 ? t + 2 : -1);
      if (ty < size - 1)
        tail = enqueue(w, spec, visited, queue, tail, t + size, ty < size - 2 ? t + 2 * size : -1);
      if (tx > 0) tail = enqueue(w, spec, visited, queue, tail, t - 1, tx > 1 ? t - 2 : -1);
    }
    // Nearest-first allocation; the first consumer that does not fit cuts off the rest.
    let remaining = supply;
    let cutoff = Number.POSITIVE_INFINITY;
    for (const b of order) {
      const demand = spec.demand(b);
      const isSource = spec.supply(b) > 0;
      if (demand > 0 && !isSource) {
        consumers++;
        result.demand += demand;
      }
      if (isSource || (cutoff === Number.POSITIVE_INFINITY && remaining >= demand)) {
        remaining -= isSource ? 0 : demand;
        served.set(b.id, true);
        if (demand > 0 && !isSource) servedConsumers++;
      } else {
        served.set(b.id, false);
        if (cutoff === Number.POSITIVE_INFINITY) cutoff = firstTile.get(b.id) as number;
        result.shortage = true;
      }
    }
    result.supply += supply;
    for (let k = 0; k < tail; k++) {
      const t = queue[k] as number;
      const id = w.buildingId[t] as number;
      next[t] = id !== 0 ? (served.get(id) ? 1 : 0) : k < cutoff ? 1 : 0;
    }
  }

  for (const b of engine.buildings.values()) {
    const on = served.get(b.id) ?? false;
    if (write && getServed(b) !== on) {
      setServed(b, on);
      engine.buildings.touch(b);
    }
    if (spec.demand(b) > 0 && spec.supply(b) <= 0 && !served.has(b.id)) {
      consumers++;
      result.demand += spec.demand(b);
    }
  }
  result.served = consumers === 0 ? 1 : servedConsumers / consumers;
  if (!write) return result;
  spec.postProcess?.(next);
  for (let i = 0; i < w.tileCount; i++) w.setLayer(layer, i, next[i] as number);
  return result;
}

/**
 * Enqueues neighbour `n`; when `n` is a plain road tile, conduction jumps over it to `beyond`
 * (zones and buildings on both sides of a street stay connected).
 */
function enqueue(
  w: World,
  spec: NetworkSpec,
  visited: Uint8Array,
  queue: Int32Array,
  tail: number,
  n: number,
  beyond: number,
): number {
  if (visited[n] === 1) return tail;
  if (spec.conductor(n)) {
    visited[n] = 1;
    queue[tail] = n;
    return tail + 1;
  }
  if (beyond < 0 || visited[beyond] === 1 || !w.hasInfra(n, Infra.Road) || !spec.conductor(beyond))
    return tail;
  visited[beyond] = 1;
  queue[tail] = beyond;
  return tail + 1;
}

/** Empty zoned tiles count as watered when an orthogonal neighbour is watered. */
function spreadWaterToEmptyZones(w: World, next: Uint8Array): void {
  const size = w.size;
  const add: number[] = [];
  for (let i = 0; i < w.tileCount; i++) {
    if (
      (w.zone[i] as number) === ZoneType.None ||
      (w.buildingId[i] as number) !== 0 ||
      next[i] === 1
    )
      continue;
    const x = i % size;
    const y = (i / size) | 0;
    if (
      (y > 0 && next[i - size] === 1) ||
      (x < size - 1 && next[i + 1] === 1) ||
      (y < size - 1 && next[i + size] === 1) ||
      (x > 0 && next[i - 1] === 1)
    ) {
      add.push(i);
    }
  }
  for (const i of add) next[i] = 1;
}
