import {
  INFLUENCE_LAYERS,
  SPEED_TICKS_PER_SECOND,
  STRUCTURE_LAYERS,
  type Delta,
  type FromWorkerMessage,
  type FullState,
  type InfluenceLayer,
  type Speed,
  type StructureLayer,
  type ToWorkerMessage,
} from '@city/shared';
import { createEngine, hashState, SimulationEngine } from '@city/simulation';

interface WorkerScope {
  postMessage(message: FromWorkerMessage): void;
  onmessage: ((event: MessageEvent<ToWorkerMessage>) => void) | null;
}

const scope = self as unknown as WorkerScope;
const FRAME_MS = 50;
const MAX_TICKS_PER_FRAME = 40;

let engine: SimulationEngine | null = null;
let speed: Speed = 1;
let accumulator = 0;
let lastTime = performance.now();

function post(message: FromWorkerMessage): void {
  scope.postMessage(message);
}

function fullState(e: SimulationEngine): FullState {
  const w = e.world;
  w.takeDirty();
  w.heightsDirty = false;
  w.influenceDirty = false;
  e.buildings.takeChanges();
  e.takeEvents();
  e.historyDirty = false;
  return {
    size: w.size,
    name: e.name,
    seed: e.seed,
    heights: w.heights.slice(),
    structure: copyLayers(w.structure, STRUCTURE_LAYERS),
    influence: copyLayers(w.influence, INFLUENCE_LAYERS),
    buildingId: w.buildingId.slice(),
    buildings: e.buildings.list().map((b) => ({ ...b })),
    stats: e.stats(),
    history: e.history.map((h) => ({ ...h })),
  };
}

function copyLayers<K extends string>(
  source: Record<K, Uint8Array>,
  names: readonly K[],
): Record<K, Uint8Array> {
  const out = {} as Record<K, Uint8Array>;
  for (const name of names) out[name] = source[name].slice();
  return out;
}

function buildDelta(e: SimulationEngine): Delta {
  const w = e.world;
  const dirty = w.takeDirty();
  let tiles: Delta['tiles'] = null;
  if (dirty.length > 0) {
    const indices = Int32Array.from(dirty);
    const structure = {} as Record<StructureLayer, Uint8Array>;
    for (const name of STRUCTURE_LAYERS) {
      const src = w.structure[name];
      const out = new Uint8Array(indices.length);
      for (let k = 0; k < indices.length; k++) out[k] = src[indices[k] as number] as number;
      structure[name] = out;
    }
    const buildingId = new Int32Array(indices.length);
    for (let k = 0; k < indices.length; k++)
      buildingId[k] = w.buildingId[indices[k] as number] as number;
    tiles = { indices, structure, buildingId };
  }
  let influence: Record<InfluenceLayer, Uint8Array> | null = null;
  if (w.influenceDirty) {
    influence = copyLayers(w.influence, INFLUENCE_LAYERS);
    w.influenceDirty = false;
  }
  let heights: Uint8Array | null = null;
  if (w.heightsDirty) {
    heights = w.heights.slice();
    w.heightsDirty = false;
  }
  const { changed, removed } = e.buildings.takeChanges();
  let history: Delta['history'] = null;
  if (e.historyDirty) {
    history = e.history.map((h) => ({ ...h }));
    e.historyDirty = false;
  }
  return {
    tick: e.tick,
    tiles,
    heights,
    influence,
    buildings: changed,
    removedBuildings: removed,
    stats: e.stats(),
    history,
    events: e.takeEvents(),
  };
}

function publish(): void {
  if (!engine) return;
  post({ type: 'delta', delta: buildDelta(engine) });
}

function frame(): void {
  const now = performance.now();
  const elapsed = now - lastTime;
  lastTime = now;
  if (!engine) return;
  const rate = SPEED_TICKS_PER_SECOND[speed];
  if (rate === 0) {
    accumulator = 0;
    return;
  }
  accumulator += (elapsed * rate) / 1000;
  const ticks = Math.min(MAX_TICKS_PER_FRAME, Math.floor(accumulator));
  accumulator = Math.min(accumulator - ticks, MAX_TICKS_PER_FRAME);
  if (ticks <= 0) return;
  engine.runTicks(ticks);
  publish();
}

scope.onmessage = (event) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'newCity':
        engine = createEngine(message.options);
        accumulator = 0;
        post({ type: 'init', state: fullState(engine) });
        break;
      case 'loadCity':
        engine = SimulationEngine.fromSnapshot(message.snapshot);
        accumulator = 0;
        post({ type: 'init', state: fullState(engine) });
        break;
      case 'command': {
        if (!engine) throw new Error('No city loaded');
        const result = engine.execute(message.command);
        publish();
        post({ type: 'commandResult', id: message.id, result });
        break;
      }
      case 'setSpeed':
        speed = message.speed;
        accumulator = 0;
        break;
      case 'runTicks':
        if (!engine) throw new Error('No city loaded');
        engine.runTicks(message.ticks);
        publish();
        post({ type: 'ticksDone', id: message.id });
        break;
      case 'snapshot':
        if (!engine) throw new Error('No city loaded');
        post({ type: 'snapshot', id: message.id, snapshot: engine.serialize() });
        break;
      case 'hash':
        if (!engine) throw new Error('No city loaded');
        post({ type: 'hash', id: message.id, hash: hashState(engine) });
        break;
    }
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

setInterval(frame, FRAME_MS);
