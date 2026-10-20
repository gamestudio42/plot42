import type { BuildingRecord } from '@city/shared';
import { chimneys } from '../chimneys';
import type { Random } from './random';

export interface SmokeVent {
  /** Stable per chimney: building id × 4 + chimney index. */
  key: number;
  buildingId: number;
  /** Front tile of the building (its sprite stands on that tile's south corner). */
  frontX: number;
  frontY: number;
  /** Chimney top relative to the sprite origin, in pixels. */
  offsetX: number;
  offsetY: number;
  /** 0..1: heavy vents emit more and larger puffs. */
  strength: number;
}

type VentSource = Pick<
  BuildingRecord,
  | 'id'
  | 'kind'
  | 'x'
  | 'y'
  | 'w'
  | 'h'
  | 'level'
  | 'abandoned'
  | 'powered'
  | 'occupancy'
  | 'offline'
>;

/** Whether a building's chimneys are smoking: plants while online, industry while working. */
export function isSmoking(b: VentSource): boolean {
  switch (b.kind) {
    case 'coalPlant':
    case 'gasPlant':
      return b.offline === 0;
    case 'industrial':
      return !b.abandoned && b.powered && b.occupancy > 0 && b.level >= 3;
    default:
      return false;
  }
}

/** Chimney tops of every smoking building, in building order. */
export function smokeVents(buildings: Iterable<VentSource>): SmokeVent[] {
  const vents: SmokeVent[] = [];
  for (const b of buildings) {
    if (!isSmoking(b)) continue;
    chimneys(b.kind, Math.max(1, b.level), b.w).forEach((c, k) => {
      if (c.smoke <= 0) return;
      vents.push({
        key: b.id * 4 + k,
        buildingId: b.id,
        frontX: b.x + b.w - 1,
        frontY: b.y + b.h - 1,
        offsetX: c.base.x,
        offsetY: c.base.y - c.height,
        strength: c.smoke,
      });
    });
  }
  return vents;
}

export interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** Size and opacity multiplier from the vent strength. */
  weight: number;
}

export const MAX_PUFFS = 200;
const PUFFS_PER_SECOND = 2.2;
const RISE = 16;
const WIND = 7;

/** Screen-space smoke particles; emission and motion use game time. */
export class SmokeSim {
  readonly puffs: Puff[] = [];
  private credit = new Map<number, number>();

  constructor(
    private readonly random: Random,
    private readonly maxPuffs = MAX_PUFFS,
  ) {}

  clear(): void {
    this.puffs.length = 0;
    this.credit.clear();
  }

  /**
   * Emits from the given vent positions (already in screen space and in view) and moves the
   * puffs by `dt` seconds of game time.
   */
  step(
    vents: readonly { key: number; x: number; y: number; strength: number }[],
    dt: number,
  ): void {
    if (dt <= 0) return;
    let kept = 0;
    for (const p of this.puffs) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.puffs[kept++] = p;
    }
    this.puffs.length = kept;
    for (const v of vents) {
      let credit = (this.credit.get(v.key) ?? this.random()) + dt * PUFFS_PER_SECOND * v.strength;
      while (credit >= 1 && this.puffs.length < this.maxPuffs) {
        credit -= 1;
        this.puffs.push({
          x: v.x + (this.random() - 0.5) * 3,
          y: v.y,
          vx: WIND * (0.6 + this.random() * 0.8),
          vy: -RISE * (0.8 + this.random() * 0.4),
          age: 0,
          life: 2.4 + this.random() * 1.2,
          weight: 0.5 + v.strength * 0.5,
        });
      }
      this.credit.set(v.key, Math.min(credit, 1));
    }
  }
}

/** Scale and opacity of a puff over its life: it grows and fades. */
export function puffLook(p: Puff): { scale: number; alpha: number } {
  const k = Math.min(1, p.age / p.life);
  return {
    scale: (0.45 + 1.2 * k) * p.weight,
    alpha: 0.85 * (1 - k * k) * (k < 0.08 ? k / 0.08 : 1) * (0.6 + 0.4 * p.weight),
  };
}
