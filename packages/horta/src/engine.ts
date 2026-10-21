import { CommandQueue, Fnv1a, Rng, runTicks, type RngState } from '@shell/kernel';
import {
  GROW_CHANCE,
  PLOT_EMPTY,
  PLOT_PLANTED,
  PLOT_RIPE,
  type HortaCommand,
  type HortaCommandResult,
  type HortaSnapshot,
  type HortaStats,
  type NewHortaOptions,
} from './types';

export class HortaEngine {
  readonly plots: Uint8Array;
  readonly rng: Rng;
  readonly seed: string;
  readonly size: number;
  name: string;
  tick = 0;
  harvested = 0;
  private readonly queue = new CommandQueue<HortaCommand>();

  private constructor(
    size: number,
    rng: Rng,
    seed: string,
    name: string,
    plots?: Uint8Array,
    harvested = 0,
  ) {
    this.size = size;
    this.rng = rng;
    this.seed = seed;
    this.name = name;
    this.plots = plots ?? new Uint8Array(size * size);
    this.harvested = harvested;
  }

  static create(options: NewHortaOptions): HortaEngine {
    return new HortaEngine(options.size, Rng.fromSeed(options.seed), options.seed, options.name);
  }

  static fromSnapshot(snapshot: HortaSnapshot): HortaEngine {
    const engine = new HortaEngine(
      snapshot.size,
      new Rng(snapshot.rng),
      snapshot.seed,
      snapshot.name,
      snapshot.plots.slice(),
      snapshot.harvested,
    );
    engine.tick = snapshot.tick;
    return engine;
  }

  serialize(): HortaSnapshot {
    return {
      name: this.name,
      seed: this.seed,
      size: this.size,
      tick: this.tick,
      harvested: this.harvested,
      rng: this.rng.getState() as RngState,
      plots: this.plots.slice(),
    };
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  index(x: number, y: number): number {
    return y * this.size + x;
  }

  enqueue(command: HortaCommand): void {
    this.queue.enqueue(command);
  }

  execute(command: HortaCommand): HortaCommandResult {
    if (!this.inBounds(command.x, command.y)) return { ok: false, reason: 'oob' };
    const i = this.index(command.x, command.y);
    const current = this.plots[i] as number;
    if (command.type === 'plant') {
      if (current !== PLOT_EMPTY) return { ok: false, reason: 'occupied' };
      this.plots[i] = PLOT_PLANTED;
      return { ok: true };
    }
    if (command.type === 'harvest') {
      if (current !== PLOT_RIPE) return { ok: false, reason: current === PLOT_EMPTY ? 'empty' : 'not-ripe' };
      this.plots[i] = PLOT_EMPTY;
      this.harvested++;
      return { ok: true };
    }
    if (current === PLOT_EMPTY) return { ok: false, reason: 'empty' };
    this.plots[i] = PLOT_EMPTY;
    return { ok: true };
  }

  step(): void {
    this.queue.drain((command) => this.execute(command));
    for (let i = 0; i < this.plots.length; i++) {
      if (this.plots[i] === PLOT_PLANTED && this.rng.chance(GROW_CHANCE)) {
        this.plots[i] = PLOT_RIPE;
      }
    }
    this.tick++;
  }

  runTicks(count: number): void {
    runTicks(count, () => this.step());
  }

  stats(): HortaStats {
    let planted = 0;
    let ripe = 0;
    for (let i = 0; i < this.plots.length; i++) {
      if (this.plots[i] === PLOT_PLANTED) planted++;
      else if (this.plots[i] === PLOT_RIPE) ripe++;
    }
    return {
      name: this.name,
      seed: this.seed,
      size: this.size,
      tick: this.tick,
      planted,
      ripe,
      harvested: this.harvested,
    };
  }

  hash(): string {
    return new Fnv1a()
      .string(this.name)
      .string(this.seed)
      .int32s([this.size, this.tick, this.harvested, ...this.rng.getState()])
      .bytes(this.plots)
      .hex();
  }
}
