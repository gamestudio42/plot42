import type { BuildingRecord } from '@city/shared';
import { Container, Graphics, type Renderer, type Texture } from 'pixi.js';
import { TILE_H, TILE_W, type Point } from './iso';
import { shade } from './palette';

export interface SpriteTexture {
  texture: Texture;
  anchorX: number;
  anchorY: number;
}

interface BoxColors {
  wall: number;
  roof: number;
  window?: number;
}

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

/** Footprint diamond of n×n tiles whose front (south) vertex is at the origin. */
function footprint(n: number, inset: number): { b: Point; r: Point; t: Point; l: Point } {
  const s = n - inset * 2;
  const ox = 0;
  const oy = -inset * TILE_H;
  return {
    b: { x: ox, y: oy },
    r: { x: ox + s * HALF_W, y: oy - s * HALF_H },
    t: { x: ox, y: oy - s * TILE_H },
    l: { x: ox - s * HALF_W, y: oy - s * HALF_H },
  };
}

function up(p: Point, h: number): Point {
  return { x: p.x, y: p.y - h };
}

function poly(g: Graphics, points: Point[], color: number, alpha = 1): void {
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color, alpha });
}

/** Draws an isometric box and returns its top face corners. */
function box(
  g: Graphics,
  n: number,
  inset: number,
  height: number,
  colors: BoxColors,
  floors = 0,
): Point[] {
  const { b, r, t, l } = footprint(n, inset);
  poly(g, [l, b, up(b, height), up(l, height)], shade(colors.wall, 0.78));
  poly(g, [b, r, up(r, height), up(b, height)], shade(colors.wall, 0.95));
  const top = [up(t, height), up(r, height), up(b, height), up(l, height)];
  poly(g, top, colors.roof);
  if (floors > 0 && colors.window !== undefined) {
    windows(g, l, b, height, floors, shade(colors.window, 0.85));
    windows(g, b, r, height, floors, colors.window);
  }
  g.poly([...top, top[0] as Point].flatMap((p) => [p.x, p.y])).stroke({
    width: 1,
    color: shade(colors.roof, 0.7),
    alpha: 0.6,
  });
  return top;
}

function windows(
  g: Graphics,
  from: Point,
  to: Point,
  height: number,
  floors: number,
  color: number,
): void {
  const columns = Math.max(2, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 9));
  const floorH = height / floors;
  for (let f = 0; f < floors; f++) {
    const z0 = f * floorH + floorH * 0.3;
    const z1 = f * floorH + floorH * 0.75;
    for (let c = 0; c < columns; c++) {
      const t0 = (c + 0.25) / columns;
      const t1 = (c + 0.7) / columns;
      const a = lerp(from, to, t0);
      const b = lerp(from, to, t1);
      poly(g, [up(a, z0), up(b, z0), up(b, z1), up(a, z1)], color);
    }
  }
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Pitched roof on top of a 1-tile box (ridge along the x axis). */
function pitchedRoof(g: Graphics, top: Point[], rise: number, color: number): void {
  const [t, r, b, l] = top as [Point, Point, Point, Point];
  const ridgeA = up(lerp(t, l, 0.5), rise);
  const ridgeB = up(lerp(r, b, 0.5), rise);
  poly(g, [l, b, ridgeB, ridgeA], shade(color, 0.85));
  poly(g, [t, r, ridgeB, ridgeA], shade(color, 1.1));
}

function chimney(g: Graphics, base: Point, height: number, color: number): void {
  poly(
    g,
    [
      { x: base.x - 4, y: base.y },
      { x: base.x, y: base.y + 2 },
      { x: base.x, y: base.y + 2 - height },
      { x: base.x - 4, y: base.y - height },
    ],
    shade(color, 0.8),
  );
  poly(
    g,
    [
      { x: base.x, y: base.y + 2 },
      { x: base.x + 4, y: base.y },
      { x: base.x + 4, y: base.y - height },
      { x: base.x, y: base.y + 2 - height },
    ],
    color,
  );
  g.ellipse(base.x, base.y - height, 4, 2).fill(0x333333);
}

/** Small isometric block (rooftop machinery) standing on point `p`. */
function miniBox(g: Graphics, p: Point, size: number, height: number, color: number): void {
  const b = { x: p.x, y: p.y + size / 2 };
  const r = { x: p.x + size, y: p.y };
  const t = { x: p.x, y: p.y - size / 2 };
  const l = { x: p.x - size, y: p.y };
  poly(g, [l, b, up(b, height), up(l, height)], shade(color, 0.75));
  poly(g, [b, r, up(r, height), up(b, height)], shade(color, 0.92));
  poly(g, [up(t, height), up(r, height), up(b, height), up(l, height)], shade(color, 1.1));
}

function waterTank(g: Graphics, p: Point): void {
  g.rect(p.x - 4, p.y - 6, 1.5, 6).fill(0x5a4a3a);
  g.rect(p.x + 2.5, p.y - 6, 1.5, 6).fill(0x5a4a3a);
  g.rect(p.x - 5, p.y - 14, 10, 8).fill(0x8a6a4a);
  g.ellipse(p.x, p.y - 6, 5, 2.5).fill(0x7a5a3a);
  g.poly([p.x - 5.5, p.y - 14, p.x, p.y - 19, p.x + 5.5, p.y - 14]).fill(0x5a4a3a);
}

function antenna(g: Graphics, p: Point, height: number): void {
  g.rect(p.x - 0.75, p.y - height, 1.5, height).fill(0x707070);
  g.circle(p.x, p.y - height, 1.8).fill(0xff3a30);
}

/** Point on a box's top face: `u` from the left corner towards the back, `v` towards the front. */
function onTop(top: Point[], u: number, v: number): Point {
  const [t, , b, l] = top as [Point, Point, Point, Point];
  return {
    x: l.x + u * (t.x - l.x) + v * (b.x - l.x),
    y: l.y + u * (t.y - l.y) + v * (b.y - l.y),
  };
}

/** Factory sawtooth roof: slopes rising towards the front, with glazed vertical faces. */
function sawtooth(g: Graphics, top: Point[], teeth: number, rise: number, color: number): void {
  for (let k = 0; k < teeth; k++) {
    const v0 = k / teeth;
    const v1 = (k + 1) / teeth;
    const a0 = onTop(top, 0, v0);
    const b0 = onTop(top, 1, v0);
    const a1 = onTop(top, 0, v1);
    const b1 = onTop(top, 1, v1);
    poly(g, [a0, b0, up(b1, rise), up(a1, rise)], shade(color, 1.05));
    poly(g, [a1, b1, up(b1, rise), up(a1, rise)], 0x9fc0d0);
  }
}

function smoke(g: Graphics, p: Point): void {
  g.circle(p.x + 2, p.y - 6, 4).fill({ color: 0xdddddd, alpha: 0.7 });
  g.circle(p.x + 6, p.y - 12, 5).fill({ color: 0xcccccc, alpha: 0.55 });
  g.circle(p.x + 11, p.y - 19, 6).fill({ color: 0xbbbbbb, alpha: 0.4 });
}

const RES_PALETTES = [
  { wall: 0xe8dcc0, roof: 0xb6483a },
  { wall: 0xd8c8a8, roof: 0x5a6f8c },
  { wall: 0xf0e6d2, roof: 0x7a5a3a },
];
const COM_PALETTES = [
  { wall: 0x9fb8d8, roof: 0x5f7fa8 },
  { wall: 0xb8c8d8, roof: 0x7088a0 },
  { wall: 0x88a8c8, roof: 0x48688f },
];
const IND_PALETTES = [
  { wall: 0xb0aaa0, roof: 0xd0a030 },
  { wall: 0xa0a4a8, roof: 0x8a8070 },
  { wall: 0xb8a890, roof: 0x707070 },
];

function drawResidential(g: Graphics, level: number, variant: number, abandoned: boolean): void {
  const p = RES_PALETTES[variant % RES_PALETTES.length] ?? RES_PALETTES[0]!;
  const wall = abandoned ? 0x77706a : p.wall;
  const roof = abandoned ? 0x55504c : p.roof;
  const window = abandoned ? 0x333333 : 0x6fa8d8;
  if (level <= 1) {
    const top = box(g, 1, 0.22, 12, { wall, roof, window }, 1);
    pitchedRoof(g, top, 9, roof);
  } else if (level === 2) {
    const top = box(g, 1, 0.15, 22, { wall, roof, window }, 2);
    pitchedRoof(g, top, 10, roof);
  } else {
    const heights = [0, 0, 0, 40, 68, 104];
    const floors = [0, 0, 0, 4, 7, 11];
    const top = box(
      g,
      1,
      0.1,
      heights[level] ?? 40,
      { wall, roof: shade(wall, 0.8), window },
      floors[level] ?? 4,
    );
    if (abandoned) return;
    if (variant % 2 === 0) waterTank(g, onTop(top, 0.55, 0.4));
    else miniBox(g, onTop(top, 0.5, 0.45), 6, 5, shade(wall, 0.7));
    if (level >= 5) antenna(g, onTop(top, 0.3, 0.7), 16);
  }
}

function drawCommercial(g: Graphics, level: number, variant: number, abandoned: boolean): void {
  const p = COM_PALETTES[variant % COM_PALETTES.length] ?? COM_PALETTES[0]!;
  const wall = abandoned ? 0x6f7276 : p.wall;
  const roof = abandoned ? 0x505357 : p.roof;
  const window = abandoned ? 0x303030 : 0xd8eefc;
  const heights = [0, 16, 28, 50, 84, 128];
  const floors = [0, 1, 2, 4, 7, 11];
  const inset = level <= 1 ? 0.18 : 0.1;
  const top = box(g, 1, inset, heights[level] ?? 16, { wall, roof, window }, floors[level] ?? 1);
  if (abandoned) return;
  if (level <= 2) {
    // Striped awning over the shop front (the south-east facade).
    const { b, r, l } = footprint(1, inset);
    const out = { x: (b.x - l.x) * 0.22, y: (b.y - l.y) * 0.22 };
    const stripes = 4;
    for (let k = 0; k < stripes; k++) {
      const a = lerp(b, r, k / stripes);
      const e = lerp(b, r, (k + 1) / stripes);
      poly(
        g,
        [
          up(a, 10),
          up(e, 10),
          { x: e.x + out.x, y: e.y + out.y - 7 },
          { x: a.x + out.x, y: a.y + out.y - 7 },
        ],
        k % 2 === 0 ? 0xd84a4a : 0xf2efe6,
      );
    }
  } else if (level === 3) {
    miniBox(g, onTop(top, 0.35, 0.35), 5, 4, 0xb8bcc0);
    miniBox(g, onTop(top, 0.7, 0.55), 5, 4, 0xb8bcc0);
  } else {
    miniBox(g, onTop(top, 0.5, 0.5), 9, 8, shade(roof, 0.9));
    antenna(g, onTop(top, 0.5, 0.5), level >= 5 ? 30 : 18);
  }
}

function drawIndustrial(g: Graphics, level: number, variant: number, abandoned: boolean): void {
  const p = IND_PALETTES[variant % IND_PALETTES.length] ?? IND_PALETTES[0]!;
  const wall = abandoned ? 0x6a6560 : p.wall;
  const roof = abandoned ? 0x4f4a45 : p.roof;
  const heights = [0, 12, 18, 22, 28, 34];
  const top = box(
    g,
    1,
    0.12,
    heights[level] ?? 12,
    { wall, roof, window: 0x50606a },
    level >= 3 ? 1 : 0,
  );
  if (level <= 2) sawtooth(g, top, 3, 6, roof);
  if (level >= 3) {
    const c = lerp(top[0] as Point, top[2] as Point, 0.4);
    chimney(g, c, 14 + level * 4, abandoned ? 0x555555 : 0x8a4a3a);
    if (!abandoned) smoke(g, up(c, 14 + level * 4));
  }
  if (level >= 5)
    chimney(g, lerp(top[0] as Point, top[2] as Point, 0.75), 26, abandoned ? 0x555555 : 0x7a4a3a);
}

function drawPlaceable(g: Graphics, kind: string, size: number): void {
  switch (kind) {
    case 'coalPlant': {
      const top = box(g, size, 0.08, 26, { wall: 0x8c8378, roof: 0x5a524a, window: 0xd8b860 }, 2);
      const c1 = lerp(top[0] as Point, top[2] as Point, 0.3);
      const c2 = lerp(top[0] as Point, top[2] as Point, 0.6);
      chimney(g, c1, 50, 0x9a5040);
      chimney(g, c2, 50, 0x9a5040);
      smoke(g, up(c1, 50));
      smoke(g, up(c2, 50));
      break;
    }
    case 'gasPlant': {
      const top = box(g, size, 0.1, 20, { wall: 0xa8b0b0, roof: 0x707a80, window: 0xd8c070 }, 1);
      const c = lerp(top[0] as Point, top[2] as Point, 0.5);
      g.ellipse(c.x - 14, c.y + 2, 10, 5).fill(0xd0d4d8);
      g.rect(c.x - 24, c.y - 16, 20, 18).fill(0xc0c4c8);
      g.ellipse(c.x - 14, c.y - 16, 10, 5).fill(0xe0e4e8);
      chimney(g, lerp(top[0] as Point, top[2] as Point, 0.7), 30, 0x8a8a8a);
      break;
    }
    case 'windTurbine': {
      g.rect(-1.5, -52, 3, 46).fill(0xeeeeee);
      const hub = { x: 0, y: -52 };
      for (const [dx, dy] of [
        [0, -20],
        [17, 10],
        [-17, 10],
      ] as const) {
        g.moveTo(hub.x, hub.y)
          .lineTo(hub.x + dx, hub.y + dy)
          .stroke({ width: 3, color: 0xffffff });
      }
      g.circle(hub.x, hub.y, 3).fill(0xcccccc);
      break;
    }
    case 'waterPump': {
      const top = box(g, size, 0.12, 14, { wall: 0x7fa8c8, roof: 0x4f7898, window: 0xcfe8ff }, 1);
      const c = lerp(top[0] as Point, top[2] as Point, 0.6);
      g.rect(c.x - 9, c.y - 26, 18, 22).fill(0x5f90b8);
      g.ellipse(c.x, c.y - 26, 9, 4).fill(0x8fc0e8);
      break;
    }
    case 'policeStation': {
      const top = box(g, size, 0.1, 24, { wall: 0x5f78b8, roof: 0x3a4f88, window: 0xd8e8ff }, 2);
      const c = lerp(top[0] as Point, top[2] as Point, 0.5);
      star(g, c.x, c.y - 4, 7, 0xf0d040);
      break;
    }
    case 'fireStation': {
      box(g, size, 0.1, 22, { wall: 0xc8483a, roof: 0x8a2a20, window: 0xffe0c0 }, 2);
      const { b, r } = footprint(size, 0.1);
      for (const t of [0.2, 0.55]) {
        const a = lerp(b, r, t);
        const e = lerp(b, r, t + 0.25);
        poly(g, [a, e, up(e, 12), up(a, 12)], 0xeeeeee);
      }
      break;
    }
    case 'school': {
      const top = box(g, size, 0.1, 20, { wall: 0xe0a050, roof: 0xa86a30, window: 0xfff2d0 }, 2);
      const c = top[0] as Point;
      g.rect(c.x, c.y - 26, 1.5, 26).fill(0x555555);
      g.rect(c.x + 1.5, c.y - 26, 12, 7).fill(0x2f9f4f);
      break;
    }
    case 'hospital': {
      const top = box(g, size, 0.1, 30, { wall: 0xf0f0f0, roof: 0xc8c8c8, window: 0x9fc8e8 }, 3);
      const c = lerp(top[0] as Point, top[2] as Point, 0.5);
      g.rect(c.x - 9, c.y - 3, 18, 6).fill(0xd83030);
      g.rect(c.x - 3, c.y - 9, 6, 18).fill(0xd83030);
      break;
    }
    case 'park': {
      const { b, r, t, l } = footprint(size, 0.04);
      poly(g, [t, r, b, l], 0x58b848);
      g.ellipse(-6, -14, 8, 4).fill(0x4f9fe0);
      tree(g, { x: 9, y: -10 }, 1);
      tree(g, { x: -12, y: -22 }, 0.8);
      tree(g, { x: 4, y: -24 }, 0.7);
      break;
    }
  }
}

function star(g: Graphics, cx: number, cy: number, r: number, color: number): void {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    points.push(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius * 0.6);
  }
  g.poly(points).fill(color);
}

function tree(g: Graphics, base: Point, scale: number): void {
  g.rect(base.x - 1.5 * scale, base.y - 8 * scale, 3 * scale, 8 * scale).fill(0x6a4a2a);
  g.circle(base.x, base.y - 13 * scale, 7 * scale).fill(0x2f7a3a);
  g.circle(base.x - 3 * scale, base.y - 16 * scale, 5 * scale).fill(0x3f8f45);
  g.circle(base.x + 2 * scale, base.y - 18 * scale, 4 * scale).fill(0x4fa050);
}

const TREE_SPOTS: Point[] = [
  { x: 0, y: -14 },
  { x: -12, y: -18 },
  { x: 11, y: -19 },
  { x: -2, y: -24 },
  { x: 6, y: -10 },
];

/** Generates and caches procedural textures. */
export class SpriteFactory {
  private readonly cache = new Map<string, SpriteTexture>();

  constructor(private readonly renderer: Renderer) {}

  building(
    b: Pick<BuildingRecord, 'kind' | 'level' | 'variant' | 'abandoned' | 'w'>,
  ): SpriteTexture {
    const level = Math.max(1, b.level);
    const key = `b:${b.kind}:${level}:${b.variant % 3}:${b.abandoned ? 1 : 0}`;
    return this.get(key, (g) => {
      if (b.kind === 'residential') drawResidential(g, level, b.variant, b.abandoned);
      else if (b.kind === 'commercial') drawCommercial(g, level, b.variant, b.abandoned);
      else if (b.kind === 'industrial') drawIndustrial(g, level, b.variant, b.abandoned);
      else drawPlaceable(g, b.kind, b.w);
    });
  }

  trees(density: number, variant: number): SpriteTexture {
    const d = Math.max(1, Math.min(3, density));
    return this.get(`t:${d}:${variant % 4}`, (g) => {
      const count = d === 1 ? 1 : d === 2 ? 3 : 5;
      const sorted = TREE_SPOTS.slice(0, count).sort((a, c) => a.y - c.y);
      sorted.forEach((spot, k) =>
        tree(
          g,
          { x: spot.x + ((variant + k) % 3) - 1, y: spot.y + 8 },
          0.75 + ((variant + k) % 3) * 0.1,
        ),
      );
    });
  }

  pole(): SpriteTexture {
    return this.get('pole', (g) => {
      g.rect(-1, -22, 2, 22).fill(0x6a4a2a);
      g.rect(-6, -21, 12, 2).fill(0x5a3a1a);
    });
  }

  flame(frame: number): SpriteTexture {
    return this.get(`fire:${frame % 2}`, (g) => {
      const s = frame % 2 === 0 ? 1 : 1.15;
      g.poly([-12 * s, -4, -4, -34 * s, 2, -12, 8, -40 * s, 14 * s, -4]).fill({
        color: 0xe8501f,
        alpha: 0.9,
      });
      g.poly([-7 * s, -4, -1, -24 * s, 4, -10, 7, -26 * s, 9 * s, -4]).fill({
        color: 0xf8c030,
        alpha: 0.95,
      });
    });
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
