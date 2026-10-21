import type {
  FromMataMessage,
  LoadMataResult,
  MataCommand,
  MataCommandResult,
  MataDelta,
  MataFullState,
  MataGrid,
  MataMeta,
  MataSnapshot,
  MataSpeed,
  MataStats,
  NewMataOptions,
  ToMataMessage,
} from '@mata/sim';
import { emitListeners, RpcInbox } from '@shell/bridge';

export interface MataListener {
  onInit?(): void;
  onWorld?(): void;
  onStats?(stats: MataStats): void;
  onError?(message: string): void;
}

export class MataClient implements MataGrid {
  species = new Uint8Array(0);
  age = new Uint8Array(0);
  moisture = new Uint8Array(0);
  nutrients = new Uint8Array(0);
  soil = new Uint8Array(0);
  fauna = new Uint8Array(0);
  health = new Uint8Array(0);
  stats: MataStats | null = null;
  name = '';
  seed = '';
  size = 0;

  private readonly worker: Worker;
  private readonly listeners = new Set<MataListener>();
  private readonly rpc = new RpcInbox<FromMataMessage>();

  constructor() {
    this.worker = new Worker(new URL('./worker/mata.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<FromMataMessage>) => this.handle(event.data);
  }

  subscribe(listener: MataListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  newGame(options: NewMataOptions): Promise<void> {
    return this.rpc.waitInit(() => this.send({ type: 'newGame', options }));
  }

  command(command: MataCommand): Promise<MataCommandResult> {
    return this.rpc.request(
      (id) => this.send({ type: 'command', id, command }),
      (m) => (m.type === 'commandResult' ? m.result : undefined),
    );
  }

  setSpeed(speed: MataSpeed): void {
    this.send({ type: 'setSpeed', speed });
  }

  snapshot(): Promise<MataSnapshot> {
    return this.rpc.request(
      (id) => this.send({ type: 'snapshot', id }),
      (m) => (m.type === 'snapshot' ? m.snapshot : undefined),
    );
  }

  hash(): Promise<string> {
    return this.rpc.request(
      (id) => this.send({ type: 'hash', id }),
      (m) => (m.type === 'hash' ? m.hash : undefined),
    );
  }

  exportSave(savedAt: string): Promise<{ text: string; meta: MataMeta }> {
    return this.rpc.request(
      (id) => this.send({ type: 'exportSave', id, savedAt }),
      (m) => (m.type === 'saveData' ? { text: m.text, meta: m.meta } : undefined),
    );
  }

  importSave(text: string): Promise<LoadMataResult> {
    return this.rpc.request(
      (id) => this.send({ type: 'importSave', id, text }),
      (m) => (m.type === 'loadResult' ? m.result : undefined),
    );
  }

  dispose(): void {
    this.worker.terminate();
  }

  private send(message: ToMataMessage): void {
    this.worker.postMessage(message);
  }

  private emit<K extends keyof MataListener>(
    key: K,
    ...args: Parameters<NonNullable<MataListener[K]>>
  ): void {
    emitListeners(this.listeners, key, ...args);
  }

  private handle(message: FromMataMessage): void {
    switch (message.type) {
      case 'init':
        this.applyInit(message.state);
        break;
      case 'delta':
        this.applyDelta(message.delta);
        break;
      case 'error':
        this.emit('onError', message.message);
        break;
      default:
        this.rpc.settle(message.id, message);
    }
  }

  private applyInit(state: MataFullState): void {
    this.copyLayers(state);
    this.stats = state.stats;
    this.name = state.name;
    this.seed = state.seed;
    this.size = state.size;
    this.emit('onInit');
    this.emit('onStats', state.stats);
    this.rpc.resolveInit();
  }

  private applyDelta(delta: MataDelta): void {
    this.copyLayers(delta);
    this.stats = delta.stats;
    this.emit('onWorld');
    this.emit('onStats', delta.stats);
  }

  private copyLayers(
    layers: Pick<MataGrid, 'species' | 'age' | 'moisture' | 'nutrients' | 'soil' | 'fauna' | 'health'>,
  ): void {
    this.species = layers.species.slice();
    this.age = layers.age.slice();
    this.moisture = layers.moisture.slice();
    this.nutrients = layers.nutrients.slice();
    this.soil = layers.soil.slice();
    this.fauna = layers.fauna.slice();
    this.health = layers.health.slice();
  }
}
