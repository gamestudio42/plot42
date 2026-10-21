import { decodeHortaSave, encodeHortaSave, HortaEngine, PLOT_EMPTY, PLOT_PLANTED, PLOT_RIPE } from '@horta/sim';
import { stringifySave } from '@shell/kernel';
import { describe, expect, it } from 'vitest';

describe('HortaEngine', () => {
  it('plants, grows, harvests and hashes deterministically', () => {
    const a = HortaEngine.create({ name: 'Horta', seed: 'horta', size: 8 });
    expect(a.execute({ type: 'plant', x: 2, y: 3 }).ok).toBe(true);
    expect(a.plots[a.index(2, 3)]).toBe(PLOT_PLANTED);
    expect(a.execute({ type: 'plant', x: 2, y: 3 }).ok).toBe(false);
    a.runTicks(80);
    expect(a.plots[a.index(2, 3)]).toBe(PLOT_RIPE);
    expect(a.execute({ type: 'harvest', x: 2, y: 3 }).ok).toBe(true);
    expect(a.plots[a.index(2, 3)]).toBe(PLOT_EMPTY);
    expect(a.harvested).toBe(1);

    const b = HortaEngine.create({ name: 'Horta', seed: 'horta', size: 8 });
    b.execute({ type: 'plant', x: 2, y: 3 });
    b.runTicks(80);
    b.execute({ type: 'harvest', x: 2, y: 3 });
    expect(a.hash()).toBe(b.hash());
    expect(b.stats().harvested).toBe(1);
  });

  it('round-trips a save through the kernel envelope', () => {
    const engine = HortaEngine.create({ name: 'Grove', seed: 'oak', size: 8 });
    engine.execute({ type: 'plant', x: 0, y: 0 });
    engine.runTicks(80);
    engine.execute({ type: 'harvest', x: 0, y: 0 });
    const text = stringifySave(
      encodeHortaSave(engine.serialize(), {
        planted: 0,
        ripe: 0,
        savedAt: '2026-01-01T00:00:00.000Z',
      }),
    );
    const decoded = decodeHortaSave(text);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.meta.harvested).toBe(1);
    const restored = HortaEngine.fromSnapshot(decoded.snapshot);
    expect(restored.hash()).toBe(engine.hash());
    expect(restored.harvested).toBe(1);
  });
});
