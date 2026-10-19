import { BALANCE, PLACEABLE_SPECS, ZONE_SPECS, isZoneKind } from '@city/shared';
import type { SimulationEngine } from '../engine';
import type { World } from '../world/world';
import type { RoadNetwork } from './roads';

/** Separable box blur with clamped edges (averages only in-bounds samples). */
export function boxBlur(src: Float32Array, size: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < size; y++) {
    const row = y * size;
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let n = 0;
      for (let k = Math.max(0, x - radius); k <= Math.min(size - 1, x + radius); k++) {
        sum += src[row + k] as number;
        n++;
      }
      tmp[row + x] = sum / n;
    }
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      let sum = 0;
      let n = 0;
      for (let k = Math.max(0, y - radius); k <= Math.min(size - 1, y + radius); k++) {
        sum += tmp[k * size + x] as number;
        n++;
      }
      out[y * size + x] = sum / n;
    }
  }
  return out;
}

function toByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
}

/** Tiles within Chebyshev `radius` of any park, with distance (255 = none). */
function parkDistance(engine: SimulationEngine, radius: number): Uint8Array {
  const w = engine.world;
  const dist = new Uint8Array(w.tileCount).fill(255);
  for (const b of engine.buildings.values()) {
    if (b.kind !== 'park') continue;
    for (let y = b.y - radius; y < b.y + b.h + radius; y++) {
      for (let x = b.x - radius; x < b.x + b.w + radius; x++) {
        if (!w.inBounds(x, y)) continue;
        const d = Math.max(
          Math.max(b.x - x, x - (b.x + b.w - 1), 0),
          Math.max(b.y - y, y - (b.y + b.h - 1), 0),
        );
        const i = w.index(x, y);
        if (d < (dist[i] as number)) dist[i] = d;
      }
    }
  }
  return dist;
}

/** Chebyshev distance to the nearest water tile, capped at `cap` (multi-source BFS). */
function waterDistance(w: World, cap: number): Uint8Array {
  const size = w.size;
  const dist = new Uint8Array(w.tileCount).fill(255);
  const queue = new Int32Array(w.tileCount);
  let tail = 0;
  for (let i = 0; i < w.tileCount; i++) {
    if (w.isWater(i)) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  for (let head = 0; head < tail; head++) {
    const t = queue[head] as number;
    const d = dist[t] as number;
    if (d >= cap) continue;
    const tx = t % size;
    const ty = (t / size) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const n = ny * size + nx;
        if ((dist[n] as number) !== 255) continue;
        dist[n] = d + 1;
        queue[tail++] = n;
      }
    }
  }
  return dist;
}

/** Monthly: pollution, then land value (using last month's crime), then crime. */
export function updateInfluence(engine: SimulationEngine, roads: RoadNetwork): void {
  const w = engine.world;
  const size = w.size;
  const inf = w.influence;
  const cfg = BALANCE.influence;
  const parks = parkDistance(engine, BALANCE.services.parkRadius);

  // Pollution sources.
  const sources = new Float32Array(w.tileCount);
  for (const b of engine.buildings.values()) {
    const value = isZoneKind(b.kind)
      ? b.abandoned
        ? 0
        : ZONE_SPECS[b.kind].pollution * b.level
      : PLACEABLE_SPECS[b.kind].pollution;
    if (value <= 0) continue;
    for (const i of engine.buildings.footprint(b)) sources[i] = (sources[i] as number) + value;
  }
  for (let i = 0; i < w.tileCount; i++) {
    sources[i] = (sources[i] as number) + cfg.pollution.trafficFactor * (inf.traffic[i] as number);
    if ((w.fire[i] as number) > 0) sources[i] = (sources[i] as number) + cfg.pollution.fire;
  }
  const blurred = boxBlur(boxBlur(sources, size, 2), size, 2);
  for (let i = 0; i < w.tileCount; i++) {
    let p =
      cfg.pollution.gain * (blurred[i] as number) -
      cfg.pollution.treeReduction * (w.trees[i] as number);
    if ((parks[i] as number) <= 3) p -= cfg.pollution.parkReduction;
    inf.pollution[i] = toByte(p);
  }

  // Land value.
  const lv = cfg.landValue;
  const water = waterDistance(w, lv.waterRadius);
  const centre = populationCentre(engine);
  const raw = new Float32Array(w.tileCount);
  for (let i = 0; i < w.tileCount; i++) {
    if (w.isWater(i)) continue;
    const x = i % size;
    const y = (i / size) | 0;
    let v = lv.base;
    if ((water[i] as number) <= lv.waterRadius) v += lv.waterBonus;
    v += lv.perElevation * w.elevation(x, y);
    v += lv.perTree * (w.trees[i] as number);
    const pd = parks[i] as number;
    if (pd !== 255) v += BALANCE.services.parkValue * (1 - pd / (BALANCE.services.parkRadius + 1));
    v += lv.education * (inf.education[i] as number) + lv.health * (inf.health[i] as number);
    v += lv.police * (inf.police[i] as number);
    if (roads.hasAccess(i)) v += lv.roadAccess;
    if (centre)
      v += Math.max(0, lv.centerBonus - (Math.abs(x - centre.x) + Math.abs(y - centre.y)) / 2);
    v -=
      lv.pollution * (inf.pollution[i] as number) +
      lv.crime * (inf.crime[i] as number) +
      lv.traffic * (inf.traffic[i] as number);
    raw[i] = v;
  }
  const lvBlur = boxBlur(raw, size, 1);
  for (let i = 0; i < w.tileCount; i++)
    inf.landValue[i] = w.isWater(i) ? 0 : toByte(lvBlur[i] as number);

  // Crime on developed tiles.
  const cr = cfg.crime;
  const crime = new Float32Array(w.tileCount);
  for (const b of engine.buildings.values()) {
    if (b.kind === 'park') continue;
    for (const i of engine.buildings.footprint(b)) {
      const v =
        cr.base +
        cr.perLevel * b.level +
        (b.abandoned ? cr.abandoned : 0) +
        (128 - (inf.landValue[i] as number)) / 2 -
        cr.police * (inf.police[i] as number);
      crime[i] = Math.max(0, v);
    }
  }
  const crimeBlur = boxBlur(crime, size, 1);
  for (let i = 0; i < w.tileCount; i++) inf.crime[i] = toByte(crimeBlur[i] as number);
  w.influenceDirty = true;
}

/** Occupancy-weighted centroid of residential buildings, rounded to a tile. */
export function populationCentre(engine: SimulationEngine): { x: number; y: number } | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const b of engine.buildings.values()) {
    if (b.kind !== 'residential' || b.abandoned || b.occupancy <= 0) continue;
    sx += b.x * b.occupancy;
    sy += b.y * b.occupancy;
    n += b.occupancy;
  }
  return n === 0 ? null : { x: Math.round(sx / n), y: Math.round(sy / n) };
}
