import {
  decodeHortaSave,
  encodeHortaSave,
  HORTA_SPEED_TICKS,
  HortaEngine,
  type FromHortaMessage,
  type HortaFullState,
  type ToHortaMessage,
} from '@horta/sim';
import { startFixedStep, WorkerClock } from '@shell/bridge';
import { stringifySave as stringifyEnvelope } from '@shell/kernel';

interface WorkerScope {
  postMessage(message: FromHortaMessage): void;
  onmessage: ((event: MessageEvent<ToHortaMessage>) => void) | null;
}

const scope = self as unknown as WorkerScope;
let engine: HortaEngine | null = null;
const clock = new WorkerClock(HORTA_SPEED_TICKS);

function post(message: FromHortaMessage): void {
  scope.postMessage(message);
}

function fullState(e: HortaEngine): HortaFullState {
  return {
    name: e.name,
    seed: e.seed,
    size: e.size,
    plots: e.plots.slice(),
    stats: e.stats(),
  };
}

function publish(): void {
  if (!engine) return;
  post({
    type: 'delta',
    delta: { tick: engine.tick, plots: engine.plots.slice(), stats: engine.stats() },
  });
}

scope.onmessage = (event) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'newGame':
        engine = HortaEngine.create(message.options);
        clock.reset();
        post({ type: 'init', state: fullState(engine) });
        break;
      case 'command': {
        if (!engine) throw new Error('No horta loaded');
        const result = engine.execute(message.command);
        publish();
        post({ type: 'commandResult', id: message.id, result });
        break;
      }
      case 'setSpeed':
        clock.setSpeed(message.speed);
        break;
      case 'snapshot':
        if (!engine) throw new Error('No horta loaded');
        post({ type: 'snapshot', id: message.id, snapshot: engine.serialize() });
        break;
      case 'hash':
        if (!engine) throw new Error('No horta loaded');
        post({ type: 'hash', id: message.id, hash: engine.hash() });
        break;
      case 'exportSave': {
        if (!engine) throw new Error('No horta loaded');
        const stats = engine.stats();
        const file = encodeHortaSave(engine.serialize(), {
          planted: stats.planted,
          ripe: stats.ripe,
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
        const decoded = decodeHortaSave(message.text);
        if (!decoded.ok) {
          post({ type: 'loadResult', id: message.id, result: decoded });
          break;
        }
        engine = HortaEngine.fromSnapshot(decoded.snapshot);
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
  if (!engine) return;
  engine.runTicks(ticks);
  publish();
});
