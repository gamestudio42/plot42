import {
  MATURE_AGE,
  SPECIES_CROWN,
  SPECIES_FERN,
  SPECIES_GRASS,
  SPECIES_INGA,
  type PlantSpecies,
} from '@mata/sim';
import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';

export interface SpriteTexture {
  texture: Texture;
  anchorX: number;
  anchorY: number;
}

export type FaunaKind = 'mite' | 'bird' | 'critter';

function shade(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

/** Deterministic 0..1 hash for visual variation (renderer only). */
export function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function lerpColor(a: number, b: number, t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * u);
  const g = Math.round(ag + (bg - ag) * u);
  const bl = Math.round(ab + (bb - ab) * u);
  return (r << 16) | (g << 8) | bl;
}

export function groundColor(soil: number, moisture: number, hash: number): number {
  const dry = lerpColor(0x5a3820, 0x3a2414, hash);
  const wet = lerpColor(0x4a5a28, 0x2d4a22, hash);
  const health = soil / 255;
  const damp = moisture / 255;
  return lerpColor(dry, wet, health * 0.55 + damp * 0.45);
}

function trunk(g: Graphics, height: number, width: number, color: number): void {
  const half = width / 2;
  g.poly([-half - 0.6, 2, half + 0.2, 2, half, -height, -half - 0.4, -height]).fill({
    color: shade(color, 0.78),
  });
  g.poly([-half * 0.2, 2, half + 0.6, 2, half + 0.4, -height, -half * 0.15, -height]).fill({
    color,
  });
}

function blob(g: Graphics, x: number, y: number, r: number, color: number): void {
  g.ellipse(x, y, r, r * 0.72).fill({ color });
}

function grass(g: Graphics, mature: boolean): void {
  const h = mature ? 16 : 8;
  g.ellipse(0, 3, mature ? 10 : 6, 3).fill({ color: 0x1a1810, alpha: 0.16 });
  const blades = mature
    ? [
        [-6, -h],
        [-2, -h - 3],
        [2, -h - 1],
        [6, -h + 1],
      ]
    : [
        [-3, -h],
        [0, -h - 2],
        [3, -h],
      ];
  for (const [x, y] of blades) {
    g.poly([0, 2, x - 1.4, y + 4, x, y, x + 1.4, y + 4]).fill({
      color: mature ? 0x6aaa40 : 0x8aaa48,
    });
  }
}

function crown(g: Graphics, mature: boolean): void {
  g.ellipse(0, 4, mature ? 13 : 7, mature ? 5 : 3).fill({ color: 0x1a1810, alpha: 0.22 });
  trunk(g, mature ? 24 : 14, mature ? 5 : 2.4, 0x6a4a2a);
  if (!mature) {
    blob(g, -4, -16, 6, 0x2f6b34);
    blob(g, 4, -18, 5.4, 0x6bb85a);
    return;
  }
  blob(g, -11, -26, 12, 0x2f6b34);
  blob(g, 10, -24, 11, 0x4a8f4a);
  blob(g, 0, -34, 13, 0x5a9c48);
  blob(g, -3, -38, 8, 0x7ec05a);
}

function fern(g: Graphics, mature: boolean): void {
  g.ellipse(0, 3, mature ? 11 : 6, 3).fill({ color: 0x1a1810, alpha: 0.16 });
  const reach = mature ? 16 : 9;
  const fronds = mature ? [-2.2, -1.2, -0.4, 0.4, 1.2, 2.2] : [-1.4, 0, 1.4];
  for (const [i, a] of fronds.entries()) {
    const tipX = Math.cos(a) * reach;
    const tipY = -6 + Math.sin(a) * reach * 0.35;
    g.poly([0, 1, tipX * 0.3, -2, tipX, tipY]).fill({
      color: i % 2 === 0 ? 0x3d7a40 : 0x5a9a50,
    });
  }
}

function inga(g: Graphics, mature: boolean): void {
  g.ellipse(0, 4, mature ? 11 : 6, mature ? 4 : 2.6).fill({ color: 0x1a1810, alpha: 0.2 });
  trunk(g, mature ? 20 : 12, mature ? 4 : 2.2, 0x5a4030);
  blob(g, -7, mature ? -22 : -14, mature ? 9 : 5, 0x3d6b38);
  blob(g, 7, mature ? -20 : -13, mature ? 8 : 4.6, 0x5a8a48);
  blob(g, 0, mature ? -28 : -16, mature ? 9 : 5, 0x4a7a38);
  if (mature) {
    for (const [x, y] of [
      [-6, -18],
      [5, -16],
      [1, -24],
    ] as const) {
      g.ellipse(x, y, 2.2, 1.4).fill({ color: 0xe0b040 });
    }
  }
}

function cactus(g: Graphics, mature: boolean): void {
  g.ellipse(0, 4, mature ? 7 : 4, 2.6).fill({ color: 0x1a1810, alpha: 0.16 });
  const h = mature ? 22 : 12;
  const w = mature ? 5 : 3;
  g.poly([-w, 2, w, 2, w * 0.7, -h, -w * 0.7, -h]).fill({ color: 0x4a8a3a });
  g.poly([-w * 0.2, 2, w, 2, w * 0.55, -h, 0, -h]).fill({ color: 0x6aaa4a });
  if (mature) {
    g.poly([-w, -10, -w - 7, -16, -w + 1, -12]).fill({ color: 0x4a8a3a });
    g.poly([w, -8, w + 7, -14, w - 1, -10]).fill({ color: 0x6aaa4a });
    g.circle(-1, -h - 2, 2.2).fill({ color: 0xe07050 });
  }
}

function mite(g: Graphics): void {
  g.circle(-3, -2, 1.4).fill({ color: 0x2a2010 });
  g.circle(2, -3, 1.2).fill({ color: 0x3a2a14 });
}

function bird(g: Graphics): void {
  g.poly([-5, -28, 0, -32, 5, -27, 0, -29]).fill({ color: 0x2a2430 });
}

function critter(g: Graphics): void {
  g.ellipse(-1, 0, 4.2, 2.2).fill({ color: 0x5a4030 });
  g.circle(3, -1, 1.6).fill({ color: 0x6a4a34 });
}

export class MataSprites {
  private readonly cache = new Map<string, SpriteTexture>();

  constructor(private readonly renderer: Renderer) {}

  plant(species: PlantSpecies, age: number): Sprite {
    const mature = age >= MATURE_AGE;
    const entry = this.get(`p:${species}:${mature ? 1 : 0}`, (g) => {
      if (species === SPECIES_GRASS) grass(g, mature);
      else if (species === SPECIES_CROWN) crown(g, mature);
      else if (species === SPECIES_FERN) fern(g, mature);
      else if (species === SPECIES_INGA) inga(g, mature);
      else cactus(g, mature);
    });
    return this.sprite(entry);
  }

  animal(kind: FaunaKind): Sprite {
    const entry = this.get(`a:${kind}`, (g) => {
      if (kind === 'mite') mite(g);
      else if (kind === 'bird') bird(g);
      else critter(g);
    });
    return this.sprite(entry);
  }

  private sprite(entry: SpriteTexture): Sprite {
    const sprite = new Sprite(entry.texture);
    sprite.anchor.set(entry.anchorX, entry.anchorY);
    sprite.scale.set(1.35);
    return sprite;
  }

  private get(key: string, draw: (g: Graphics) => void): SpriteTexture {
    const cached = this.cache.get(key);
    if (cached) return cached;
    const g = new Graphics();
    draw(g);
    const holder = new Container();
    holder.addChild(g);
    const bounds = g.getLocalBounds();
    const texture = this.renderer.generateTexture({
      target: holder,
      resolution: 2,
      antialias: true,
    });
    const entry: SpriteTexture = {
      texture,
      anchorX: bounds.width > 0 ? -bounds.x / bounds.width : 0.5,
      anchorY: bounds.height > 0 ? -bounds.y / bounds.height : 1,
    };
    g.destroy();
    holder.destroy();
    this.cache.set(key, entry);
    return entry;
  }
}
