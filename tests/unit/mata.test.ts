import {
  CISTERN_START,
  DROUGHT_END_TICK,
  INITIAL_SEEDS,
  MATA_SAVE_VERSION,
  PLANT_HEALTH_START,
  SPECIES_CACTUS,
  SPECIES_CROWN,
  SPECIES_EMPTY,
  SPECIES_FERN,
  SPECIES_GRASS,
  SPECIES_INGA,
  decodeMataSave,
  encodeMataSave,
  MataEngine,
  scoreBalance,
} from '@mata/sim';
import { bytesToBase64, encodeEnvelope, stringifySave } from '@shell/kernel';
import { describe, expect, it } from 'vitest';

function fertile(engine: MataEngine): void {
  for (let i = 0; i < engine.moisture.length; i++) {
    engine.moisture[i] = 180;
    engine.nutrients[i] = 180;
    engine.soil[i] = 120;
  }
}

function fillBag(engine: MataEngine, n = 64): void {
  engine.seeds.grass = n;
  engine.seeds.crown = n;
  engine.seeds.fern = n;
  engine.seeds.inga = n;
  engine.seeds.cactus = n;
}

function plant(
  engine: MataEngine,
  x: number,
  y: number,
  species: typeof SPECIES_GRASS | typeof SPECIES_CROWN | typeof SPECIES_FERN | typeof SPECIES_INGA | typeof SPECIES_CACTUS,
  age?: number,
): void {
  const result = engine.execute({ type: 'plant', x, y, species });
  expect(result.ok).toBe(true);
  if (age !== undefined) engine.age[engine.index(x, y)] = age;
}

describe('MataEngine', () => {
  it('paints a degraded wild and hashes through the drought', () => {
    const play = (): MataEngine => {
      const engine = MataEngine.create({ name: 'Mata', seed: 'scar', size: 8 });
      engine.execute({ type: 'plant', x: 1, y: 1, species: SPECIES_GRASS });
      engine.runTicks(DROUGHT_END_TICK + 2);
      return engine;
    };
    const a = play();
    const b = play();
    expect(a.hash()).toBe(b.hash());
    expect(a.tick).toBe(DROUGHT_END_TICK);
    expect(a.stats().phase).toBe('over');
    expect(a.stats().outcome).not.toBe('playing');
    expect(a.stats().planted).toBe(0);
    expect(a.stats().soil).toBeLessThan(80);
  });

  it('kills grass under a mature crown and ferns in full sun without a roll', () => {
    const shadeA = MataEngine.create({ name: 'Mata', seed: 'shade', size: 8 });
    const shadeB = MataEngine.create({ name: 'Mata', seed: 'shade', size: 8 });
    for (const grove of [shadeA, shadeB]) {
      fertile(grove);
      plant(grove, 2, 2, SPECIES_CROWN, 16);
      plant(grove, 4, 2, SPECIES_CROWN, 16);
      plant(grove, 3, 2, SPECIES_GRASS);
    }
    shadeA.runTicks(6);
    shadeB.runTicks(6);
    const grass = shadeA.index(3, 2);
    expect(shadeA.health[grass]).toBe(shadeB.health[grass]);
    expect(shadeA.health[grass]).toBeLessThan(PLANT_HEALTH_START);
    expect(shadeA.hash()).toBe(shadeB.hash());
    shadeA.runTicks(20);
    shadeB.runTicks(20);
    expect(shadeA.species[grass]).toBe(SPECIES_EMPTY);
    expect(shadeB.species[grass]).toBe(SPECIES_EMPTY);
    expect(shadeA.hash()).toBe(shadeB.hash());

    const sun = MataEngine.create({ name: 'Mata', seed: 'sun', size: 8 });
    fertile(sun);
    plant(sun, 4, 4, SPECIES_FERN);
    sun.runTicks(24);
    expect(sun.species[sun.index(4, 4)]).toBe(SPECIES_EMPTY);
  });

  it('lets a fixer feed a neighbor and a cactus hold the dry', () => {
    const fix = MataEngine.create({ name: 'Mata', seed: 'inga', size: 8 });
    fertile(fix);
    plant(fix, 3, 3, SPECIES_INGA, 16);
    const beforeFood = fix.nutrients[fix.index(4, 3)] as number;
    fix.runTicks(6);
    expect(fix.nutrients[fix.index(4, 3)] as number).toBeGreaterThan(beforeFood);

    const dry = MataEngine.create({ name: 'Mata', seed: 'cactus', size: 8 });
    for (let i = 0; i < dry.moisture.length; i++) {
      dry.moisture[i] = 18;
      dry.nutrients[i] = 40;
      dry.soil[i] = 40;
    }
    plant(dry, 1, 1, SPECIES_CACTUS, 12);
    plant(dry, 6, 6, SPECIES_GRASS);
    dry.runTicks(16);
    expect(dry.species[dry.index(1, 1)]).toBe(SPECIES_CACTUS);
    expect(dry.species[dry.index(6, 6)]).toBe(SPECIES_EMPTY);
  });

  it('rejects planting without a seed and watering an empty cistern', () => {
    const engine = MataEngine.create({ name: 'Mata', seed: 'bag', size: 8 });
    engine.seeds.grass = 0;
    expect(engine.execute({ type: 'plant', x: 1, y: 1, species: SPECIES_GRASS })).toEqual({
      ok: false,
      reason: 'no-seed',
    });
    engine.seeds.grass = 1;
    expect(engine.execute({ type: 'plant', x: 1, y: 1, species: SPECIES_GRASS }).ok).toBe(true);
    expect(engine.seeds.grass).toBe(0);
    engine.cistern = 0;
    expect(engine.execute({ type: 'water', x: 1, y: 1 })).toEqual({ ok: false, reason: 'no-water' });
  });

  it('scores a mixed grove above a grass monoculture', () => {
    const mono = MataEngine.create({ name: 'Mata', seed: 'mono', size: 8 });
    fertile(mono);
    fillBag(mono);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        plant(mono, x, y, SPECIES_GRASS, 12);
      }
    }
    const mix = MataEngine.create({ name: 'Mata', seed: 'mix', size: 8 });
    fertile(mix);
    const pattern = [
      [SPECIES_GRASS, 1, 1],
      [SPECIES_GRASS, 2, 1],
      [SPECIES_CROWN, 3, 3],
      [SPECIES_CROWN, 5, 4],
      [SPECIES_INGA, 4, 3],
      [SPECIES_FERN, 3, 4],
      [SPECIES_FERN, 5, 3],
      [SPECIES_FERN, 4, 4],
    ] as const;
    for (const [species, x, y] of pattern) {
      plant(mix, x, y, species, 14);
    }
    mix.runTicks(20);
    mono.runTicks(20);
    expect(scoreBalance(mix)).toBeGreaterThan(scoreBalance(mono));
    expect(mix.stats().unique).toBeGreaterThanOrEqual(3);
  });

  it('loses a crown carpet and wins a mixed stand on the same drought', () => {
    const lose = MataEngine.create({ name: 'Mata', seed: 'scar-dry', size: 8 });
    fillBag(lose);
    lose.cistern = 0;
    for (let y = 1; y < 7; y++) {
      for (let x = 1; x < 7; x++) {
        plant(lose, x, y, SPECIES_CROWN, 16);
      }
    }
    lose.runTicks(DROUGHT_END_TICK);
    expect(lose.outcome).toBe('lost');
    expect(lose.stats().planted).toBeLessThan(6);

    const win = MataEngine.create({ name: 'Mata', seed: 'scar-dry', size: 8 });
    fertile(win);
    fillBag(win);
    win.cistern = 255;
    plant(win, 2, 2, SPECIES_CROWN, 16);
    plant(win, 5, 5, SPECIES_CROWN, 16);
    plant(win, 3, 2, SPECIES_INGA, 14);
    plant(win, 2, 3, SPECIES_FERN, 12);
    plant(win, 1, 2, SPECIES_FERN, 12);
    plant(win, 0, 0, SPECIES_GRASS, 10);
    plant(win, 7, 7, SPECIES_GRASS, 10);
    plant(win, 7, 0, SPECIES_CACTUS, 12);
    plant(win, 0, 7, SPECIES_CACTUS, 12);
    for (let t = 0; t < DROUGHT_END_TICK; t++) {
      if (t < 32 && t % 8 === 0) {
        win.execute({ type: 'water', x: 2, y: 2 });
        win.execute({ type: 'water', x: 5, y: 5 });
      }
      win.step();
    }
    expect(win.tick).toBe(DROUGHT_END_TICK);
    expect(win.outcome).toBe('won');
    expect(win.stats().unique).toBeGreaterThanOrEqual(3);
    expect(win.stats().planted).toBeGreaterThanOrEqual(6);
  });

  it('round-trips a v2 save and migrates a v1 file', () => {
    const engine = MataEngine.create({ name: 'Grove', seed: 'oak', size: 8 });
    fertile(engine);
    plant(engine, 2, 2, SPECIES_CROWN);
    engine.execute({ type: 'water', x: 2, y: 2 });
    engine.runTicks(10);
    const stats = engine.stats();
    const file = encodeMataSave(engine.serialize(), {
      planted: stats.planted,
      unique: stats.unique,
      balance: stats.balance,
      savedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(file.version).toBe(MATA_SAVE_VERSION);
    const text = stringifySave(file);
    const decoded = decodeMataSave(text);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const restored = MataEngine.fromSnapshot(decoded.snapshot);
    expect(restored.hash()).toBe(engine.hash());
    expect(decoded.meta.planted).toBe(stats.planted);
    expect(decoded.snapshot.health[engine.index(2, 2)]).toBe(engine.health[engine.index(2, 2)]);

    const snap = engine.serialize();
    const v1State = {
      name: snap.name,
      seed: snap.seed,
      size: snap.size,
      tick: snap.tick,
      restored: snap.restored,
      rng: snap.rng,
      species: bytesToBase64(snap.species),
      age: bytesToBase64(snap.age),
      moisture: bytesToBase64(snap.moisture),
      nutrients: bytesToBase64(snap.nutrients),
      soil: bytesToBase64(snap.soil),
      fauna: bytesToBase64(snap.fauna),
    };
    const v1 = encodeEnvelope(
      'mata-save',
      1,
      {
        name: snap.name,
        seed: snap.seed,
        size: snap.size,
        tick: snap.tick,
        planted: stats.planted,
        unique: stats.unique,
        balance: stats.balance,
        restored: snap.restored,
        savedAt: '2026-01-01T00:00:00.000Z',
      },
      v1State,
    );
    const migrated = decodeMataSave(stringifySave(v1));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.migratedFrom).toBe(1);
    expect(migrated.snapshot.cistern).toBe(CISTERN_START);
    expect(migrated.snapshot.seeds.grass).toBe(INITIAL_SEEDS.grass);
    expect(migrated.snapshot.health[engine.index(2, 2)]).toBe(PLANT_HEALTH_START);
  });
});
