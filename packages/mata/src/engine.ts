import { CommandQueue, Fnv1a, Rng, runTicks, type RngState } from '@shell/kernel';
import {
  add8,
  collectStats,
  computeShade,
  faunaTarget,
  inBounds,
  isFatal,
  isStalled,
  judgeGrove,
  set8,
  tileIndex,
  tileProblems,
} from './diagnostics';
import {
  CISTERN_COST,
  CISTERN_MAX,
  CISTERN_RAIN,
  CISTERN_START,
  DROUGHT_END_TICK,
  ERODE_CHANCE,
  HEALTH_FATAL,
  HEALTH_RECOVER,
  INITIAL_SEEDS,
  MATURE_AGE,
  MAX_AGE,
  MATA_SIZE_DEFAULT,
  MATA_SIZE_MAX,
  MATA_SIZE_MIN,
  ORTHO,
  PLANT_HEALTH_START,
  SPECIES_CACTUS,
  SPECIES_CROWN,
  SPECIES_EMPTY,
  SPECIES_FERN,
  SPECIES_GRASS,
  SPECIES_INGA,
  SPECIES_KEY,
  SPECIES_TRAITS,
  WATER_PULSE,
  copySeeds,
  isRaining,
  type MataCommand,
  type MataCommandResult,
  type MataGrid,
  type MataOutcome,
  type MataSnapshot,
  type MataStats,
  type NewMataOptions,
  type PlantSpecies,
  type SeedBag,
  type SpeciesId,
  isPlantSpecies,
} from './types';

function clampSize(size: number): number {
  if (!Number.isInteger(size)) return MATA_SIZE_DEFAULT;
  if (size < MATA_SIZE_MIN) return MATA_SIZE_MIN;
  if (size > MATA_SIZE_MAX) return MATA_SIZE_MAX;
  return size;
}

function clampCistern(value: number): number {
  if (value < 0) return 0;
  if (value > CISTERN_MAX) return CISTERN_MAX;
  return value | 0;
}

export class MataEngine implements MataGrid {
  readonly species: Uint8Array;
  readonly age: Uint8Array;
  readonly moisture: Uint8Array;
  readonly nutrients: Uint8Array;
  readonly soil: Uint8Array;
  readonly fauna: Uint8Array;
  readonly health: Uint8Array;
  readonly seeds: SeedBag;
  readonly rng: Rng;
  readonly seed: string;
  readonly size: number;
  readonly sandbox: boolean;
  name: string;
  tick = 0;
  restored = false;
  cistern = CISTERN_START;
  outcome: MataOutcome = 'playing';
  private readonly queue = new CommandQueue<MataCommand>();

  private constructor(
    size: number,
    rng: Rng,
    seed: string,
    name: string,
    sandbox: boolean,
    layers?: Pick<MataGrid, 'species' | 'age' | 'moisture' | 'nutrients' | 'soil' | 'fauna' | 'health'>,
    extras?: { seeds?: SeedBag; cistern?: number },
  ) {
    this.size = size;
    this.rng = rng;
    this.seed = seed;
    this.name = name;
    this.sandbox = sandbox;
    const cells = size * size;
    this.species = layers?.species.slice() ?? new Uint8Array(cells);
    this.age = layers?.age.slice() ?? new Uint8Array(cells);
    this.moisture = layers?.moisture.slice() ?? new Uint8Array(cells);
    this.nutrients = layers?.nutrients.slice() ?? new Uint8Array(cells);
    this.soil = layers?.soil.slice() ?? new Uint8Array(cells);
    this.fauna = layers?.fauna.slice() ?? new Uint8Array(cells);
    this.health = layers?.health.slice() ?? new Uint8Array(cells);
    this.seeds = copySeeds(extras?.seeds ?? INITIAL_SEEDS);
    if (extras?.cistern !== undefined) this.cistern = clampCistern(extras.cistern);
  }

  static create(options: NewMataOptions): MataEngine {
    const size = clampSize(options.size);
    const sandbox = options.preset === 'menu';
    const engine = new MataEngine(size, Rng.fromSeed(options.seed), options.seed, options.name, sandbox);
    if (sandbox) engine.paintMenu();
    else engine.paintWild();
    return engine;
  }

  static fromSnapshot(snapshot: MataSnapshot): MataEngine {
    const engine = new MataEngine(
      snapshot.size,
      new Rng(snapshot.rng),
      snapshot.seed,
      snapshot.name,
      snapshot.sandbox,
      snapshot,
      { seeds: snapshot.seeds, cistern: snapshot.cistern },
    );
    engine.tick = snapshot.tick;
    engine.restored = snapshot.restored;
    engine.outcome = snapshot.outcome;
    return engine;
  }

  serialize(): MataSnapshot {
    return {
      name: this.name,
      seed: this.seed,
      size: this.size,
      tick: this.tick,
      restored: this.restored,
      sandbox: this.sandbox,
      cistern: this.cistern,
      outcome: this.outcome,
      seeds: copySeeds(this.seeds),
      rng: this.rng.getState() as RngState,
      species: this.species.slice(),
      age: this.age.slice(),
      moisture: this.moisture.slice(),
      nutrients: this.nutrients.slice(),
      soil: this.soil.slice(),
      fauna: this.fauna.slice(),
      health: this.health.slice(),
    };
  }

  inBounds(x: number, y: number): boolean {
    return inBounds(this.size, x, y);
  }

  index(x: number, y: number): number {
    return tileIndex(this.size, x, y);
  }

  enqueue(command: MataCommand): void {
    this.queue.enqueue(command);
  }

  execute(command: MataCommand): MataCommandResult {
    if (!this.sandbox && this.outcome !== 'playing') return { ok: false, reason: 'over' };
    if (!this.inBounds(command.x, command.y)) return { ok: false, reason: 'oob' };
    const i = this.index(command.x, command.y);
    if (command.type === 'water') {
      if (this.cistern < CISTERN_COST) return { ok: false, reason: 'no-water' };
      this.cistern -= CISTERN_COST;
      add8(this.moisture, i, WATER_PULSE);
      return { ok: true };
    }
    if (command.type === 'clear') {
      if (this.species[i] === SPECIES_EMPTY) return { ok: false, reason: 'empty' };
      this.clearTile(i);
      return { ok: true };
    }
    if (!isPlantSpecies(command.species)) return { ok: false, reason: 'bad-species' };
    if (this.species[i] !== SPECIES_EMPTY) return { ok: false, reason: 'occupied' };
    const key = SPECIES_KEY[command.species];
    if (this.seeds[key] <= 0) return { ok: false, reason: 'no-seed' };
    this.seeds[key] -= 1;
    this.species[i] = command.species;
    this.age[i] = 0;
    this.health[i] = PLANT_HEALTH_START;
    return { ok: true };
  }

  step(): void {
    if (!this.sandbox && this.outcome !== 'playing') return;
    this.queue.drain((command) => this.execute(command));
    const shade = computeShade(this);
    this.cycleLand(shade);
    this.cyclePlants(shade);
    this.cycleFauna();
    this.tick++;
    this.resolveOutcome();
    const stats = this.stats();
    this.restored = stats.restored;
  }

  runTicks(count: number): void {
    runTicks(count, () => this.step());
  }

  stats(): MataStats {
    return collectStats(this, {
      name: this.name,
      seed: this.seed,
      tick: this.tick,
      restored: this.restored,
      cistern: this.cistern,
      outcome: this.outcome,
      seeds: this.seeds,
    });
  }

  hash(): string {
    const outcomeCode = this.outcome === 'won' ? 1 : this.outcome === 'lost' ? 2 : 0;
    return new Fnv1a()
      .string(this.name)
      .string(this.seed)
      .int32s([
        this.size,
        this.tick,
        this.restored ? 1 : 0,
        this.sandbox ? 1 : 0,
        this.cistern,
        outcomeCode,
        this.seeds.grass,
        this.seeds.crown,
        this.seeds.fern,
        this.seeds.inga,
        this.seeds.cactus,
        ...this.rng.getState(),
      ])
      .bytes(this.species)
      .bytes(this.age)
      .bytes(this.moisture)
      .bytes(this.nutrients)
      .bytes(this.soil)
      .bytes(this.fauna)
      .bytes(this.health)
      .hex();
  }

  private paintWild(): void {
    const cells = this.size * this.size;
    for (let i = 0; i < cells; i++) {
      const scorched = this.rng.chance(0.14);
      set8(this.moisture, i, scorched ? this.rng.int(16) : 36 + this.rng.int(28));
      set8(this.nutrients, i, 10 + this.rng.int(22));
      set8(this.soil, i, scorched ? this.rng.int(14) : 8 + this.rng.int(20));
    }
  }

  private paintMenu(): void {
    const cells = this.size * this.size;
    for (let i = 0; i < cells; i++) {
      set8(this.moisture, i, 110 + this.rng.int(40));
      set8(this.nutrients, i, 90 + this.rng.int(50));
      set8(this.soil, i, 100 + this.rng.int(50));
    }
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const i = this.index(x, y);
        const inner = x > 1 && y > 1 && x < this.size - 2 && y < this.size - 2;
        if (!inner) continue;
        if (x === 2 && y === 2) {
          this.plantAt(i, SPECIES_CACTUS, 12);
          continue;
        }
        if (x % 4 === 2 && y % 4 === 2) {
          this.plantAt(i, SPECIES_CROWN, 16);
          continue;
        }
        if (x % 4 === 3 && y % 4 === 2) {
          this.plantAt(i, SPECIES_INGA, 14);
          continue;
        }
        if ((x + y) % 3 === 0) this.plantAt(i, SPECIES_GRASS, 10);
      }
    }
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const i = this.index(x, y);
        if (this.species[i] !== SPECIES_EMPTY) continue;
        if (this.nearMature(x, y, SPECIES_CROWN) || this.nearMature(x, y, SPECIES_INGA)) {
          if ((x + y) % 2 === 0) this.plantAt(i, SPECIES_FERN, 11);
        }
      }
    }
    for (let i = 0; i < cells; i++) {
      if (this.species[i] !== SPECIES_EMPTY) set8(this.fauna, i, 40 + this.rng.int(70));
    }
  }

  private plantAt(index: number, species: PlantSpecies, age: number): void {
    this.species[index] = species;
    this.age[index] = age > MAX_AGE ? MAX_AGE : age;
    this.health[index] = PLANT_HEALTH_START;
  }

  private clearTile(index: number): void {
    this.species[index] = SPECIES_EMPTY;
    this.age[index] = 0;
    this.health[index] = 0;
  }

  private nearMature(x: number, y: number, species: PlantSpecies): boolean {
    for (const [dx, dy] of ORTHO) {
      const nx = x + dx;
      const ny = y + dy;
      if (!this.inBounds(nx, ny)) continue;
      const i = this.index(nx, ny);
      if (this.species[i] === species && (this.age[i] as number) >= MATURE_AGE) return true;
    }
    return false;
  }

  private cycleLand(shade: Uint8Array): void {
    const raining = isRaining(this.tick, this.sandbox);
    if (raining) this.cistern = clampCistern(this.cistern + CISTERN_RAIN);
    const rain = raining ? 4 : 0;
    const nextMoisture = this.moisture.slice();
    const nextNutrients = this.nutrients.slice();
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const i = this.index(x, y);
        const species = this.species[i] as SpeciesId;
        const age = this.age[i] as number;
        const cover = (shade[i] as number) >= 30;
        let evap = cover ? 2 : 5;
        if (species === SPECIES_FERN) evap -= 2;
        if (isPlantSpecies(species)) evap -= 1;
        add8(nextMoisture, i, rain - evap);

        if (isPlantSpecies(species)) {
          const traits = SPECIES_TRAITS[species];
          add8(nextMoisture, i, -traits.water);
          add8(nextNutrients, i, -traits.nutrients);
          if (species === SPECIES_INGA && age >= MATURE_AGE) {
            add8(nextNutrients, i, 6);
            for (const [dx, dy] of ORTHO) {
              const nx = x + dx;
              const ny = y + dy;
              if (this.inBounds(nx, ny)) add8(nextNutrients, this.index(nx, ny), 4);
            }
          }
          if (age >= MATURE_AGE) {
            if (species === SPECIES_GRASS) add8(this.soil, i, 2);
            else if (species === SPECIES_FERN || species === SPECIES_CROWN) add8(this.soil, i, 1);
          }
        } else if ((this.moisture[i] as number) < 16 && this.rng.chance(ERODE_CHANCE)) {
          add8(this.soil, i, -1);
        }
      }
    }
    this.moisture.set(nextMoisture);
    this.nutrients.set(nextNutrients);
  }

  private cyclePlants(shade: Uint8Array): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const i = this.index(x, y);
        const species = this.species[i] as SpeciesId;
        if (!isPlantSpecies(species)) continue;
        const problems = tileProblems(this, x, y, shade[i] as number);
        if (isFatal(problems)) add8(this.health, i, -HEALTH_FATAL);
        else if (!isStalled(problems)) add8(this.health, i, HEALTH_RECOVER);
        if ((this.health[i] as number) === 0) {
          this.clearTile(i);
          continue;
        }
        if (isStalled(problems) || (this.age[i] as number) >= MAX_AGE) continue;
        const before = this.age[i] as number;
        this.age[i] = before + 1;
        const age = this.age[i] as number;
        if (age >= MATURE_AGE && age % MATURE_AGE === 0 && age > before) {
          this.seeds[SPECIES_KEY[species]] += 1;
        }
      }
    }
  }

  private cycleFauna(): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const i = this.index(x, y);
        const target = faunaTarget(this, x, y);
        const current = this.fauna[i] as number;
        if (current < target) add8(this.fauna, i, current + 10 > target ? target - current : 10);
        else if (current > target) add8(this.fauna, i, current - 8 < target ? target - current : -8);
      }
    }
  }

  private resolveOutcome(): void {
    if (this.sandbox || this.outcome !== 'playing') return;
    if (this.tick !== DROUGHT_END_TICK) return;
    this.outcome = judgeGrove(this);
    this.restored = this.outcome === 'won';
  }
}
