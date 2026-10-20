import { BALANCE, DEPARTMENTS } from '../balance/balance';
import type { DisasterKind } from '../commands/commands';
import { PLACEABLE_KINDS, ZONE_BUILDING_KINDS, type BuildingRecord } from '../types/buildings';
import { EXPENSE_CATEGORIES } from '../types/stats';
import { INFLUENCE_LAYERS, STRUCTURE_LAYERS } from '../types/tiles';
import { base64ToBytes, bytesToBase64 } from '../util/base64';
import { Fnv1a } from '../util/hash';
import type { EngineSnapshot, SnapshotLayer } from './snapshot';

export const SAVE_FORMAT = 'city-builder-save';
/** Bump when the layout of `SaveState` changes, and register a migration from the old version. */
export const SAVE_VERSION = 1;
export const SAVE_FILE_EXTENSION = '.city.json';

/** Summary stored next to the state so save lists do not need to decode the whole file. */
export interface SaveMeta {
  name: string;
  seed: string;
  size: number;
  tick: number;
  population: number;
  funds: number;
  /** ISO 8601 timestamp supplied by the host (the simulation has no clock). */
  savedAt: string;
}

/** JSON form of `EngineSnapshot`: byte layers are base64 strings. */
export type SaveState = Omit<EngineSnapshot, 'heights' | 'layers'> & {
  heights: string;
  layers: Record<SnapshotLayer, string>;
};

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: number;
  meta: SaveMeta;
  state: SaveState;
  /** FNV-1a of the canonical JSON of `state`, as written by `version`. */
  checksum: string;
}

export type SaveErrorCode =
  | 'NOT_JSON'
  | 'NOT_A_SAVE'
  | 'NEWER_VERSION'
  | 'UNSUPPORTED_VERSION'
  | 'CHECKSUM'
  | 'MIGRATION_FAILED'
  | 'INVALID';

export interface SaveError {
  code: SaveErrorCode;
  /** Field path or extra information, in English (for logs and bug reports). */
  detail?: string;
}

export type DecodeResult =
  | { ok: true; snapshot: EngineSnapshot; meta: SaveMeta; migratedFrom: number | null }
  | { ok: false; errors: SaveError[] };

/** Upgrades a raw file object from version `n` to `n + 1`; registered under key `n`. */
export type SaveMigration = (file: Record<string, unknown>) => Record<string, unknown>;

export const SAVE_MIGRATIONS: Readonly<Record<number, SaveMigration>> = {};

export interface DecodeOptions {
  /** Defaults to `SAVE_MIGRATIONS` and `SAVE_VERSION`; tests inject their own. */
  migrations?: Readonly<Record<number, SaveMigration>>;
  currentVersion?: number;
}

export const SNAPSHOT_LAYERS: readonly SnapshotLayer[] = [...STRUCTURE_LAYERS, ...INFLUENCE_LAYERS];

/** JSON with object keys sorted, so the checksum ignores formatting and key order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

export function saveChecksum(state: unknown): string {
  return new Fnv1a().string(canonicalJson(state)).hex();
}

export function encodeSave(
  snapshot: EngineSnapshot,
  extra: Pick<SaveMeta, 'population' | 'funds' | 'savedAt'>,
): SaveFile {
  const layers = {} as Record<SnapshotLayer, string>;
  for (const name of SNAPSHOT_LAYERS) layers[name] = bytesToBase64(snapshot.layers[name]);
  const state: SaveState = {
    name: snapshot.name,
    seed: snapshot.seed,
    size: snapshot.size,
    tick: snapshot.tick,
    rng: [...snapshot.rng],
    heights: bytesToBase64(snapshot.heights),
    layers,
    buildings: snapshot.buildings.map((b) => ({ ...b })),
    nextBuildingId: snapshot.nextBuildingId,
    economy: JSON.parse(JSON.stringify(snapshot.economy)) as SaveState['economy'],
    demand: { ...snapshot.demand },
    history: snapshot.history.map((h) => ({ ...h })),
    disasters: snapshot.disasters.map((d) => ({ ...d })),
    disastersEnabled: snapshot.disastersEnabled,
    networksDirty: snapshot.networksDirty,
    lastMilestone: snapshot.lastMilestone,
  };
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    meta: {
      name: snapshot.name,
      seed: snapshot.seed,
      size: snapshot.size,
      tick: snapshot.tick,
      ...extra,
    },
    state,
    checksum: saveChecksum(state),
  };
}

export function stringifySave(file: SaveFile): string {
  return JSON.stringify(file);
}

/** Parses, verifies, migrates and validates a save. A failed decode never throws. */
export function decodeSave(text: string, options: DecodeOptions = {}): DecodeResult {
  const migrations = options.migrations ?? SAVE_MIGRATIONS;
  const current = options.currentVersion ?? SAVE_VERSION;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return fail('NOT_JSON', error instanceof Error ? error.message : undefined);
  }
  if (!isRecord(raw) || raw.format !== SAVE_FORMAT || !isRecord(raw.state)) {
    return fail('NOT_A_SAVE');
  }
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail('UNSUPPORTED_VERSION', String(version));
  }
  if (version > current) return fail('NEWER_VERSION', `${version} > ${current}`);
  if (typeof raw.checksum !== 'string' || raw.checksum !== saveChecksum(raw.state)) {
    return fail('CHECKSUM');
  }

  let file: Record<string, unknown> = raw;
  for (let v = version; v < current; v++) {
    const migrate = migrations[v];
    if (!migrate) return fail('UNSUPPORTED_VERSION', `no migration from version ${v}`);
    try {
      file = { ...migrate(file), version: v + 1 };
    } catch (error) {
      return fail('MIGRATION_FAILED', `${v} -> ${v + 1}: ${String(error)}`);
    }
  }

  const v = new Validator();
  const snapshot = v.state(file.state);
  if (!snapshot || v.errors.length > 0) return { ok: false, errors: v.errors };
  return {
    ok: true,
    snapshot,
    meta: metaOf(file.meta, snapshot),
    migratedFrom: version === current ? null : version,
  };
}

function fail(code: SaveErrorCode, detail?: string): DecodeResult {
  return { ok: false, errors: [detail === undefined ? { code } : { code, detail }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function metaOf(raw: unknown, snapshot: EngineSnapshot): SaveMeta {
  const m = isRecord(raw) ? raw : {};
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  return {
    name: snapshot.name,
    seed: snapshot.seed,
    size: snapshot.size,
    tick: snapshot.tick,
    population: num(m.population),
    funds: typeof m.funds === 'number' ? m.funds : snapshot.economy.funds,
    savedAt: typeof m.savedAt === 'string' ? m.savedAt : '',
  };
}

const BUILDING_KINDS = new Set<string>([...ZONE_BUILDING_KINDS, ...PLACEABLE_KINDS]);
const DISASTER_KINDS = new Set<DisasterKind>([
  'fire',
  'flood',
  'earthquake',
  'crisis',
  'blackout',
  'epidemic',
]);
const MAX_ERRORS = 20;
const MAX_SIZE = 512;

/** Structural validation of a `SaveState`, collecting every problem (up to a limit). */
class Validator {
  readonly errors: SaveError[] = [];

  error(path: string, problem: string): void {
    if (this.errors.length < MAX_ERRORS) {
      this.errors.push({ code: 'INVALID', detail: `${path}: ${problem}` });
    }
  }

  int(value: unknown, path: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      this.error(path, `expected an integer in [${min}, ${max}]`);
      return min;
    }
    return value;
  }

  num(value: unknown, path: string, min = -Infinity, max = Infinity): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      this.error(path, `expected a number in [${min}, ${max}]`);
      return 0;
    }
    return value;
  }

  bool(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean') this.error(path, 'expected a boolean');
    return value === true;
  }

  str(value: unknown, path: string): string {
    if (typeof value !== 'string') {
      this.error(path, 'expected a string');
      return '';
    }
    return value;
  }

  record(value: unknown, path: string): Record<string, unknown> {
    if (!isRecord(value)) {
      this.error(path, 'expected an object');
      return {};
    }
    return value;
  }

  array(value: unknown, path: string): unknown[] {
    if (!Array.isArray(value)) {
      this.error(path, 'expected an array');
      return [];
    }
    return value;
  }

  bytes(value: unknown, path: string, length: number): Uint8Array {
    if (typeof value !== 'string') {
      this.error(path, 'expected base64 data');
      return new Uint8Array(length);
    }
    try {
      const out = base64ToBytes(value);
      if (out.length !== length) this.error(path, `expected ${length} bytes, got ${out.length}`);
      return out.length === length ? out : new Uint8Array(length);
    } catch {
      this.error(path, 'invalid base64 data');
      return new Uint8Array(length);
    }
  }

  numbers<K extends string>(
    value: unknown,
    path: string,
    keys: readonly K[],
    min = -Infinity,
    max = Infinity,
  ) {
    const r = this.record(value, path);
    const out = {} as Record<K, number>;
    for (const k of keys) out[k] = this.num(r[k], `${path}.${k}`, min, max);
    return out;
  }

  state(value: unknown): EngineSnapshot | null {
    const s = this.record(value, 'state');
    const size = this.int(s.size, 'state.size', 8, MAX_SIZE);
    if (this.errors.length > 0) return null;
    const tiles = size * size;

    const rng = this.array(s.rng, 'state.rng');
    if (rng.length !== 4) this.error('state.rng', 'expected 4 integers');
    const rngState = [0, 1, 2, 3].map((k) =>
      this.int(rng[k], `state.rng[${k}]`, 0, 0xffffffff),
    ) as EngineSnapshot['rng'];
    if (rngState.every((x) => x === 0)) this.error('state.rng', 'all-zero generator state');

    const layersRaw = this.record(s.layers, 'state.layers');
    const layers = {} as Record<SnapshotLayer, Uint8Array>;
    for (const name of SNAPSHOT_LAYERS) {
      layers[name] = this.bytes(layersRaw[name], `state.layers.${name}`, tiles);
    }
    for (const name of Object.keys(layersRaw)) {
      if (!(SNAPSHOT_LAYERS as readonly string[]).includes(name)) {
        this.error(`state.layers.${name}`, 'unknown layer');
      }
    }

    const nextBuildingId = this.int(s.nextBuildingId, 'state.nextBuildingId', 1);
    const buildings = this.buildings(s.buildings, size, nextBuildingId);

    const e = this.record(s.economy, 'state.economy');
    const zones = ZONE_BUILDING_KINDS;
    const lastMonth = this.record(e.lastMonth, 'state.economy.lastMonth');
    const economy: EngineSnapshot['economy'] = {
      funds: this.num(e.funds, 'state.economy.funds'),
      constructionThisMonth: this.num(
        e.constructionThisMonth,
        'state.economy.constructionThisMonth',
        0,
      ),
      taxes: this.numbers(e.taxes, 'state.economy.taxes', zones, 0, BALANCE.economy.taxMax),
      funding: this.numbers(e.funding, 'state.economy.funding', DEPARTMENTS, 0, 100),
      lastMonth: {
        revenue: this.numbers(lastMonth.revenue, 'state.economy.lastMonth.revenue', zones),
        expenses: this.numbers(
          lastMonth.expenses,
          'state.economy.lastMonth.expenses',
          EXPENSE_CATEGORIES,
        ),
        construction: this.num(lastMonth.construction, 'state.economy.lastMonth.construction'),
        net: this.num(lastMonth.net, 'state.economy.lastMonth.net'),
      },
      monthsInDebt: this.int(e.monthsInDebt, 'state.economy.monthsInDebt', 0),
      bankrupt: this.bool(e.bankrupt, 'state.economy.bankrupt'),
    };

    const history = this.array(s.history, 'state.history').map((entry, k) =>
      this.numbers(entry, `state.history[${k}]`, HISTORY_KEYS),
    );
    const disasters = this.array(s.disasters, 'state.disasters').map((entry, k) => {
      const d = this.record(entry, `state.disasters[${k}]`);
      const kind = d.kind as DisasterKind;
      if (!DISASTER_KINDS.has(kind)) this.error(`state.disasters[${k}].kind`, 'unknown disaster');
      return {
        kind,
        remainingTicks: this.int(d.remainingTicks, `state.disasters[${k}].remainingTicks`, 0),
        x: this.int(d.x, `state.disasters[${k}].x`, 0, size - 1),
        y: this.int(d.y, `state.disasters[${k}].y`, 0, size - 1),
        targetId: this.int(d.targetId, `state.disasters[${k}].targetId`, 0),
      };
    });

    const snapshot: EngineSnapshot = {
      name: this.str(s.name, 'state.name'),
      seed: this.str(s.seed, 'state.seed'),
      size,
      tick: this.int(s.tick, 'state.tick', 0),
      rng: rngState,
      heights: this.bytes(s.heights, 'state.heights', (size + 1) * (size + 1)),
      layers,
      buildings,
      nextBuildingId,
      economy,
      demand: this.numbers(s.demand, 'state.demand', zones, -10, 10),
      history: history as unknown as EngineSnapshot['history'],
      disasters,
      disastersEnabled: this.bool(s.disastersEnabled, 'state.disastersEnabled'),
      networksDirty: this.bool(s.networksDirty, 'state.networksDirty'),
      lastMilestone: this.int(s.lastMilestone, 'state.lastMilestone', 0),
    };
    return this.errors.length > 0 ? null : snapshot;
  }

  buildings(value: unknown, size: number, nextId: number): BuildingRecord[] {
    const occupied = new Int32Array(size * size);
    const ids = new Set<number>();
    return this.array(value, 'state.buildings').map((entry, k) => {
      const path = `state.buildings[${k}]`;
      const b = this.record(entry, path);
      const kind = b.kind as BuildingRecord['kind'];
      if (!BUILDING_KINDS.has(kind)) this.error(`${path}.kind`, 'unknown building kind');
      const id = this.int(b.id, `${path}.id`, 1, nextId - 1);
      if (ids.has(id)) this.error(`${path}.id`, 'duplicate id');
      ids.add(id);
      const w = this.int(b.w, `${path}.w`, 1, 8);
      const h = this.int(b.h, `${path}.h`, 1, 8);
      const x = this.int(b.x, `${path}.x`, 0, size - w);
      const y = this.int(b.y, `${path}.y`, 0, size - h);
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const i = (y + dy) * size + x + dx;
          if (occupied[i] !== 0) this.error(path, `overlaps building ${occupied[i]}`);
          occupied[i] = id;
        }
      }
      return {
        id,
        kind,
        x,
        y,
        w,
        h,
        level: this.int(b.level, `${path}.level`, 0, 5),
        capacity: this.num(b.capacity, `${path}.capacity`, 0),
        occupancy: this.num(b.occupancy, `${path}.occupancy`, 0),
        condition: this.num(b.condition, `${path}.condition`, 0, 100),
        age: this.int(b.age, `${path}.age`, 0),
        abandoned: this.bool(b.abandoned, `${path}.abandoned`),
        emptyMonths: this.int(b.emptyMonths, `${path}.emptyMonths`, 0),
        variant: this.int(b.variant, `${path}.variant`, 0),
        powered: this.bool(b.powered, `${path}.powered`),
        watered: this.bool(b.watered, `${path}.watered`),
        offline: this.int(b.offline, `${path}.offline`, 0),
        attractiveness: this.num(b.attractiveness, `${path}.attractiveness`, 0, 1),
      };
    });
  }
}

const HISTORY_KEYS = [
  'month',
  'population',
  'funds',
  'jobs',
  'demandR',
  'demandC',
  'demandI',
  'revenue',
  'expenses',
  'pollution',
  'crime',
  'landValue',
] as const;
