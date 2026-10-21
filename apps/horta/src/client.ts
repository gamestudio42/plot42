import type {
  FromHortaMessage,
  HortaCommand,
  HortaCommandResult,
  HortaDelta,
  HortaFullState,
  HortaMeta,
  HortaSnapshot,
  HortaSpeed,
  HortaStats,
  LoadHortaResult,
  NewHortaOptions,
  ToHortaMessage,
} from '@horta/sim';
import { emitListeners, RpcInbox } from '@shell/bridge';

export interface HortaListener {
  onInit?(): void;
  onPlots?(): void;
  onStats?(stats: HortaStats): void;
  onError?(message: string): void;
}

export class HortaClient {
  plots: Uint8Array | null = null;
  stats: HortaStats | null = null;
  name = '';
  seed = '';
  size = 0;

  private readonly worker: Worker;
  private readonly listeners = new Set<HortaListener>();
  private readonly rpc = new RpcInbox<FromHortaMessage>();

  constructor() {
    this.worker = new Worker(new URL('./worker/horta.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<FromHortaMessage>) => this.handle(event.data);
  }

  subscribe(listener: HortaListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  newGame(options: NewHortaOptions): Promise<void> {
    return this.rpc.waitInit(() => this.send({ type: 'newGame', options }));
  }

  command(command: HortaCommand): Promise<HortaCommandResult> {
    return this.rpc.request(
      (id) => this.send({ type: 'command', id, command }),
      (m) => (m.type === 'commandResult' ? m.result : undefined),
    );
  }

  setSpeed(speed: HortaSpeed): void {
    this.send({ type: 'setSpeed', speed });
  }

  snapshot(): Promise<HortaSnapshot> {
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

  exportSave(savedAt: string): Promise<{ text: string; meta: HortaMeta }> {
    return this.rpc.request(
      (id) => this.send({ type: 'exportSave', id, savedAt }),
      (m) => (m.type === 'saveData' ? { text: m.text, meta: m.meta } : undefined),
    );
  }

  importSave(text: string): Promise<LoadHortaResult> {
    return this.rpc.request(
      (id) => this.send({ type: 'importSave', id, text }),
      (m) => (m.type === 'loadResult' ? m.result : undefined),
    );
  }

  dispose(): void {
    this.worker.terminate();
  }

  private send(message: ToHortaMessage): void {
    this.worker.postMessage(message);
  }

  private emit<K extends keyof HortaListener>(
    key: K,
    ...args: Parameters<NonNullable<HortaListener[K]>>
  ): void {
    emitListeners(this.listeners, key, ...args);
  }

  private handle(message: FromHortaMessage): void {
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

  private applyInit(state: HortaFullState): void {
    this.plots = state.plots.slice();
    this.stats = state.stats;
    this.name = state.name;
    this.seed = state.seed;
    this.size = state.size;
    this.emit('onInit');
    this.emit('onStats', state.stats);
    this.rpc.resolveInit();
  }

  private applyDelta(delta: HortaDelta): void {
    this.plots = delta.plots.slice();
    this.stats = delta.stats;
    this.emit('onPlots');
    this.emit('onStats', delta.stats);
  }
}
