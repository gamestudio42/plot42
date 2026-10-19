import {
  BALANCE,
  DEPARTMENTS,
  EXPENSE_CATEGORIES,
  type ActiveDisaster,
  isToolCommand,
  type CityStats,
  type Command,
  type CommandPreview,
  type CommandResult,
  type DisasterKind,
  type EconomyState,
  type EngineSnapshot,
  type HistoryEntry,
  type MonthlyReport,
  type NewCityOptions,
  type RciValues,
  type SimEvent,
  type TerrainOptions,
  type ToolCommand,
} from '@city/shared';
import { applyToolPlan } from './commands/apply';
import { planToolCommand, type PlanContext } from './commands/plan';
import { applyPolicyCommand } from './commands/policy';
import { Rng } from './rng/rng';
import { DEFAULT_TERRAIN, generateTerrain } from './terrain/generate';
import { World } from './world/world';
import { BuildingStore } from './world/buildings';

export interface EngineOptions {
  name?: string;
  seed: string | number;
  size?: number;
  terrain?: Partial<TerrainOptions>;
}

export function createEngine(options: NewCityOptions | EngineOptions): SimulationEngine {
  return SimulationEngine.create(options);
}

export interface LoggedCommand {
  tick: number;
  command: Command;
}

/** A system updates part of the simulation. Systems are run in registration order. */
export interface System {
  readonly id: string;
  update(engine: SimulationEngine): void;
}

export function emptyReport(): MonthlyReport {
  return {
    revenue: { residential: 0, commercial: 0, industrial: 0 },
    expenses: Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as MonthlyReport['expenses'],
    construction: 0,
    net: 0,
  };
}

export function defaultEconomy(): EconomyState {
  const tax = BALANCE.economy.taxDefault;
  return {
    funds: BALANCE.startingFunds,
    constructionThisMonth: 0,
    taxes: { residential: tax, commercial: tax, industrial: tax },
    funding: Object.fromEntries(DEPARTMENTS.map((d) => [d, 100])) as EconomyState['funding'],
    lastMonth: emptyReport(),
    monthsInDebt: 0,
    bankrupt: false,
  };
}

export class SimulationEngine {
  readonly world: World;
  readonly buildings: BuildingStore;
  readonly rng: Rng;
  readonly seed: string;
  name: string;
  tick = 0;
  economy: EconomyState = defaultEconomy();
  demand: RciValues = { residential: 0, commercial: 0, industrial: 0 };
  history: HistoryEntry[] = [];
  disasters: ActiveDisaster[] = [];
  disastersEnabled = true;
  networksDirty = true;
  lastMilestone = 0;
  historyDirty = false;

  readonly commandLog: LoggedCommand[] = [];
  private readonly queue: Command[] = [];
  private pendingEvents: SimEvent[] = [];
  private readonly systems: System[] = [];

  private constructor(world: World, rng: Rng, seed: string, name: string) {
    this.world = world;
    this.rng = rng;
    this.seed = seed;
    this.name = name;
    this.buildings = new BuildingStore(world);
  }

  static create(options: EngineOptions): SimulationEngine {
    const size = options.size ?? BALANCE.map.defaultSize;
    const seed = String(options.seed);
    const world = new World(size);
    const rng = Rng.fromSeed(seed);
    generateTerrain(world, rng.fork(), { ...DEFAULT_TERRAIN, ...options.terrain });
    return new SimulationEngine(world, rng, seed, options.name ?? 'Nova Cidade');
  }

  static fromSnapshot(snapshot: EngineSnapshot): SimulationEngine {
    const world = new World(snapshot.size);
    world.heights.set(snapshot.heights);
    for (const [name, data] of Object.entries(snapshot.layers)) {
      const target = (world.structure as Record<string, Uint8Array>)[name] ?? (world.influence as Record<string, Uint8Array>)[name];
      if (!target) throw new Error(`Unknown layer ${name}`);
      target.set(data);
    }
    const engine = new SimulationEngine(world, new Rng(snapshot.rng), snapshot.seed, snapshot.name);
    for (const record of snapshot.buildings) engine.buildings.restore(record);
    engine.buildings.nextId = snapshot.nextBuildingId;
    engine.tick = snapshot.tick;
    engine.economy = structuredCopy(snapshot.economy);
    engine.demand = { ...snapshot.demand };
    engine.history = snapshot.history.map((h) => ({ ...h }));
    engine.disasters = snapshot.disasters.map((d) => ({ ...d }));
    engine.disastersEnabled = snapshot.disastersEnabled;
    engine.networksDirty = snapshot.networksDirty;
    engine.lastMilestone = snapshot.lastMilestone;
    world.markAllDirty();
    engine.buildings.takeChanges();
    return engine;
  }

  serialize(): EngineSnapshot {
    const layers = {} as EngineSnapshot['layers'];
    for (const [name, data] of Object.entries(this.world.structure)) {
      layers[name as keyof EngineSnapshot['layers']] = data.slice();
    }
    for (const [name, data] of Object.entries(this.world.influence)) {
      layers[name as keyof EngineSnapshot['layers']] = data.slice();
    }
    return {
      name: this.name,
      seed: this.seed,
      size: this.world.size,
      tick: this.tick,
      rng: this.rng.getState(),
      heights: this.world.heights.slice(),
      layers,
      buildings: this.buildings.list().map((b) => ({ ...b })),
      nextBuildingId: this.buildings.nextId,
      economy: structuredCopy(this.economy),
      demand: { ...this.demand },
      history: this.history.map((h) => ({ ...h })),
      disasters: this.disasters.map((d) => ({ ...d })),
      disastersEnabled: this.disastersEnabled,
      networksDirty: this.networksDirty,
      lastMilestone: this.lastMilestone,
    };
  }

  registerSystem(system: System): void {
    this.systems.push(system);
  }

  emit(event: SimEvent): void {
    this.pendingEvents.push(event);
  }

  takeEvents(): SimEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  /** Queues a command for the start of the next tick. */
  enqueue(command: Command): void {
    this.queue.push(command);
  }

  /** Applies a command immediately (between ticks) and records it for replay. */
  execute(command: Command): CommandResult {
    this.commandLog.push({ tick: this.tick, command });
    return this.apply(command);
  }

  step(): void {
    while (this.queue.length > 0) this.execute(this.queue.shift() as Command);
    for (const system of this.systems) system.update(this);
    this.tick++;
  }

  runTicks(count: number): void {
    for (let i = 0; i < count; i++) this.step();
  }

  stats(): CityStats {
    return {
      name: this.name,
      tick: this.tick,
      day: 1,
      month: 0,
      year: 2000,
      funds: this.economy.funds,
      population: 0,
      housingCapacity: 0,
      workforce: 0,
      jobs: { residential: 0, commercial: 0, industrial: 0 },
      employed: { residential: 0, commercial: 0, industrial: 0 },
      unemployment: 0,
      demand: { ...this.demand },
      taxes: { ...this.economy.taxes },
      funding: { ...this.economy.funding },
      lastMonth: this.economy.lastMonth,
      power: { supply: 0, demand: 0, served: 0 },
      water: { supply: 0, demand: 0, served: 0 },
      avgCongestion: 0,
      averages: { pollution: 0, crime: 0, landValue: 0 },
      coverage: { police: 0, fire: 0, health: 0, education: 0 },
      counts: { roads: 0, residential: 0, commercial: 0, industrial: 0, abandoned: 0, services: 0, plants: 0 },
      monthsInDebt: this.economy.monthsInDebt,
      bankrupt: this.economy.bankrupt,
      activeFires: 0,
      disasters: this.disasters.map((d) => ({ ...d })),
      disastersEnabled: this.disastersEnabled,
      edgeConnected: false,
    };
  }

  /** Validates a tool command against the current state without applying it. */
  preview(command: ToolCommand): CommandPreview {
    const { ok, cost, valid, invalid, reason } = planToolCommand(this.planContext(), command);
    return reason ? { ok, cost, valid, invalid, reason } : { ok, cost, valid, invalid };
  }

  planContext(): PlanContext {
    return {
      world: this.world,
      building: (id) => this.buildings.get(id),
      funds: this.economy.funds,
      bankrupt: this.economy.bankrupt,
    };
  }

  /** Starts a disaster on demand. Returns false when the disaster cannot start. */
  triggerDisaster(_kind: DisasterKind, _x?: number, _y?: number): boolean {
    return false;
  }

  private apply(command: Command): CommandResult {
    if (!isToolCommand(command)) return applyPolicyCommand(this, command);
    const plan = planToolCommand(this.planContext(), command);
    if (plan.ok) applyToolPlan(this, command, plan);
    const result: CommandResult = {
      ok: plan.ok,
      cost: plan.ok ? plan.cost : 0,
      applied: plan.ok ? plan.valid.length : 0,
      skipped: plan.invalid.length,
    };
    if (plan.reason) result.reason = plan.reason;
    return result;
  }
}

function structuredCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
