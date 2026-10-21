import {
  base64ToBytes,
  bytesToBase64,
  decodeEnvelope,
  encodeEnvelope,
  isRecord,
  type SaveEnvelope,
  type SaveError,
  type SaveMigration,
} from '@shell/kernel';
import {
  CISTERN_START,
  INITIAL_SEEDS,
  MATA_SIZE_MAX,
  MATA_SIZE_MIN,
  PLANT_HEALTH_START,
  copySeeds,
  emptySeeds,
  isPlantSpecies,
  type MataMeta,
  type MataOutcome,
  type MataSnapshot,
  type SeedBag,
} from './types';

export const MATA_SAVE_FORMAT = 'mata-save';
export const MATA_SAVE_VERSION = 2;
export const MATA_SAVE_EXTENSION = '.mata.json';

export interface MataSaveState {
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
  species: string;
  age: string;
  moisture: string;
  nutrients: string;
  soil: string;
  fauna: string;
  health: string;
}

export type MataSaveFile = SaveEnvelope<typeof MATA_SAVE_FORMAT, MataMeta, MataSaveState>;

export type MataDecodeResult =
  | { ok: true; snapshot: MataSnapshot; meta: MataMeta; migratedFrom: number | null }
  | { ok: false; errors: SaveError[] };

function layer(value: unknown, size: number, label: string): Uint8Array | SaveError {
  if (typeof value !== 'string') return { code: 'INVALID', detail: `state.${label}` };
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(value);
  } catch {
    return { code: 'INVALID', detail: `state.${label}: invalid base64` };
  }
  if (bytes.length !== size * size) return { code: 'INVALID', detail: `state.${label}: length` };
  return bytes;
}

function readSeeds(value: unknown): SeedBag {
  const bag = emptySeeds();
  if (!isRecord(value)) return copySeeds(INITIAL_SEEDS);
  for (const key of ['grass', 'crown', 'fern', 'inga', 'cactus'] as const) {
    const n = value[key];
    bag[key] = typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n | 0 : 0;
  }
  return bag;
}

function readOutcome(value: unknown): MataOutcome {
  if (value === 'won' || value === 'lost' || value === 'playing') return value;
  return 'playing';
}

const migrateV1: SaveMigration = (file) => {
  const state = isRecord(file.state) ? file.state : {};
  const size = typeof state.size === 'number' ? state.size : 0;
  let health = new Uint8Array(size * size);
  if (typeof state.species === 'string' && size > 0) {
    try {
      const species = base64ToBytes(state.species);
      health = new Uint8Array(size * size);
      for (let i = 0; i < health.length && i < species.length; i++) {
        if (isPlantSpecies(species[i] as number)) health[i] = PLANT_HEALTH_START;
      }
    } catch {
      health = new Uint8Array(size * size);
    }
  }
  return {
    ...file,
    state: {
      ...state,
      sandbox: false,
      cistern: CISTERN_START,
      outcome: 'playing',
      seeds: copySeeds(INITIAL_SEEDS),
      health: bytesToBase64(health),
    },
  };
};

export function encodeMataSave(
  snapshot: MataSnapshot,
  extra: Pick<MataMeta, 'planted' | 'unique' | 'balance' | 'savedAt'>,
): MataSaveFile {
  const state: MataSaveState = {
    name: snapshot.name,
    seed: snapshot.seed,
    size: snapshot.size,
    tick: snapshot.tick,
    restored: snapshot.restored,
    sandbox: snapshot.sandbox,
    cistern: snapshot.cistern,
    outcome: snapshot.outcome,
    seeds: copySeeds(snapshot.seeds),
    rng: [...snapshot.rng],
    species: bytesToBase64(snapshot.species),
    age: bytesToBase64(snapshot.age),
    moisture: bytesToBase64(snapshot.moisture),
    nutrients: bytesToBase64(snapshot.nutrients),
    soil: bytesToBase64(snapshot.soil),
    fauna: bytesToBase64(snapshot.fauna),
    health: bytesToBase64(snapshot.health),
  };
  return encodeEnvelope(
    MATA_SAVE_FORMAT,
    MATA_SAVE_VERSION,
    {
      name: snapshot.name,
      seed: snapshot.seed,
      size: snapshot.size,
      tick: snapshot.tick,
      restored: snapshot.restored,
      outcome: snapshot.outcome,
      ...extra,
    },
    state,
  );
}

export function decodeMataSave(text: string): MataDecodeResult {
  const decoded = decodeEnvelope(text, {
    format: MATA_SAVE_FORMAT,
    currentVersion: MATA_SAVE_VERSION,
    migrations: { 1: migrateV1 },
  });
  if (!decoded.ok) return decoded;
  const raw = decoded.file.state;
  if (!isRecord(raw)) {
    return { ok: false, errors: [{ code: 'INVALID', detail: 'state' }] };
  }
  const size = raw.size;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < MATA_SIZE_MIN || size > MATA_SIZE_MAX) {
    return { ok: false, errors: [{ code: 'INVALID', detail: 'state.size' }] };
  }
  const fields = ['species', 'age', 'moisture', 'nutrients', 'soil', 'fauna', 'health'] as const;
  const layers: Partial<Record<(typeof fields)[number], Uint8Array>> = {};
  for (const field of fields) {
    const parsed = layer(raw[field], size, field);
    if (!(parsed instanceof Uint8Array)) return { ok: false, errors: [parsed] };
    layers[field] = parsed;
  }
  const rng = Array.isArray(raw.rng) ? raw.rng : [];
  if (rng.length !== 4) return { ok: false, errors: [{ code: 'INVALID', detail: 'state.rng' }] };
  const snapshot: MataSnapshot = {
    name: typeof raw.name === 'string' ? raw.name : 'Mata',
    seed: typeof raw.seed === 'string' ? raw.seed : '0',
    size,
    tick: typeof raw.tick === 'number' ? raw.tick : 0,
    restored: raw.restored === true,
    sandbox: raw.sandbox === true,
    cistern: typeof raw.cistern === 'number' ? raw.cistern : CISTERN_START,
    outcome: readOutcome(raw.outcome),
    seeds: readSeeds(raw.seeds),
    rng: [rng[0], rng[1], rng[2], rng[3]].map((n) =>
      typeof n === 'number' ? n : 0,
    ) as MataSnapshot['rng'],
    species: layers.species!,
    age: layers.age!,
    moisture: layers.moisture!,
    nutrients: layers.nutrients!,
    soil: layers.soil!,
    fauna: layers.fauna!,
    health: layers.health!,
  };
  const metaRaw = isRecord(decoded.file.meta) ? decoded.file.meta : {};
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  return {
    ok: true,
    snapshot,
    meta: {
      name: snapshot.name,
      seed: snapshot.seed,
      size: snapshot.size,
      tick: snapshot.tick,
      planted: num(metaRaw.planted),
      unique: num(metaRaw.unique),
      balance: num(metaRaw.balance),
      restored: snapshot.restored,
      outcome: snapshot.outcome,
      savedAt: typeof metaRaw.savedAt === 'string' ? metaRaw.savedAt : '',
    },
    migratedFrom: decoded.migratedFrom,
  };
}
