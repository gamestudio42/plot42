import { expect, it } from 'vitest';
import { MataEngine, SPECIES_CACTUS, SPECIES_GRASS, SPECIES_INGA } from '@mata/sim';

it('restores the default wild grove with only normal player commands and resources', () => {
  const play = () => {
    const engine = MataEngine.create({ name: 'Mata', seed: 'mata', size: 16 });
    const trees = [
      [7, 7],
      [9, 7],
      [8, 9],
    ] as const;
    const grass = [
      [8, 7],
      [7, 8],
      [9, 8],
    ] as const;
    const cactus = [
      [6, 6],
      [10, 6],
      [8, 10],
    ] as const;
    for (const [species, spots] of [
      [SPECIES_INGA, trees],
      [SPECIES_GRASS, grass],
      [SPECIES_CACTUS, cactus],
    ] as const) {
      for (const [x, y] of spots)
        expect(engine.execute({ type: 'plant', x, y, species }).ok).toBe(true);
    }
    for (let day = 0; day < 44; day++) {
      if ([0, 8, 24, 32].includes(day)) {
        for (const [x, y] of trees) expect(engine.execute({ type: 'water', x, y }).ok).toBe(true);
      }
      if (day === 28) {
        for (const [x, y] of grass) expect(engine.execute({ type: 'water', x, y }).ok).toBe(true);
      }
      engine.step();
    }
    expect(engine.outcome).toBe('won');
    expect(engine.stats().unique).toBe(3);
    expect(engine.stats().planted).toBeGreaterThanOrEqual(6);
    expect(engine.cistern).toBe(8);
    return engine.hash();
  };
  expect(play()).toBe(play());
});
