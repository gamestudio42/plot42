import type { Difficulty, Speed } from '../balance/balance';
import type { Command, CommandResult } from '../commands/commands';
import type { SaveError, SaveMeta } from '../schemas/save';
import type { EngineSnapshot } from '../schemas/snapshot';
import type { BuildingRecord } from '../types/buildings';
import type { CityStats, HistoryEntry, SimEvent } from '../types/stats';
import type { InfluenceLayer, StructureLayer } from '../types/tiles';

export interface TerrainOptions {
  /** Fraction of the map covered by water, 0..0.5. */
  water: number;
  /** 0 = flat, 1 = mountainous. */
  hills: number;
  /** Fraction of land with trees, 0..1. */
  forest: number;
  rivers: number;
  /** Generate a completely flat grass map (used by scenarios and tests). */
  flat?: boolean;
}

export interface NewCityOptions {
  name: string;
  seed: string;
  size: number;
  terrain: TerrainOptions;
  difficulty?: Difficulty;
}

export type ToWorkerMessage =
  | { type: 'newCity'; options: NewCityOptions }
  | { type: 'loadCity'; snapshot: EngineSnapshot }
  | { type: 'command'; id: number; command: Command }
  | { type: 'setSpeed'; speed: Speed }
  | { type: 'runTicks'; id: number; ticks: number }
  | { type: 'snapshot'; id: number }
  | { type: 'hash'; id: number }
  /** Encodes the current city as a save file (the host supplies the timestamp). */
  | { type: 'exportSave'; id: number; savedAt: string }
  /** Decodes and validates a save; on success it replaces the current city. */
  | { type: 'importSave'; id: number; text: string };

export type LoadResult =
  { ok: true; meta: SaveMeta; migratedFrom: number | null } | { ok: false; errors: SaveError[] };

export interface FullState {
  size: number;
  name: string;
  seed: string;
  heights: Uint8Array;
  structure: Record<StructureLayer, Uint8Array>;
  influence: Record<InfluenceLayer, Uint8Array>;
  buildingId: Int32Array;
  buildings: BuildingRecord[];
  stats: CityStats;
  history: HistoryEntry[];
}

export interface Delta {
  tick: number;
  /** Changed tiles: indices plus the value of every structure layer at those indices. */
  tiles: {
    indices: Int32Array;
    structure: Record<StructureLayer, Uint8Array>;
    buildingId: Int32Array;
  } | null;
  heights: Uint8Array | null;
  influence: Record<InfluenceLayer, Uint8Array> | null;
  buildings: BuildingRecord[];
  removedBuildings: number[];
  stats: CityStats;
  history: HistoryEntry[] | null;
  events: SimEvent[];
}

export type FromWorkerMessage =
  | { type: 'init'; state: FullState }
  | { type: 'delta'; delta: Delta }
  | { type: 'commandResult'; id: number; result: CommandResult }
  | { type: 'ticksDone'; id: number }
  | { type: 'snapshot'; id: number; snapshot: EngineSnapshot }
  | { type: 'hash'; id: number; hash: string }
  | { type: 'saveData'; id: number; text: string; meta: SaveMeta }
  /** Sent after the `init` of the loaded city when the load succeeded. */
  | { type: 'loadResult'; id: number; result: LoadResult }
  | { type: 'error'; message: string };
