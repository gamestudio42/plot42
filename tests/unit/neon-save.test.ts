import {
  NEON_SAVE_FORMAT,
  SAVE_FORMAT,
  decodeSave,
  encodeSave,
  stringifySave,
} from '@city/shared';
import { SimulationEngine, createEngine } from '@city/simulation';
import { describe, expect, it } from 'vitest';

/** A small neon city with the extra state the envelope has to carry. */
function neonCity(): SimulationEngine {
  const e = createEngine({
    seed: 'neon-save',
    size: 48,
    name: 'Neon',
    ruleset: 'neon',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 200_000,
  });
  e.disastersEnabled = false;
  e.execute({ type: 'road', x0: 4, y0: 10, x1: 30, y1: 10 });
  e.execute({ type: 'place', kind: 'substation', x: 10, y: 12 });
  e.execute({ type: 'place', kind: 'battery', x: 13, y: 12 });
  e.runMonths(3);
  return e;
}

const meta = { population: 0, funds: 200_000, savedAt: '2026-01-01T00:00:00.000Z' };
const neonOptions = { format: NEON_SAVE_FORMAT };

describe('neon save envelope', () => {
  it('keeps the ruleset and the neon state across a round trip', () => {
    const e = neonCity();
    const file = encodeSave(e.serialize(), meta, neonOptions);
    const decoded = decodeSave(stringifySave(file), neonOptions);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.ruleset).toBe('neon');
    expect(decoded.snapshot.neon).toBeDefined();
    expect(decoded.snapshot.neon?.corporations.length).toBeGreaterThan(0);
  });

  it('preserves battery charge and corporation capital', () => {
    const e = neonCity();
    const batteries = e.neon.batteries.map((b) => ({ ...b }));
    const corps = e.neon.corporations.map((c) => ({ ...c }));
    const file = encodeSave(e.serialize(), meta, neonOptions);
    const decoded = decodeSave(stringifySave(file), neonOptions);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.neon?.batteries).toEqual(batteries);
    expect(decoded.snapshot.neon?.corporations).toEqual(corps);
  });

  it('refuses a classic envelope when asked for the neon format', () => {
    const e = createEngine({
      seed: 'classic',
      size: 48,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    });
    const file = encodeSave(e.serialize(), meta);
    const decoded = decodeSave(stringifySave(file), neonOptions);
    expect(decoded.ok).toBe(false);
  });

  it('keeps the classic envelope unchanged', () => {
    const e = createEngine({
      seed: 'classic',
      size: 48,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    });
    const file = encodeSave(e.serialize(), meta);
    expect(file.format).toBe(SAVE_FORMAT);
    const decoded = decodeSave(stringifySave(file));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.ruleset).toBe('classic');
    expect(decoded.snapshot.neon).toBeUndefined();
  });

  it('restores an identical city after a save and load cycle', () => {
    const e = neonCity();
    const file = encodeSave(e.serialize(), meta, neonOptions);
    const decoded = decodeSave(stringifySave(file), neonOptions);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const restored = SimulationEngine.fromSnapshot(decoded.snapshot);
    expect(restored.stats()).toEqual(e.stats());
    expect(restored.ruleset).toBe('neon');
  });
});
