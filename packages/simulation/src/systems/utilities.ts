import {
  Infra,
  PLACEABLE_SPECS,
  ZONE_SPECS,
  ZoneType,
  isZoneKind,
  type BuildingRecord,
  type PlaceableKind,
  type UtilityStats,
} from '@city/shared';
import type { SimulationEngine } from '../engine';
import type { World } from '../world/world';
import { hubJobs } from './demand';

export interface UtilityResult extends UtilityStats {
  /** True when some consumer in a supplied component went unserved. */
  shortage: boolean;
}

interface NetworkSpec {
  /** 1 on tiles that carry the network. */
  conductors: Uint8Array;
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
  if (isZoneKind(b.kind) || !b.powered || b.offline > 0) return 0;
  const spec = PLACEABLE_SPECS[b.kind];
  if (spec.waterSupply <= 0 && spec.waterSupplyNearWater <= 0) return 0;
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
  const infra = w.structure.infra;
  const zone = w.zone;
  const buildingId = w.buildingId;
  const powerConductors = new Uint8Array(w.tileCount);
  const waterConductors = new Uint8Array(w.tileCount);
  for (let i = 0; i < w.tileCount; i++) {
    const flags = infra[i] as number;
    const built = (buildingId[i] as number) !== 0;
    if (built || (flags & Infra.PowerLine) !== 0 || (zone[i] as number) !== ZoneType.None)
      powerConductors[i] = 1;
    if (built || (flags & Infra.Pipe) !== 0) waterConductors[i] = 1;
  }
  const power = solve(
    engine,
    write,
    'powered',
    (b) => b.powered,
    (b, on) => (b.powered = on),
    { conductors: powerConductors, supply: powerSupply, demand: powerDemand },
  );
  const water = solve(
    engine,
    write,
    'watered',
    (b) => b.watered,
    (b, on) => (b.watered = on),
    {
      conductors: waterConductors,
      supply: (b) => waterSupply(w, b),
      demand: waterDemand,
      postProcess: (next) => spreadWaterToEmptyZones(w, next),
    },
  );
  if (write) updateHubJobs(engine);
  return { power, water };
}

/** Sets hub capacity to its current job count and occupancy to it while the hub operates. */
function updateHubJobs(engine: SimulationEngine): void {
  let residents = 0;
  const operating = new Map<string, number>();
  const hubs: BuildingRecord[] = [];
  for (const b of engine.buildings.values()) {
    if (isZoneKind(b.kind)) {
      if (b.kind === 'residential' && !b.abandoned) residents += b.occupancy;
      continue;
    }
    if (PLACEABLE_SPECS[b.kind].jobs <= 0) continue;
    hubs.push(b);
    if (b.powered && b.offline === 0) operating.set(b.kind, (operating.get(b.kind) ?? 0) + 1);
  }
  for (const b of hubs) {
    const spec = PLACEABLE_SPECS[b.kind as PlaceableKind];
    b.capacity = hubJobs(spec, residents, operating.get(b.kind) ?? 0);
    b.occupancy = b.powered && b.offline === 0 ? b.capacity : 0;
  }
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
  const count = w.tileCount;
  const conductors = spec.conductors;
  const infra = w.structure.infra;
  const buildingId = w.buildingId;
  const next = new Uint8Array(w.tileCount);
  const visited = new Uint8Array(w.tileCount);
  // Per building id: footprints are contiguous conductors, so each building joins one component.
  const state = new Uint8Array(engine.buildings.nextId);
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
    for (let y = source.y; y < source.y + source.h; y++) {
      for (let x = source.x; x < source.x + source.w; x++) {
        const t = y * size + x;
        visited[t] = 1;
        queue[tail++] = t;
      }
    }
    const order: BuildingRecord[] = [];
    const firstTile: number[] = [];
    let supply = 0;
    for (let head = 0; head < tail; head++) {
      const t = queue[head] as number;
      const id = buildingId[t] as number;
      if (id !== 0 && state[id] === UNREACHED) {
        const b = engine.buildings.get(id);
        if (b) {
          state[id] = UNSERVED;
          supply += spec.supply(b);
          order.push(b);
          firstTile.push(head);
        }
      }
      // Row bounds compare the index directly; only the column needs a division.
      const tx = t % size;
      if (t >= size)
        tail = enqueue(
          conductors,
          infra,
          visited,
          queue,
          tail,
          t - size,
          t >= 2 * size ? t - 2 * size : -1,
        );
      if (tx < size - 1)
        tail = enqueue(conductors, infra, visited, queue, tail, t + 1, tx < size - 2 ? t + 2 : -1);
      if (t < count - size)
        tail = enqueue(
          conductors,
          infra,
          visited,
          queue,
          tail,
          t + size,
          t < count - 2 * size ? t + 2 * size : -1,
        );
      if (tx > 0)
        tail = enqueue(conductors, infra, visited, queue, tail, t - 1, tx > 1 ? t - 2 : -1);
    }
    // Nearest-first allocation; the first consumer that does not fit cuts off the rest.
    let remaining = supply;
    let cutoff = Number.POSITIVE_INFINITY;
    for (let k = 0; k < order.length; k++) {
      const b = order[k] as BuildingRecord;
      const demand = spec.demand(b);
      const isSource = spec.supply(b) > 0;
      if (demand > 0 && !isSource) {
        consumers++;
        result.demand += demand;
      }
      if (isSource || (cutoff === Number.POSITIVE_INFINITY && remaining >= demand)) {
        remaining -= isSource ? 0 : demand;
        state[b.id] = SERVED;
        if (demand > 0 && !isSource) servedConsumers++;
      } else {
        if (cutoff === Number.POSITIVE_INFINITY) cutoff = firstTile[k] as number;
        result.shortage = true;
      }
    }
    result.supply += supply;
    for (let k = 0; k < tail; k++) {
      const t = queue[k] as number;
      const id = buildingId[t] as number;
      next[t] = id !== 0 ? (state[id] === SERVED ? 1 : 0) : k < cutoff ? 1 : 0;
    }
  }

  for (const b of engine.buildings.values()) {
    const reached = state[b.id] as number;
    const on = reached === SERVED;
    if (write && getServed(b) !== on) {
      setServed(b, on);
      engine.buildings.touch(b);
    }
    if (reached === UNREACHED) {
      const demand = spec.demand(b);
      if (demand > 0 && spec.supply(b) <= 0) {
        consumers++;
        result.demand += demand;
      }
    }
  }
  result.served = consumers === 0 ? 1 : servedConsumers / consumers;
  if (!write) return result;
  spec.postProcess?.(next);
  const data = w.structure[layer];
  for (let i = 0; i < w.tileCount; i++) {
    const v = next[i] as number;
    if (data[i] !== v) {
      data[i] = v;
      w.markDirty(i);
    }
  }
  return result;
}

const UNREACHED = 0;
const UNSERVED = 1;
const SERVED = 2;

/**
 * Enqueues neighbour `n`; when `n` is a plain road tile, conduction jumps over it to `beyond`
 * (zones and buildings on both sides of a street stay connected).
 */
function enqueue(
  conductors: Uint8Array,
  infra: Uint8Array,
  visited: Uint8Array,
  queue: Int32Array,
  tail: number,
  n: number,
  beyond: number,
): number {
  if (visited[n] === 1) return tail;
  if (conductors[n] === 1) {
    visited[n] = 1;
    queue[tail] = n;
    return tail + 1;
  }
  if (
    beyond < 0 ||
    visited[beyond] === 1 ||
    ((infra[n] as number) & Infra.Road) === 0 ||
    conductors[beyond] !== 1
  )
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
