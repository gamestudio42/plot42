export const SPECIES_EMPTY = 0;
export const SPECIES_GRASS = 1;
export const SPECIES_CROWN = 2;
export const SPECIES_FERN = 3;
export const SPECIES_INGA = 4;
export const SPECIES_CACTUS = 5;
/** @deprecated Same id as cactus; kept so older tests and comments still compile. */
export const SPECIES_DRAIN = SPECIES_CACTUS;

export type SpeciesId =
  | typeof SPECIES_EMPTY
  | typeof SPECIES_GRASS
  | typeof SPECIES_CROWN
  | typeof SPECIES_FERN
  | typeof SPECIES_INGA
  | typeof SPECIES_CACTUS;

export const PLANT_SPECIES = [
  SPECIES_GRASS,
  SPECIES_CROWN,
  SPECIES_FERN,
  SPECIES_INGA,
  SPECIES_CACTUS,
] as const;

export type PlantSpecies = (typeof PLANT_SPECIES)[number];

export const SPECIES_KEY = {
  [SPECIES_GRASS]: 'grass',
  [SPECIES_CROWN]: 'crown',
  [SPECIES_FERN]: 'fern',
  [SPECIES_INGA]: 'inga',
  [SPECIES_CACTUS]: 'cactus',
} as const;

export type SpeciesKey = (typeof SPECIES_KEY)[PlantSpecies];

export const MATA_SIZE_MIN = 8;
export const MATA_SIZE_MAX = 24;
export const MATA_SIZE_DEFAULT = 16;

export const MATURE_AGE = 8;
export const MAX_AGE = 24;

export const WATER_PULSE = 64;
export const CISTERN_MAX = 255;
export const CISTERN_START = 120;
export const CISTERN_COST = 16;
export const CISTERN_RAIN = 4;

export const PLANT_HEALTH_START = 180;
export const HEALTH_FATAL = 14;
export const HEALTH_RECOVER = 8;

export const DROUGHT_WARN_TICK = 24;
export const DROUGHT_START_TICK = 32;
export const DROUGHT_END_TICK = 44;

export const WIN_PLANTS = 6;
export const WIN_UNIQUE = 3;
export const WIN_BALANCE = 16;

export const ERODE_CHANCE = 0.08;

export const MATA_SPEED_TICKS = [0, 8, 16, 32] as const;
export type MataSpeed = 0 | 1 | 2 | 3;

export type MataTool = SpeciesKey | 'water' | 'clear';
export type MataOverlay = 'none' | 'moisture' | 'nutrients' | 'shade' | 'soil' | 'fauna';
export type MataPhase = 'calm' | 'warned' | 'drought' | 'over';
export type MataOutcome = 'playing' | 'won' | 'lost';

export const MATA_TOOLS: readonly MataTool[] = [
  'grass',
  'crown',
  'fern',
  'inga',
  'cactus',
  'water',
  'clear',
];

export const MATA_OVERLAYS: readonly MataOverlay[] = [
  'none',
  'moisture',
  'nutrients',
  'shade',
  'soil',
  'fauna',
];

export interface SeedBag {
  grass: number;
  crown: number;
  fern: number;
  inga: number;
  cactus: number;
}

export const INITIAL_SEEDS: SeedBag = {
  grass: 28,
  crown: 8,
  fern: 10,
  inga: 8,
  cactus: 8,
};

export interface SpeciesTraits {
  water: number;
  nutrients: number;
  minWater: number;
  minNutrients: number;
  lightMin: number;
  lightMax: number;
  shadeSelf: number;
  shadeOrtho: number;
  shadeDiag: number;
}

export const SPECIES_TRAITS: Record<PlantSpecies, SpeciesTraits> = {
  [SPECIES_GRASS]: {
    water: 1,
    nutrients: 1,
    minWater: 16,
    minNutrients: 0,
    lightMin: 186,
    lightMax: 255,
    shadeSelf: 0,
    shadeOrtho: 0,
    shadeDiag: 0,
  },
  [SPECIES_CROWN]: {
    water: 6,
    nutrients: 3,
    minWater: 32,
    minNutrients: 16,
    lightMin: 40,
    lightMax: 255,
    shadeSelf: 90,
    shadeOrtho: 40,
    shadeDiag: 20,
  },
  [SPECIES_FERN]: {
    water: 2,
    nutrients: 1,
    minWater: 24,
    minNutrients: 0,
    lightMin: 0,
    lightMax: 226,
    shadeSelf: 12,
    shadeOrtho: 0,
    shadeDiag: 0,
  },
  [SPECIES_INGA]: {
    water: 3,
    nutrients: 0,
    minWater: 28,
    minNutrients: 10,
    lightMin: 50,
    lightMax: 255,
    shadeSelf: 50,
    shadeOrtho: 24,
    shadeDiag: 12,
  },
  [SPECIES_CACTUS]: {
    water: 1,
    nutrients: 1,
    minWater: 6,
    minNutrients: 0,
    lightMin: 200,
    lightMax: 255,
    shadeSelf: 4,
    shadeOrtho: 0,
    shadeDiag: 0,
  },
};

export const ORTHO: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const DIAG: readonly [number, number][] = [
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

export type ProblemCode = 'dry' | 'starved' | 'too-shady' | 'too-sunny' | 'bare' | 'young' | 'ailing';

export interface TileProblem {
  code: ProblemCode;
  severity: 1 | 2 | 3;
}

export interface TileFacts {
  x: number;
  y: number;
  species: SpeciesId;
  age: number;
  moisture: number;
  nutrients: number;
  soil: number;
  fauna: number;
  shade: number;
  light: number;
  health: number;
  problems: TileProblem[];
}

export interface MataGrid {
  size: number;
  species: Uint8Array;
  age: Uint8Array;
  moisture: Uint8Array;
  nutrients: Uint8Array;
  soil: Uint8Array;
  fauna: Uint8Array;
  health: Uint8Array;
}

export type MataCommand =
  | { type: 'plant'; x: number; y: number; species: PlantSpecies }
  | { type: 'clear'; x: number; y: number }
  | { type: 'water'; x: number; y: number };

export interface MataCommandResult {
  ok: boolean;
  reason?: 'oob' | 'occupied' | 'empty' | 'bad-species' | 'no-seed' | 'no-water' | 'over';
}

export interface MataStats {
  name: string;
  seed: string;
  size: number;
  tick: number;
  planted: number;
  unique: number;
  grass: number;
  crown: number;
  fern: number;
  inga: number;
  cactus: number;
  soil: number;
  moisture: number;
  nutrients: number;
  fauna: number;
  health: number;
  balance: number;
  restored: boolean;
  drought: boolean;
  seeds: SeedBag;
  cistern: number;
  phase: MataPhase;
  droughtIn: number;
  droughtLeft: number;
  outcome: MataOutcome;
}

export interface MataSnapshot {
  name: string;
  seed: string;
  size: number;
  tick: number;
  restored: boolean;
  sandbox: boolean;
  cistern: number;
  outcome: MataOutcome;
  seeds: SeedBag;
  rng: [number, number, number, number];
  species: Uint8Array;
  age: Uint8Array;
  moisture: Uint8Array;
  nutrients: Uint8Array;
  soil: Uint8Array;
  fauna: Uint8Array;
  health: Uint8Array;
}

export interface MataFullState {
  name: string;
  seed: string;
  size: number;
  species: Uint8Array;
  age: Uint8Array;
  moisture: Uint8Array;
  nutrients: Uint8Array;
  soil: Uint8Array;
  fauna: Uint8Array;
  health: Uint8Array;
  stats: MataStats;
}

export interface MataDelta {
  tick: number;
  species: Uint8Array;
  age: Uint8Array;
  moisture: Uint8Array;
  nutrients: Uint8Array;
  soil: Uint8Array;
  fauna: Uint8Array;
  health: Uint8Array;
  stats: MataStats;
}

export interface NewMataOptions {
  name: string;
  seed: string;
  size: number;
  preset?: 'wild' | 'menu';
}

export interface MataMeta {
  name: string;
  seed: string;
  size: number;
  tick: number;
  planted: number;
  unique: number;
  balance: number;
  restored: boolean;
  outcome: MataOutcome;
  savedAt: string;
}

export type ToMataMessage =
  | { type: 'newGame'; options: NewMataOptions }
  | { type: 'command'; id: number; command: MataCommand }
  | { type: 'setSpeed'; speed: MataSpeed }
  | { type: 'snapshot'; id: number }
  | { type: 'hash'; id: number }
  | { type: 'exportSave'; id: number; savedAt: string }
  | { type: 'importSave'; id: number; text: string };

export type LoadMataResult =
  | { ok: true; meta: MataMeta; migratedFrom: number | null }
  | { ok: false; errors: { code: string; detail?: string }[] };

export type FromMataMessage =
  | { type: 'init'; state: MataFullState }
  | { type: 'delta'; delta: MataDelta }
  | { type: 'commandResult'; id: number; result: MataCommandResult }
  | { type: 'snapshot'; id: number; snapshot: MataSnapshot }
  | { type: 'hash'; id: number; hash: string }
  | { type: 'saveData'; id: number; text: string; meta: MataMeta }
  | { type: 'loadResult'; id: number; result: LoadMataResult }
  | { type: 'error'; message: string };

export function isPlantSpecies(value: number): value is PlantSpecies {
  return (
    value === SPECIES_GRASS ||
    value === SPECIES_CROWN ||
    value === SPECIES_FERN ||
    value === SPECIES_INGA ||
    value === SPECIES_CACTUS
  );
}

export function toolSpecies(tool: MataTool): PlantSpecies | null {
  if (tool === 'grass') return SPECIES_GRASS;
  if (tool === 'crown') return SPECIES_CROWN;
  if (tool === 'fern') return SPECIES_FERN;
  if (tool === 'inga') return SPECIES_INGA;
  if (tool === 'cactus') return SPECIES_CACTUS;
  return null;
}

export function emptySeeds(): SeedBag {
  return { grass: 0, crown: 0, fern: 0, inga: 0, cactus: 0 };
}

export function copySeeds(bag: SeedBag): SeedBag {
  return {
    grass: bag.grass,
    crown: bag.crown,
    fern: bag.fern,
    inga: bag.inga,
    cactus: bag.cactus,
  };
}

export function droughtPhase(tick: number): MataPhase {
  if (tick < DROUGHT_WARN_TICK) return 'calm';
  if (tick < DROUGHT_START_TICK) return 'warned';
  if (tick < DROUGHT_END_TICK) return 'drought';
  return 'over';
}

export function isRaining(tick: number, sandbox: boolean): boolean {
  if (sandbox) return true;
  return tick < DROUGHT_START_TICK || tick >= DROUGHT_END_TICK;
}
