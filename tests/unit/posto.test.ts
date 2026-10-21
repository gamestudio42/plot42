import { decodePostoSave, encodePostoSave, PostoEngine } from '@posto/sim';
import { stringifySave } from '@shell/kernel';
import { describe, expect, it } from 'vitest';

function firstStep(engine: PostoEngine): { type: 'move'; unitId: number; x: number; y: number } {
  const player = engine.living('player')[0];
  if (!player) throw new Error('missing player');
  const deltas = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  for (const delta of deltas) {
    const x = player.x + delta.x;
    const y = player.y + delta.y;
    if (engine.inBounds(x, y) && !engine.unitAt(x, y)) {
      return { type: 'move', unitId: player.id, x, y };
    }
  }
  throw new Error('no free step');
}

describe('PostoEngine', () => {
  it('replays the same commands to the same hash', () => {
    const a = PostoEngine.create({ name: 'Outpost', seed: 'alpha' });
    expect(a.living('player')).toHaveLength(3);
    expect(a.living('enemy')).toHaveLength(3);
    const commands: ReturnType<typeof firstStep>[] = [];
    for (let i = 0; i < 3; i++) {
      const command = firstStep(a);
      commands.push(command);
      expect(a.execute(command).ok).toBe(true);
    }

    const b = PostoEngine.create({ name: 'Outpost', seed: 'alpha' });
    for (const command of commands) {
      expect(b.execute(command).ok).toBe(true);
    }
    expect(a.hash()).toBe(b.hash());
    expect(a.turn).toBe(3);
  });

  it('round-trips a save through the kernel envelope', () => {
    const engine = PostoEngine.create({ name: 'Ridge', seed: 'bravo' });
    const step = firstStep(engine);
    engine.execute(step);
    const stats = engine.stats();
    const text = stringifySave(
      encodePostoSave(engine.serialize(), {
        playerAlive: stats.playerAlive,
        enemyAlive: stats.enemyAlive,
        savedAt: '2026-01-01T00:00:00.000Z',
      }),
    );
    const decoded = decodePostoSave(text);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const restored = PostoEngine.fromSnapshot(decoded.snapshot);
    expect(restored.hash()).toBe(engine.hash());
  });
});
