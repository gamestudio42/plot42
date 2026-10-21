import {
  decodeMataSave,
  encodeMataSave,
  MATA_SPEED_TICKS,
  MataEngine,
  type FromMataMessage,
  type MataFullState,
  type ToMataMessage,
} from '@mata/sim';
import { startFixedStep, WorkerClock } from '@shell/bridge';
import { stringifySave as stringifyEnvelope } from '@shell/kernel';

interface WorkerScope {
  postMessage(message: FromMataMessage): void;
  onmessage: ((event: MessageEvent<ToMataMessage>) => void) | null;
}

const scope = self as unknown as WorkerScope;
let engine: MataEngine | null = null;
const clock = new WorkerClock(MATA_SPEED_TICKS);

function post(message: FromMataMessage): void {
  scope.postMessage(message);
}

function layers(e: MataEngine) {
  return {
    species: e.species.slice(),
    age: e.age.slice(),
    moisture: e.moisture.slice(),
    nutrients: e.nutrients.slice(),
    soil: e.soil.slice(),
    fauna: e.fauna.slice(),
    health: e.health.slice(),
  };
}

function fullState(e: MataEngine): MataFullState {
  return {
    name: e.name,
    seed: e.seed,
    size: e.size,
    ...layers(e),
    stats: e.stats(),
  };
}

function publish(): void {
  if (!engine) return;
  post({
    type: 'delta',
    delta: { tick: engine.tick, ...layers(engine), stats: engine.stats() },
  });
}

scope.onmessage = (event) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'newGame':
        engine = MataEngine.create(message.options);
        clock.reset();
        post({ type: 'init', state: fullState(engine) });
        break;
      case 'command': {
        if (!engine) throw new Error('No mata loaded');
        const result = engine.execute(message.command);
        publish();
        post({ type: 'commandResult', id: message.id, result });
        break;
      }
      case 'setSpeed':
        clock.setSpeed(message.speed);
        break;
      case 'snapshot':
        if (!engine) throw new Error('No mata loaded');
        post({ type: 'snapshot', id: message.id, snapshot: engine.serialize() });
        break;
      case 'hash':
        if (!engine) throw new Error('No mata loaded');
        post({ type: 'hash', id: message.id, hash: engine.hash() });
        break;
      case 'exportSave': {
        if (!engine) throw new Error('No mata loaded');
        const stats = engine.stats();
        const file = encodeMataSave(engine.serialize(), {
          planted: stats.planted,
          unique: stats.unique,
          balance: stats.balance,
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
        const decoded = decodeMataSave(message.text);
        if (!decoded.ok) {
          post({ type: 'loadResult', id: message.id, result: decoded });
          break;
        }
        engine = MataEngine.fromSnapshot(decoded.snapshot);
        clock.setSpeed(0);
        clock.reset();
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

startFixedStep(clock, (ticks) => {
  if (!engine || engine.outcome !== 'playing') return;
  engine.runTicks(ticks);
  publish();
});
