import {
  DIAG,
  DROUGHT_END_TICK,
  DROUGHT_START_TICK,
  MATURE_AGE,
  ORTHO,
  SPECIES_CACTUS,
  SPECIES_CROWN,
  SPECIES_EMPTY,
  SPECIES_FERN,
  SPECIES_GRASS,
  SPECIES_INGA,
  SPECIES_TRAITS,
  WIN_BALANCE,
  WIN_PLANTS,
  WIN_UNIQUE,
  droughtPhase,
  emptySeeds,
  type MataGrid,
  type MataOutcome,
  type MataStats,
  type PlantSpecies,
  type SeedBag,
  type SpeciesId,
  type TileFacts,
  type TileProblem,
  isPlantSpecies,
} from './types';

export function clamp8(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value | 0;
}

export function set8(layer: Uint8Array, index: number, value: number): void {
  layer[index] = clamp8(value);
}

export function add8(layer: Uint8Array, index: number, delta: number): void {
  set8(layer, index, (layer[index] as number) + delta);
}

export function inBounds(size: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size;
}

export function tileIndex(size: number, x: number, y: number): number {
  return y * size + x;
}

export function mean8(layer: Uint8Array): number {
  if (layer.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < layer.length; i++) sum += layer[i] as number;
  return (sum / layer.length) | 0;
}

export function tileLight(shade: number): number {
  return shade >= 255 ? 0 : 255 - shade;
}

export function computeShade(grid: MataGrid): Uint8Array {
  const { size } = grid;
  const shade = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = tileIndex(size, x, y);
      const species = grid.species[i] as SpeciesId;
      if (!isPlantSpecies(species) || (grid.age[i] as number) < MATURE_AGE) continue;
      const traits = SPECIES_TRAITS[species];
      add8(shade, i, traits.shadeSelf);
      if (traits.shadeOrtho > 0) {
        for (const [dx, dy] of ORTHO) {
          const nx = x + dx;
          const ny = y + dy;
          if (inBounds(size, nx, ny)) add8(shade, tileIndex(size, nx, ny), traits.shadeOrtho);
        }
      }
      if (traits.shadeDiag > 0) {
        for (const [dx, dy] of DIAG) {
          const nx = x + dx;
          const ny = y + dy;
          if (inBounds(size, nx, ny)) add8(shade, tileIndex(size, nx, ny), traits.shadeDiag);
        }
      }
    }
  }
  return shade;
}

/** Stress list used by both the engine (health) and the HUD inspector. */
export function tileProblems(grid: MataGrid, x: number, y: number, shade: number): TileProblem[] {
  if (!inBounds(grid.size, x, y)) return [];
  const i = tileIndex(grid.size, x, y);
  const species = grid.species[i] as SpeciesId;
  if (species === SPECIES_EMPTY || !isPlantSpecies(species)) return [{ code: 'bare', severity: 1 }];

  const problems: TileProblem[] = [];
  const moisture = grid.moisture[i] as number;
  const nutrients = grid.nutrients[i] as number;
  const age = grid.age[i] as number;
  const health = grid.health[i] as number;
  const light = tileLight(shade);
  const traits = SPECIES_TRAITS[species];

  if (moisture < traits.minWater) problems.push({ code: 'dry', severity: 3 });
  else if (moisture < traits.minWater + 20) problems.push({ code: 'dry', severity: 2 });

  if (traits.minNutrients > 0 && nutrients < traits.minNutrients) {
    problems.push({ code: 'starved', severity: 3 });
  } else if (traits.minNutrients > 0 && nutrients < traits.minNutrients + 16) {
    problems.push({ code: 'starved', severity: 2 });
  }

  if (light < traits.lightMin) problems.push({ code: 'too-shady', severity: 3 });
  else if (light < traits.lightMin + 16) problems.push({ code: 'too-shady', severity: 2 });
  if (light > traits.lightMax) problems.push({ code: 'too-sunny', severity: 3 });
  else if (light > traits.lightMax - 16 && traits.lightMax < 255) {
    problems.push({ code: 'too-sunny', severity: 2 });
  }

  if (age < MATURE_AGE) problems.push({ code: 'young', severity: 1 });
  if (health > 0 && health < 80) problems.push({ code: 'ailing', severity: 1 });
  return problems;
}

export function diagnoseTile(grid: MataGrid, x: number, y: number, shadeMap?: Uint8Array): TileFacts {
  const shade = shadeMap ?? computeShade(grid);
  const ok = inBounds(grid.size, x, y);
  const i = ok ? tileIndex(grid.size, x, y) : 0;
  const shadeHere = ok ? (shade[i] as number) : 0;
  return {
    x,
    y,
    species: ok ? (grid.species[i] as SpeciesId) : SPECIES_EMPTY,
    age: ok ? (grid.age[i] as number) : 0,
    moisture: ok ? (grid.moisture[i] as number) : 0,
    nutrients: ok ? (grid.nutrients[i] as number) : 0,
    soil: ok ? (grid.soil[i] as number) : 0,
    fauna: ok ? (grid.fauna[i] as number) : 0,
    shade: shadeHere,
    light: tileLight(shadeHere),
    health: ok ? (grid.health[i] as number) : 0,
    problems: tileProblems(grid, x, y, shadeHere),
  };
}

export function isFatal(problems: readonly TileProblem[]): boolean {
  for (const problem of problems) {
    if (problem.severity === 3) return true;
  }
  return false;
}

export function isStalled(problems: readonly TileProblem[]): boolean {
  for (const problem of problems) {
    if (problem.severity >= 2) return true;
  }
  return false;
}

function coverScore(planted: number, cells: number): number {
  if (cells <= 0 || planted <= 0) return 0;
  const pct = (planted * 100) / cells;
  if (pct <= 55) return ((pct * 100) / 55) | 0;
  if (pct <= 72) return 100;
  const over = pct - 72;
  const score = 100 - over * 2;
  return score < 0 ? 0 : score | 0;
}

function moistureScore(mean: number): number {
  const dist = mean > 140 ? mean - 140 : 140 - mean;
  const score = (100 - (dist * 100) / 140) | 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

export function collectCounts(grid: MataGrid): {
  planted: number;
  unique: number;
  grass: number;
  crown: number;
  fern: number;
  inga: number;
  cactus: number;
  maxShare: number;
} {
  let grass = 0;
  let crown = 0;
  let fern = 0;
  let inga = 0;
  let cactus = 0;
  for (let i = 0; i < grid.species.length; i++) {
    const species = grid.species[i] as SpeciesId;
    if (species === SPECIES_GRASS) grass++;
    else if (species === SPECIES_CROWN) crown++;
    else if (species === SPECIES_FERN) fern++;
    else if (species === SPECIES_INGA) inga++;
    else if (species === SPECIES_CACTUS) cactus++;
  }
  const planted = grass + crown + fern + inga + cactus;
  let unique = 0;
  if (grass) unique++;
  if (crown) unique++;
  if (fern) unique++;
  if (inga) unique++;
  if (cactus) unique++;
  let maxCount = grass;
  if (crown > maxCount) maxCount = crown;
  if (fern > maxCount) maxCount = fern;
  if (inga > maxCount) maxCount = inga;
  if (cactus > maxCount) maxCount = cactus;
  const maxShare = planted === 0 ? 0 : ((maxCount * 100) / planted) | 0;
  return { planted, unique, grass, crown, fern, inga, cactus, maxShare };
}

export function scoreBalance(grid: MataGrid): number {
  const cells = grid.size * grid.size;
  const counts = collectCounts(grid);
  const soil = mean8(grid.soil);
  const moisture = mean8(grid.moisture);
  const fauna = mean8(grid.fauna);
  const diversity = ((counts.unique * 22) / 5) | 0;
  const cover = (coverScore(counts.planted, cells) * 20) / 100;
  const soilPart = (soil * 20) / 255;
  const moistPart = (moistureScore(moisture) * 16) / 100;
  const faunaPart = fauna > 180 ? 16 : (fauna * 16) / 180;
  const mix = counts.unique >= 3 ? 6 : 0;
  let balance = (diversity + cover + soilPart + moistPart + faunaPart + mix) | 0;
  if (counts.planted > 0 && counts.maxShare >= 70) balance -= 25;
  if (balance < 0) return 0;
  if (balance > 100) return 100;
  return balance;
}

export function judgeGrove(grid: MataGrid): MataOutcome {
  const counts = collectCounts(grid);
  const balance = scoreBalance(grid);
  if (counts.planted >= WIN_PLANTS && counts.unique >= WIN_UNIQUE && balance >= WIN_BALANCE) {
    return 'won';
  }
  return 'lost';
}

export function collectStats(
  grid: MataGrid,
  extra: Pick<MataStats, 'name' | 'seed' | 'tick' | 'restored' | 'cistern' | 'outcome'> & {
    seeds?: SeedBag;
  },
): MataStats {
  const counts = collectCounts(grid);
  const soil = mean8(grid.soil);
  const moisture = mean8(grid.moisture);
  const nutrients = mean8(grid.nutrients);
  const fauna = mean8(grid.fauna);
  const health = mean8(grid.health);
  const balance = scoreBalance(grid);
  const restored = extra.outcome === 'won' || extra.restored;
  const phase = droughtPhase(extra.tick);
  const droughtIn = extra.tick < DROUGHT_START_TICK ? DROUGHT_START_TICK - extra.tick : 0;
  const droughtLeft =
    extra.tick >= DROUGHT_START_TICK && extra.tick < DROUGHT_END_TICK
      ? DROUGHT_END_TICK - extra.tick
      : 0;
  return {
    name: extra.name,
    seed: extra.seed,
    size: grid.size,
    tick: extra.tick,
    planted: counts.planted,
    unique: counts.unique,
    grass: counts.grass,
    crown: counts.crown,
    fern: counts.fern,
    inga: counts.inga,
    cactus: counts.cactus,
    soil,
    moisture,
    nutrients,
    fauna,
    health,
    balance,
    restored,
    drought: phase === 'drought',
    seeds: extra.seeds ? { ...extra.seeds } : emptySeeds(),
    cistern: extra.cistern,
    phase,
    droughtIn,
    droughtLeft,
    outcome: extra.outcome,
  };
}

export function faunaTarget(grid: MataGrid, x: number, y: number): number {
  const { size } = grid;
  let grass = 0;
  let crown = 0;
  let fern = 0;
  let present = 0;
  const seen = [false, false, false, false, false, false];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(size, nx, ny)) continue;
      const i = tileIndex(size, nx, ny);
      const species = grid.species[i] as SpeciesId;
      if (!isPlantSpecies(species) || (grid.age[i] as number) < MATURE_AGE) continue;
      if (!seen[species]) {
        seen[species] = true;
        present++;
      }
      if (species === SPECIES_GRASS) grass++;
      if (species === SPECIES_CROWN) crown++;
      if (species === SPECIES_FERN) fern++;
    }
  }
  const i = tileIndex(size, x, y);
  const soil = grid.soil[i] as number;
  const moisture = grid.moisture[i] as number;
  const insects = grass * 14 + (soil >> 2);
  const birds = crown * 20 + present * 8;
  const ground = moisture > 70 ? fern * 18 + (moisture >> 3) : fern * 6;
  return clamp8(((insects * 2 + birds * 2 + ground) / 5) | 0);
}

export function asPlant(species: SpeciesId): PlantSpecies | null {
  return isPlantSpecies(species) ? species : null;
}
