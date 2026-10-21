import { Fnv1a, Rng, type RngState } from '@shell/kernel';
import {
  ENEMY_COUNT,
  GRID_SIZE,
  PLAYER_COUNT,
  STARTING_HP,
  type NewPostoOptions,
  type Outcome,
  type PostoCommand,
  type PostoCommandResult,
  type PostoSnapshot,
  type PostoStats,
  type Side,
  type Unit,
} from './types';

function cloneUnits(units: readonly Unit[]): Unit[] {
  return units.map((unit) => ({ ...unit }));
}

function cellKey(x: number, y: number): number {
  return y * GRID_SIZE + x;
}

function takeCell(rng: Rng, taken: Set<number>, y0: number, y1: number): { x: number; y: number } {
  for (let n = 0; n < 64; n++) {
    const x = rng.int(GRID_SIZE);
    const y = rng.range(y0, y1);
    const key = cellKey(x, y);
    if (!taken.has(key)) {
      taken.add(key);
      return { x, y };
    }
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const key = cellKey(x, y);
      if (!taken.has(key)) {
        taken.add(key);
        return { x, y };
      }
    }
  }
  throw new Error('No free cell');
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export class PostoEngine {
  readonly seed: string;
  readonly size = GRID_SIZE;
  name: string;
  turn = 0;
  outcome: Outcome = 'playing';
  readonly rng: Rng;
  readonly units: Unit[];

  private constructor(name: string, seed: string, rng: Rng, units: Unit[]) {
    this.name = name;
    this.seed = seed;
    this.rng = rng;
    this.units = units;
  }

  static create(options: NewPostoOptions): PostoEngine {
    const rng = Rng.fromSeed(options.seed);
    const taken = new Set<number>();
    const units: Unit[] = [];
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const cell = takeCell(rng, taken, 0, 2);
      units.push({ id: i, side: 'player', x: cell.x, y: cell.y, hp: STARTING_HP });
    }
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const cell = takeCell(rng, taken, GRID_SIZE - 3, GRID_SIZE - 1);
      units.push({
        id: PLAYER_COUNT + i,
        side: 'enemy',
        x: cell.x,
        y: cell.y,
        hp: STARTING_HP,
      });
    }
    return new PostoEngine(options.name, options.seed, rng, units);
  }

  static fromSnapshot(snapshot: PostoSnapshot): PostoEngine {
    const engine = new PostoEngine(
      snapshot.name,
      snapshot.seed,
      new Rng(snapshot.rng),
      cloneUnits(snapshot.units),
    );
    engine.turn = snapshot.turn;
    engine.outcome = snapshot.outcome;
    return engine;
  }

  serialize(): PostoSnapshot {
    return {
      name: this.name,
      seed: this.seed,
      size: this.size,
      turn: this.turn,
      rng: this.rng.getState() as RngState,
      units: cloneUnits(this.units),
      outcome: this.outcome,
    };
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  living(side?: Side): Unit[] {
    return this.units.filter((unit) => unit.hp > 0 && (side === undefined || unit.side === side));
  }

  unitAt(x: number, y: number): Unit | undefined {
    return this.units.find((unit) => unit.hp > 0 && unit.x === x && unit.y === y);
  }

  execute(command: PostoCommand): PostoCommandResult {
    if (this.outcome !== 'playing') return this.fail('game-over');
    const actor = this.units.find((unit) => unit.id === command.unitId);
    if (!actor) return this.fail('unknown-unit');
    if (actor.hp <= 0) return this.fail('dead');
    if (actor.side !== 'player') return this.fail('wrong-side');

    if (command.type === 'move') {
      if (!this.inBounds(command.x, command.y)) return this.fail('oob');
      if (manhattan(actor.x, actor.y, command.x, command.y) !== 1) return this.fail('not-adjacent');
      if (this.unitAt(command.x, command.y)) return this.fail('occupied');
      actor.x = command.x;
      actor.y = command.y;
    } else {
      const target = this.units.find((unit) => unit.id === command.targetId);
      if (!target) return this.fail('unknown-unit');
      if (target.hp <= 0) return this.fail('dead');
      if (target.side !== 'enemy') return this.fail('wrong-side');
      if (manhattan(actor.x, actor.y, target.x, target.y) !== 1) return this.fail('not-adjacent');
      target.hp -= 1;
    }

    this.refreshOutcome();
    if (this.outcome === 'playing') this.enemyPhase();
    this.turn++;
    this.refreshOutcome();
    return { ok: true, outcome: this.outcome };
  }

  stats(): PostoStats {
    return {
      name: this.name,
      seed: this.seed,
      size: this.size,
      turn: this.turn,
      playerAlive: this.living('player').length,
      enemyAlive: this.living('enemy').length,
      outcome: this.outcome,
    };
  }

  hash(): string {
    const hash = new Fnv1a()
      .string(this.name)
      .string(this.seed)
      .int32s([this.size, this.turn, this.outcomeCode(), ...this.rng.getState()]);
    for (const unit of this.units) {
      hash.int32s([unit.id, unit.side === 'player' ? 0 : 1, unit.x, unit.y, unit.hp]);
    }
    return hash.hex();
  }

  private fail(reason: NonNullable<PostoCommandResult['reason']>): PostoCommandResult {
    return { ok: false, reason, outcome: this.outcome };
  }

  private outcomeCode(): number {
    if (this.outcome === 'victory') return 1;
    if (this.outcome === 'defeat') return 2;
    return 0;
  }

  private refreshOutcome(): void {
    if (this.living('enemy').length === 0) this.outcome = 'victory';
    else if (this.living('player').length === 0) this.outcome = 'defeat';
  }

  private enemyPhase(): void {
    const enemies = this.living('enemy').slice().sort((a, b) => a.id - b.id);
    for (const enemy of enemies) {
      if (this.outcome !== 'playing' || enemy.hp <= 0) continue;
      this.actEnemy(enemy);
      this.refreshOutcome();
    }
  }

  private actEnemy(enemy: Unit): void {
    const players = this.living('player');
    if (players.length === 0) return;
    const adjacent = players.filter((player) => manhattan(enemy.x, enemy.y, player.x, player.y) === 1);
    if (adjacent.length > 0) {
      const target = adjacent[this.rng.int(adjacent.length)];
      if (target) target.hp -= 1;
      return;
    }
    let best = Infinity;
    const nearest: Unit[] = [];
    for (const player of players) {
      const dist = manhattan(enemy.x, enemy.y, player.x, player.y);
      if (dist < best) {
        best = dist;
        nearest.length = 0;
        nearest.push(player);
      } else if (dist === best) {
        nearest.push(player);
      }
    }
    const focus = nearest[this.rng.int(nearest.length)];
    if (!focus) return;
    const dx = focus.x - enemy.x;
    const dy = focus.y - enemy.y;
    const steps: { x: number; y: number }[] = [];
    const stepX = { x: enemy.x + (dx > 0 ? 1 : -1), y: enemy.y };
    const stepY = { x: enemy.x, y: enemy.y + (dy > 0 ? 1 : -1) };
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx !== 0) steps.push(stepX);
      if (dy !== 0) steps.push(stepY);
    } else {
      if (dy !== 0) steps.push(stepY);
      if (dx !== 0) steps.push(stepX);
    }
    for (const step of steps) {
      if (this.inBounds(step.x, step.y) && !this.unitAt(step.x, step.y)) {
        enemy.x = step.x;
        enemy.y = step.y;
        return;
      }
    }
  }
}
