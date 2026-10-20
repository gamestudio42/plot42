import { createEngine, type SimulationEngine } from '../engine';
import { addServices, buildTown, flatCity, maintainTown, recoverCity } from './builders';
import { buildGridCity, maintainGrid } from './grid';

export interface PresetRun {
  engine: SimulationEngine;
  /** Called after every simulated month (the automated player). */
  onMonth(engine: SimulationEngine): void;
}

export interface SimPreset {
  description: string;
  defaultSize: number;
  create(seed: string, size: number): PresetRun;
}

const idle = () => undefined;

/** Named cities for `tools/headless-sim.ts` and `tools/benchmark.ts`. */
export const SIM_PRESETS: Record<string, SimPreset> = {
  balanced: {
    description: 'Town with every service, automated plants and pumps (64×64)',
    defaultSize: 64,
    create(seed, size) {
      const engine = flatCity(seed, size);
      addServices(engine, buildTown(engine, { pumps: 8 }));
      return { engine, onMonth: (e) => void maintainTown(e) };
    },
  },
  disasters: {
    description: 'The balanced town with random disasters; the player clears rubble and rebuilds',
    defaultSize: 64,
    create(seed, size) {
      const engine = flatCity(seed, size);
      engine.disastersEnabled = true;
      addServices(engine, buildTown(engine, { pumps: 8 }));
      const plan = engine.commandLog.map((entry) => entry.command);
      return {
        engine,
        onMonth: (e) => {
          recoverCity(e, plan);
          maintainTown(e);
        },
      };
    },
  },
  'no-power': {
    description: 'The town without power plants',
    defaultSize: 64,
    create(seed, size) {
      const engine = flatCity(seed, size);
      buildTown(engine, { power: false });
      return { engine, onMonth: idle };
    },
  },
  'high-taxes': {
    description: 'The balanced town with every tax at 15%',
    defaultSize: 64,
    create(seed, size) {
      const engine = flatCity(seed, size);
      addServices(engine, buildTown(engine, { pumps: 8 }));
      for (const zone of ['residential', 'commercial', 'industrial'] as const) {
        engine.execute({ type: 'setTax', zone, rate: 15 });
      }
      return { engine, onMonth: (e) => void maintainTown(e) };
    },
  },
  grid: {
    description: 'A street grid of dense blocks filling the whole map (benchmark city)',
    defaultSize: 128,
    create(seed, size) {
      const engine = flatCity(seed, size, 10_000_000);
      const layout = buildGridCity(engine);
      return { engine, onMonth: (e) => void maintainGrid(e, layout) };
    },
  },
  terrain: {
    description: 'Generated terrain without a city (baseline cost of an empty map)',
    defaultSize: 128,
    create(seed, size) {
      return { engine: createEngine({ seed, size }), onMonth: idle };
    },
  },
};
