import {
  INFLUENCE_LAYERS,
  STRUCTURE_LAYERS,
  type BuildingRecord,
  type CityStats,
  type Command,
  type CommandResult,
  type Delta,
  type EngineSnapshot,
  type FromWorkerMessage,
  type FullState,
  type HistoryEntry,
  type NewCityOptions,
  type SimEvent,
  type Speed,
  type ToWorkerMessage,
} from '@city/shared';
import { World } from '@city/simulation';

export interface ClientListener {
  /** A new city was loaded: everything must be rebuilt. */
  onInit?(): void;
  /** Tiles changed (`all` = every tile, e.g. after a heights change). */
  onTiles?(indices: Int32Array | null, all: boolean): void;
  onInfluence?(): void;
  onBuildings?(changed: BuildingRecord[], removed: number[]): void;
  onStats?(stats: CityStats): void;
  onHistory?(history: HistoryEntry[]): void;
  onEvents?(events: SimEvent[]): void;
  onError?(message: string): void;
}

type Pending = (message: FromWorkerMessage) => void;

/**
 * Main-thread bridge to the simulation worker. Keeps a read-only mirror of the world so the
 * renderer and the UI can read state and run validation locally.
 */
export class CityClient {
  world: World | null = null;
  readonly buildings = new Map<number, BuildingRecord>();
  stats: CityStats | null = null;
  history: HistoryEntry[] = [];
  name = '';
  seed = '';

  private readonly worker: Worker;
  private readonly listeners = new Set<ClientListener>();
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private initResolvers: Array<() => void> = [];

  constructor() {
    this.worker = new Worker(new URL('../worker/sim.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<FromWorkerMessage>) => this.handle(event.data);
  }

  subscribe(listener: ClientListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  newCity(options: NewCityOptions): Promise<void> {
    return this.waitInit(() => this.send({ type: 'newCity', options }));
  }

  loadCity(snapshot: EngineSnapshot): Promise<void> {
    return this.waitInit(() => this.send({ type: 'loadCity', snapshot }));
  }

  command(command: Command): Promise<CommandResult> {
    return this.request({ type: 'command', id: 0, command }, (m) => (m.type === 'commandResult' ? m.result : undefined));
  }

  setSpeed(speed: Speed): void {
    this.send({ type: 'setSpeed', speed });
  }

  runTicks(ticks: number): Promise<void> {
    return this.request({ type: 'runTicks', id: 0, ticks }, () => undefined);
  }

  snapshot(): Promise<EngineSnapshot> {
    return this.request({ type: 'snapshot', id: 0 }, (m) => (m.type === 'snapshot' ? m.snapshot : undefined));
  }

  hash(): Promise<string> {
    return this.request({ type: 'hash', id: 0 }, (m) => (m.type === 'hash' ? m.hash : undefined));
  }

  dispose(): void {
    this.worker.terminate();
  }

  private waitInit(start: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.initResolvers.push(resolve);
      start();
    });
  }

  private request<T>(message: ToWorkerMessage & { id: number }, pick: (m: FromWorkerMessage) => T | undefined): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve) => {
      this.pending.set(id, (m) => resolve(pick(m) as T));
      this.send({ ...message, id } as ToWorkerMessage);
    });
  }

  private send(message: ToWorkerMessage): void {
    this.worker.postMessage(message);
  }

  private emit<K extends keyof ClientListener>(key: K, ...args: Parameters<NonNullable<ClientListener[K]>>): void {
    for (const listener of this.listeners) {
      const fn = listener[key] as ((...a: unknown[]) => void) | undefined;
      fn?.apply(listener, args);
    }
  }

  private handle(message: FromWorkerMessage): void {
    switch (message.type) {
      case 'init':
        this.applyInit(message.state);
        break;
      case 'delta':
        this.applyDelta(message.delta);
        break;
      case 'error':
        console.error('[simulation]', message.message);
        this.emit('onError', message.message);
        break;
      default: {
        const resolve = this.pending.get(message.id);
        if (resolve) {
          this.pending.delete(message.id);
          resolve(message);
        }
      }
    }
  }

  private applyInit(state: FullState): void {
    const world = new World(state.size);
    world.heights.set(state.heights);
    for (const name of STRUCTURE_LAYERS) world.structure[name].set(state.structure[name]);
    for (const name of INFLUENCE_LAYERS) world.influence[name].set(state.influence[name]);
    world.buildingId.set(state.buildingId);
    world.takeDirty();
    this.world = world;
    this.name = state.name;
    this.seed = state.seed;
    this.buildings.clear();
    for (const b of state.buildings) this.buildings.set(b.id, b);
    this.stats = state.stats;
    this.history = state.history;
    this.emit('onInit');
    this.emit('onStats', state.stats);
    this.emit('onHistory', state.history);
    const resolvers = this.initResolvers;
    this.initResolvers = [];
    for (const resolve of resolvers) resolve();
  }

  private applyDelta(delta: Delta): void {
    const world = this.world;
    if (!world) return;
    for (const id of delta.removedBuildings) this.buildings.delete(id);
    for (const b of delta.buildings) this.buildings.set(b.id, b);
    if (delta.heights) world.heights.set(delta.heights);
    if (delta.tiles) {
      const { indices, structure, buildingId } = delta.tiles;
      for (const name of STRUCTURE_LAYERS) {
        const target = world.structure[name];
        const values = structure[name];
        for (let k = 0; k < indices.length; k++) target[indices[k] as number] = values[k] as number;
      }
      for (let k = 0; k < indices.length; k++) world.buildingId[indices[k] as number] = buildingId[k] as number;
    }
    if (delta.influence) {
      for (const name of INFLUENCE_LAYERS) world.influence[name].set(delta.influence[name]);
    }
    if (delta.buildings.length > 0 || delta.removedBuildings.length > 0) {
      this.emit('onBuildings', delta.buildings, delta.removedBuildings);
    }
    if (delta.heights) this.emit('onTiles', null, true);
    else if (delta.tiles) this.emit('onTiles', delta.tiles.indices, false);
    if (delta.influence) this.emit('onInfluence');
    this.stats = delta.stats;
    this.emit('onStats', delta.stats);
    if (delta.history) {
      this.history = delta.history;
      this.emit('onHistory', delta.history);
    }
    if (delta.events.length > 0) this.emit('onEvents', delta.events);
  }
}
