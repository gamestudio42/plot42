export const PLOT_EMPTY = 0;
export const PLOT_PLANTED = 1;
export const PLOT_RIPE = 2;

export type PlotState = typeof PLOT_EMPTY | typeof PLOT_PLANTED | typeof PLOT_RIPE;

export const HORTA_SPEED_TICKS = [0, 8, 16, 32] as const;
export type HortaSpeed = 0 | 1 | 2 | 3;

export const GROW_CHANCE = 0.12;

export interface HortaCommand {
  type: 'plant' | 'clear' | 'harvest';
  x: number;
  y: number;
}

export interface HortaCommandResult {
  ok: boolean;
  reason?: 'oob' | 'occupied' | 'empty' | 'not-ripe';
}

export interface HortaStats {
  name: string;
  seed: string;
  size: number;
  tick: number;
  planted: number;
  ripe: number;
  harvested: number;
}

export interface HortaSnapshot {
  name: string;
  seed: string;
  size: number;
  tick: number;
  harvested: number;
  rng: [number, number, number, number];
  plots: Uint8Array;
}

export interface HortaFullState {
  name: string;
  seed: string;
  size: number;
  plots: Uint8Array;
  stats: HortaStats;
}

export interface HortaDelta {
  tick: number;
  plots: Uint8Array;
  stats: HortaStats;
}

export interface NewHortaOptions {
  name: string;
  seed: string;
  size: number;
}

export interface HortaMeta {
  name: string;
  seed: string;
  size: number;
  tick: number;
  planted: number;
  ripe: number;
  harvested: number;
  savedAt: string;
}

export type ToHortaMessage =
  | { type: 'newGame'; options: NewHortaOptions }
  | { type: 'command'; id: number; command: HortaCommand }
  | { type: 'setSpeed'; speed: HortaSpeed }
  | { type: 'snapshot'; id: number }
  | { type: 'hash'; id: number }
  | { type: 'exportSave'; id: number; savedAt: string }
  | { type: 'importSave'; id: number; text: string };

export type LoadHortaResult =
  | { ok: true; meta: HortaMeta; migratedFrom: number | null }
  | { ok: false; errors: { code: string; detail?: string }[] };

export type FromHortaMessage =
  | { type: 'init'; state: HortaFullState }
  | { type: 'delta'; delta: HortaDelta }
  | { type: 'commandResult'; id: number; result: HortaCommandResult }
  | { type: 'snapshot'; id: number; snapshot: HortaSnapshot }
  | { type: 'hash'; id: number; hash: string }
  | { type: 'saveData'; id: number; text: string; meta: HortaMeta }
  | { type: 'loadResult'; id: number; result: LoadHortaResult }
  | { type: 'error'; message: string };
