export const GRID_SIZE = 10;
export const STARTING_HP = 2;
export const PLAYER_COUNT = 3;
export const ENEMY_COUNT = 3;

export type Side = 'player' | 'enemy';
export type Outcome = 'playing' | 'victory' | 'defeat';

export interface Unit {
  id: number;
  side: Side;
  x: number;
  y: number;
  hp: number;
}

export type PostoCommand =
  | { type: 'move'; unitId: number; x: number; y: number }
  | { type: 'attack'; unitId: number; targetId: number };

export interface PostoCommandResult {
  ok: boolean;
  reason?: 'oob' | 'occupied' | 'not-adjacent' | 'dead' | 'wrong-side' | 'game-over' | 'unknown-unit';
  outcome: Outcome;
}

export interface PostoStats {
  name: string;
  seed: string;
  size: number;
  turn: number;
  playerAlive: number;
  enemyAlive: number;
  outcome: Outcome;
}

export interface PostoSnapshot {
  name: string;
  seed: string;
  size: number;
  turn: number;
  rng: [number, number, number, number];
  units: Unit[];
  outcome: Outcome;
}

export interface PostoFullState {
  name: string;
  seed: string;
  size: number;
  units: Unit[];
  stats: PostoStats;
}

export interface PostoDelta {
  turn: number;
  units: Unit[];
  stats: PostoStats;
}

export interface NewPostoOptions {
  name: string;
  seed: string;
}

export interface PostoMeta {
  name: string;
  seed: string;
  turn: number;
  playerAlive: number;
  enemyAlive: number;
  outcome: Outcome;
  savedAt: string;
}

export type ToPostoMessage =
  | { type: 'newGame'; options: NewPostoOptions }
  | { type: 'command'; id: number; command: PostoCommand }
  | { type: 'snapshot'; id: number }
  | { type: 'hash'; id: number }
  | { type: 'exportSave'; id: number; savedAt: string }
  | { type: 'importSave'; id: number; text: string };

export type LoadPostoResult =
  | { ok: true; meta: PostoMeta; migratedFrom: number | null }
  | { ok: false; errors: { code: string; detail?: string }[] };

export type FromPostoMessage =
  | { type: 'init'; state: PostoFullState }
  | { type: 'delta'; delta: PostoDelta }
  | { type: 'commandResult'; id: number; result: PostoCommandResult }
  | { type: 'snapshot'; id: number; snapshot: PostoSnapshot }
  | { type: 'hash'; id: number; hash: string }
  | { type: 'saveData'; id: number; text: string; meta: PostoMeta }
  | { type: 'loadResult'; id: number; result: LoadPostoResult }
  | { type: 'error'; message: string };
