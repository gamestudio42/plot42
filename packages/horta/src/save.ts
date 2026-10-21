import {
  base64ToBytes,
  bytesToBase64,
  decodeEnvelope,
  encodeEnvelope,
  isRecord,
  type SaveEnvelope,
  type SaveError,
} from '@shell/kernel';
import type { HortaMeta, HortaSnapshot } from './types';

export const HORTA_SAVE_FORMAT = 'horta-save';
export const HORTA_SAVE_VERSION = 1;
export const HORTA_SAVE_EXTENSION = '.horta.json';

export interface HortaSaveState {
  name: string;
  seed: string;
  size: number;
  tick: number;
  harvested: number;
  rng: [number, number, number, number];
  plots: string;
}

export type HortaSaveFile = SaveEnvelope<typeof HORTA_SAVE_FORMAT, HortaMeta, HortaSaveState>;

export type HortaDecodeResult =
  | { ok: true; snapshot: HortaSnapshot; meta: HortaMeta; migratedFrom: number | null }
  | { ok: false; errors: SaveError[] };

export function encodeHortaSave(
  snapshot: HortaSnapshot,
  extra: Pick<HortaMeta, 'planted' | 'ripe' | 'savedAt'>,
): HortaSaveFile {
  const state: HortaSaveState = {
    name: snapshot.name,
    seed: snapshot.seed,
    size: snapshot.size,
    tick: snapshot.tick,
    harvested: snapshot.harvested,
    rng: [...snapshot.rng],
    plots: bytesToBase64(snapshot.plots),
  };
  return encodeEnvelope(
    HORTA_SAVE_FORMAT,
    HORTA_SAVE_VERSION,
    {
      name: snapshot.name,
      seed: snapshot.seed,
      size: snapshot.size,
      tick: snapshot.tick,
      harvested: snapshot.harvested,
      ...extra,
    },
    state,
  );
}

export function decodeHortaSave(text: string): HortaDecodeResult {
  const decoded = decodeEnvelope(text, {
    format: HORTA_SAVE_FORMAT,
    currentVersion: HORTA_SAVE_VERSION,
  });
  if (!decoded.ok) return decoded;
  const raw = decoded.file.state;
  if (!isRecord(raw) || typeof raw.plots !== 'string') {
    return { ok: false, errors: [{ code: 'INVALID', detail: 'state: expected plots' }] };
  }
  const size = raw.size;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 4 || size > 64) {
    return { ok: false, errors: [{ code: 'INVALID', detail: 'state.size' }] };
  }
  let plots: Uint8Array;
  try {
    plots = base64ToBytes(raw.plots);
  } catch {
    return { ok: false, errors: [{ code: 'INVALID', detail: 'state.plots: invalid base64' }] };
  }
  if (plots.length !== size * size) {
    return { ok: false, errors: [{ code: 'INVALID', detail: 'state.plots: length' }] };
  }
  const rng = Array.isArray(raw.rng) ? raw.rng : [];
  if (rng.length !== 4) return { ok: false, errors: [{ code: 'INVALID', detail: 'state.rng' }] };
  const snapshot: HortaSnapshot = {
    name: typeof raw.name === 'string' ? raw.name : 'Horta',
    seed: typeof raw.seed === 'string' ? raw.seed : '0',
    size,
    tick: typeof raw.tick === 'number' ? raw.tick : 0,
    harvested: typeof raw.harvested === 'number' ? raw.harvested : 0,
    rng: [rng[0], rng[1], rng[2], rng[3]].map((n) =>
      typeof n === 'number' ? n : 0,
    ) as HortaSnapshot['rng'],
    plots,
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
      ripe: num(metaRaw.ripe),
      harvested: snapshot.harvested,
      savedAt: typeof metaRaw.savedAt === 'string' ? metaRaw.savedAt : '',
    },
    migratedFrom: decoded.migratedFrom,
  };
}
