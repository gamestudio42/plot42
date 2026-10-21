import {
  decodeEnvelope,
  encodeEnvelope,
  isRecord,
  type SaveEnvelope,
  type SaveError,
} from '@shell/kernel';
import { GRID_SIZE, type Outcome, type PostoMeta, type PostoSnapshot, type Side, type Unit } from './types';

export const POSTO_SAVE_FORMAT = 'posto-save';
export const POSTO_SAVE_VERSION = 1;
export const POSTO_SAVE_EXTENSION = '.posto.json';

export interface PostoSaveState {
  name: string;
  seed: string;
  size: number;
  turn: number;
  rng: [number, number, number, number];
  units: Unit[];
  outcome: Outcome;
}

export type PostoSaveFile = SaveEnvelope<typeof POSTO_SAVE_FORMAT, PostoMeta, PostoSaveState>;

export type PostoDecodeResult =
  | { ok: true; snapshot: PostoSnapshot; meta: PostoMeta; migratedFrom: number | null }
  | { ok: false; errors: SaveError[] };

export function encodePostoSave(
  snapshot: PostoSnapshot,
  extra: Pick<PostoMeta, 'playerAlive' | 'enemyAlive' | 'savedAt'>,
): PostoSaveFile {
  const state: PostoSaveState = {
    name: snapshot.name,
    seed: snapshot.seed,
    size: snapshot.size,
    turn: snapshot.turn,
    rng: [...snapshot.rng],
    units: snapshot.units.map((unit) => ({ ...unit })),
    outcome: snapshot.outcome,
  };
  return encodeEnvelope(
    POSTO_SAVE_FORMAT,
    POSTO_SAVE_VERSION,
    {
      name: snapshot.name,
      seed: snapshot.seed,
      turn: snapshot.turn,
      outcome: snapshot.outcome,
      ...extra,
    },
    state,
  );
}

function parseUnit(value: unknown): Unit | null {
  if (!isRecord(value)) return null;
  const side = value.side;
  if (side !== 'player' && side !== 'enemy') return null;
  const id = value.id;
  const x = value.x;
  const y = value.y;
  const hp = value.hp;
  if (
    typeof id !== 'number' ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof hp !== 'number'
  ) {
    return null;
  }
  return { id, side: side as Side, x, y, hp };
}

export function decodePostoSave(text: string): PostoDecodeResult {
  const decoded = decodeEnvelope(text, {
    format: POSTO_SAVE_FORMAT,
    currentVersion: POSTO_SAVE_VERSION,
  });
  if (!decoded.ok) return decoded;
  const raw = decoded.file.state;
  if (!isRecord(raw) || !Array.isArray(raw.units)) {
    return { ok: false, errors: [{ code: 'INVALID', detail: 'state: expected units' }] };
  }
  const rng = Array.isArray(raw.rng) ? raw.rng : [];
  if (rng.length !== 4) return { ok: false, errors: [{ code: 'INVALID', detail: 'state.rng' }] };
  const units: Unit[] = [];
  for (const entry of raw.units) {
    const unit = parseUnit(entry);
    if (!unit) return { ok: false, errors: [{ code: 'INVALID', detail: 'state.units' }] };
    units.push(unit);
  }
  const outcome = raw.outcome;
  if (outcome !== 'playing' && outcome !== 'victory' && outcome !== 'defeat') {
    return { ok: false, errors: [{ code: 'INVALID', detail: 'state.outcome' }] };
  }
  const snapshot: PostoSnapshot = {
    name: typeof raw.name === 'string' ? raw.name : 'Posto',
    seed: typeof raw.seed === 'string' ? raw.seed : '0',
    size: GRID_SIZE,
    turn: typeof raw.turn === 'number' ? raw.turn : 0,
    rng: [rng[0], rng[1], rng[2], rng[3]].map((n) =>
      typeof n === 'number' ? n : 0,
    ) as PostoSnapshot['rng'],
    units,
    outcome,
  };
  const metaRaw = isRecord(decoded.file.meta) ? decoded.file.meta : {};
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  return {
    ok: true,
    snapshot,
    meta: {
      name: snapshot.name,
      seed: snapshot.seed,
      turn: snapshot.turn,
      playerAlive: num(metaRaw.playerAlive),
      enemyAlive: num(metaRaw.enemyAlive),
      outcome: snapshot.outcome,
      savedAt: typeof metaRaw.savedAt === 'string' ? metaRaw.savedAt : '',
    },
    migratedFrom: decoded.migratedFrom,
  };
}
