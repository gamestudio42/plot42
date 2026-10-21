import type {
  FromPostoMessage,
  LoadPostoResult,
  NewPostoOptions,
  PostoCommand,
  PostoCommandResult,
  PostoDelta,
  PostoFullState,
  PostoMeta,
  PostoSnapshot,
  PostoStats,
  ToPostoMessage,
  Unit,
} from '@posto/sim';
import { emitListeners, RpcInbox } from '@shell/bridge';

export interface PostoListener {
  onInit?(): void;
  onUnits?(): void;
  onStats?(stats: PostoStats): void;
  onError?(message: string): void;
}

export class PostoClient {
  units: Unit[] = [];
  stats: PostoStats | null = null;
  name = '';
  seed = '';
  size = 0;

  private readonly worker: Worker;
  private readonly listeners = new Set<PostoListener>();
  private readonly rpc = new RpcInbox<FromPostoMessage>();

  constructor() {
    this.worker = new Worker(new URL('./worker/posto.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<FromPostoMessage>) => this.handle(event.data);
  }

  subscribe(listener: PostoListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  newGame(options: NewPostoOptions): Promise<void> {
    return this.rpc.waitInit(() => this.send({ type: 'newGame', options }));
  }

  command(command: PostoCommand): Promise<PostoCommandResult> {
    return this.rpc.request(
      (id) => this.send({ type: 'command', id, command }),
      (m) => (m.type === 'commandResult' ? m.result : undefined),
    );
  }

  snapshot(): Promise<PostoSnapshot> {
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

  exportSave(savedAt: string): Promise<{ text: string; meta: PostoMeta }> {
    return this.rpc.request(
      (id) => this.send({ type: 'exportSave', id, savedAt }),
      (m) => (m.type === 'saveData' ? { text: m.text, meta: m.meta } : undefined),
    );
  }

  importSave(text: string): Promise<LoadPostoResult> {
    return this.rpc.request(
      (id) => this.send({ type: 'importSave', id, text }),
      (m) => (m.type === 'loadResult' ? m.result : undefined),
    );
  }

  dispose(): void {
    this.worker.terminate();
  }

  private send(message: ToPostoMessage): void {
    this.worker.postMessage(message);
  }

  private emit<K extends keyof PostoListener>(
    key: K,
    ...args: Parameters<NonNullable<PostoListener[K]>>
  ): void {
    emitListeners(this.listeners, key, ...args);
  }

  private handle(message: FromPostoMessage): void {
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

  private applyInit(state: PostoFullState): void {
    this.units = state.units.map((unit) => ({ ...unit }));
    this.stats = state.stats;
    this.name = state.name;
    this.seed = state.seed;
    this.size = state.size;
    this.emit('onInit');
    this.emit('onStats', state.stats);
    this.rpc.resolveInit();
  }

  private applyDelta(delta: PostoDelta): void {
    this.units = delta.units.map((unit) => ({ ...unit }));
    this.stats = delta.stats;
    this.emit('onUnits');
    this.emit('onStats', delta.stats);
  }
}
