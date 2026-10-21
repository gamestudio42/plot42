import {
  decodePostoSave,
  encodePostoSave,
  PostoEngine,
  type FromPostoMessage,
  type PostoFullState,
  type ToPostoMessage,
} from '@posto/sim';
import { stringifySave as stringifyEnvelope } from '@shell/kernel';

interface WorkerScope {
  postMessage(message: FromPostoMessage): void;
  onmessage: ((event: MessageEvent<ToPostoMessage>) => void) | null;
}

const scope = self as unknown as WorkerScope;
let engine: PostoEngine | null = null;

function post(message: FromPostoMessage): void {
  scope.postMessage(message);
}

function fullState(e: PostoEngine): PostoFullState {
  return {
    name: e.name,
    seed: e.seed,
    size: e.size,
    units: e.units.map((unit) => ({ ...unit })),
    stats: e.stats(),
  };
}

function publish(): void {
  if (!engine) return;
  post({
    type: 'delta',
    delta: {
      turn: engine.turn,
      units: engine.units.map((unit) => ({ ...unit })),
      stats: engine.stats(),
    },
  });
}

scope.onmessage = (event) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'newGame':
        engine = PostoEngine.create(message.options);
        post({ type: 'init', state: fullState(engine) });
        break;
      case 'command': {
        if (!engine) throw new Error('No outpost loaded');
        const result = engine.execute(message.command);
        publish();
        post({ type: 'commandResult', id: message.id, result });
        break;
      }
      case 'snapshot':
        if (!engine) throw new Error('No outpost loaded');
        post({ type: 'snapshot', id: message.id, snapshot: engine.serialize() });
        break;
      case 'hash':
        if (!engine) throw new Error('No outpost loaded');
        post({ type: 'hash', id: message.id, hash: engine.hash() });
        break;
      case 'exportSave': {
        if (!engine) throw new Error('No outpost loaded');
        const stats = engine.stats();
        const file = encodePostoSave(engine.serialize(), {
          playerAlive: stats.playerAlive,
          enemyAlive: stats.enemyAlive,
          savedAt: message.savedAt,
        });
        post({
          type: 'saveData',
          id: message.id,
          text: stringifyEnvelope(file),
          meta: file.meta,
        });
        break;
      }
      case 'importSave': {
        const decoded = decodePostoSave(message.text);
        if (!decoded.ok) {
          post({ type: 'loadResult', id: message.id, result: decoded });
          break;
        }
        engine = PostoEngine.fromSnapshot(decoded.snapshot);
        post({ type: 'init', state: fullState(engine) });
        post({
          type: 'loadResult',
          id: message.id,
          result: { ok: true, meta: decoded.meta, migratedFrom: decoded.migratedFrom },
        });
        break;
      }
    }
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
