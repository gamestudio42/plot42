import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';

export interface SpriteTexture {
  texture: Texture;
  anchorX: number;
  anchorY: number;
}

export type UnitRole = 'scout' | 'guard' | 'raider';
export type PropKind = 'crate' | 'rock' | 'stump' | 'fire' | 'post' | 'flag';
export type FlagKind = 'idle' | 'victory' | 'defeat';

export const ROLE_HEAD_Y: Record<UnitRole, number> = {
  scout: -40,
  guard: -32,
  raider: -36,
};

export const FLAG_TILE = { x: 4, y: 1 } as const;
export const FIRE_TILE = { x: 5, y: 4 } as const;

function shade(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

export function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const FLOOR = [0x6b5a3e, 0x7a6848, 0x5a5348, 0x6e6250] as const;

export function unitRole(id: number): UnitRole {
  const roles: UnitRole[] = ['scout', 'guard', 'raider'];
  return roles[id % 3] ?? 'guard';
}

export function reservedTile(x: number, y: number): boolean {
  return (x === FLAG_TILE.x && y === FLAG_TILE.y) || (x === FIRE_TILE.x && y === FIRE_TILE.y);
}

export function tileProp(x: number, y: number): PropKind | null {
  if (reservedTile(x, y)) return null;
  const h = tileHash(x, y);
  if (h < 0.88) return null;
  if (h < 0.93) return 'crate';
  if (h < 0.97) return 'stump';
  return 'rock';
}

function isoBox(
  g: Graphics,
  cx: number,
  cy: number,
  w: number,
  d: number,
  h: number,
  color: number,
): void {
  const left = { x: cx - w, y: cy + d * 0.35 };
  const right = { x: cx + w, y: cy + d * 0.35 };
  const back = { x: cx, y: cy - d * 0.15 };
  const front = { x: cx, y: cy + d };
  g.poly([left.x, left.y, front.x, front.y, front.x, front.y - h, left.x, left.y - h]).fill({
    color: shade(color, 0.72),
  });
  g.poly([right.x, right.y, front.x, front.y, front.x, front.y - h, right.x, right.y - h]).fill({
    color: shade(color, 0.92),
  });
  g.poly([
    left.x,
    left.y - h,
    back.x,
    back.y - h,
    right.x,
    right.y - h,
    front.x,
    front.y - h,
  ]).fill({ color });
}

function figure(
  g: Graphics,
  role: UnitRole,
  body: number,
  trim: number,
  fallen: boolean,
): void {
  if (fallen) {
    g.ellipse(2, 4, 14, 5).fill({ color: 0x1a1410, alpha: 0.28 });
    g.ellipse(4, 2, 13, 4.2).fill({ color: shade(body, 0.7) });
    g.circle(-8, 1, 4.5).fill({ color: shade(trim, 0.85) });
    return;
  }
  const wide = role === 'guard' ? 12 : role === 'raider' ? 10 : 8;
  const tall = role === 'scout' ? 20 : role === 'guard' ? 14 : 16;
  g.ellipse(0, 6, wide * 0.7, 3.2).fill({ color: 0x1a1410, alpha: 0.25 });
  isoBox(g, 0, 2, wide * 0.45, 7, tall, body);
  const headY = -tall + 2;
  g.circle(0, headY, role === 'guard' ? 6.4 : 5.6).fill({ color: shade(trim, 1.05) });
  g.circle(-2, headY - 1, 1.3).fill({ color: 0x1a1410 });
  g.circle(2.2, headY - 1, 1.3).fill({ color: 0x1a1410 });
  if (role === 'scout') {
    g.poly([6, -6, 16, -28, 8, -8]).fill({ color: 0xc4a574 });
    g.poly([14, -26, 18, -30, 16, -24]).fill({ color: shade(trim, 0.85) });
  }
  if (role === 'guard') {
    g.poly([-14, -2, -6, 4, -5, -10, -13, -14]).fill({ color: 0xc4b07a });
    g.poly([-12, -4, -8, 0, -7, -8, -11, -11]).fill({ color: shade(0xc4b07a, 0.8) });
  }
  if (role === 'raider') {
    g.poly([-7, headY - 2, 0, headY - 10, 7, headY - 2]).fill({ color: shade(body, 0.55) });
    g.poly([7, -4, 15, -10, 10, -2, 8, 2]).fill({ color: 0x8a8f96 });
  }
}

function crate(g: Graphics): void {
  isoBox(g, 0, 2, 8, 8, 9, 0x8a6238);
  g.rect(-6, -6, 12, 1.4).fill({ color: 0x5a3e22, alpha: 0.7 });
}

function rock(g: Graphics): void {
  g.poly([-8, 4, 2, 6, 10, 2, 6, -4, -4, -3]).fill({ color: 0x6a645c });
  g.poly([-4, -3, 6, -4, 2, -8, -6, -6]).fill({ color: 0x7a746c });
}

function stump(g: Graphics): void {
  isoBox(g, 0, 2, 6, 6, 5, 0x6a4a2a);
  g.ellipse(0, -3, 6, 2.6).fill({ color: 0x8a6840 });
  g.ellipse(0, -3, 3.2, 1.4).fill({ color: 0x4a3220 });
}

function fire(g: Graphics): void {
  g.poly([-8, 4, 8, 4, 5, 2, -5, 2]).fill({ color: 0x4a3220 });
  g.poly([-3, 2, 0, -12, 3, 2]).fill({ color: 0xf0a14a });
  g.poly([-1.4, 1, 0, -18, 1.4, 1]).fill({ color: 0xf6e27a });
}

function palisade(g: Graphics): void {
  isoBox(g, 0, 2, 3.4, 3.4, 18, 0x6a4a2a);
  g.poly([-3.2, -16, 0, -24, 3.2, -16]).fill({ color: 0x5a3e22 });
}

function flag(g: Graphics, kind: FlagKind): void {
  g.rect(-1.2, -36, 2.4, 38).fill({ color: 0x5a4030 });
  const cloth = kind === 'victory' ? 0xe8c56b : kind === 'defeat' ? 0xa33a3a : 0x4a8f4a;
  if (kind === 'defeat') {
    g.poly([1, -34, 16, -30, 12, -22, 1, -24]).fill({ color: cloth });
  } else {
    g.poly([1, -36, 18, -32, 18, -20, 1, -22]).fill({ color: cloth });
    g.poly([1, -36, 10, -34, 1, -22]).fill({ color: shade(cloth, 1.12) });
  }
}

export class PostoSprites {
  private readonly cache = new Map<string, SpriteTexture>();

  constructor(private readonly renderer: Renderer) {}

  unit(side: 'player' | 'enemy', role: UnitRole, fallen = false): Sprite {
    const entry = this.get(`u:${side}:${role}:${fallen ? 1 : 0}`, (g) => {
      const body = side === 'player' ? 0x3d8f4a : 0xa33a3a;
      const trim = side === 'player' ? 0x4ade80 : 0xf87171;
      figure(g, role, body, trim, fallen);
    });
    return this.spawn(entry);
  }

  prop(kind: PropKind, flagKind: FlagKind = 'idle'): Sprite {
    const key = kind === 'flag' ? `p:flag:${flagKind}` : `p:${kind}`;
    const entry = this.get(key, (g) => {
      if (kind === 'crate') crate(g);
      else if (kind === 'rock') rock(g);
      else if (kind === 'stump') stump(g);
      else if (kind === 'fire') fire(g);
      else if (kind === 'post') palisade(g);
      else flag(g, flagKind);
    });
    return this.spawn(entry);
  }

  private spawn(entry: SpriteTexture): Sprite {
    const sprite = new Sprite(entry.texture);
    sprite.anchor.set(entry.anchorX, entry.anchorY);
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
