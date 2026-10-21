import type { BuildingRecord } from '@city/shared';
import { Container, Graphics, type Renderer, type Texture } from 'pixi.js';
import { COAL_PLANT_BOX, GAS_PLANT_BOX, chimneys, footprint, lerp, up } from './chimneys';
import {
  BOAT_COLORS,
  HEADINGS,
  drawAirport,
  drawBoat,
  drawMarina,
  drawPlane,
  drawPlaneShadow,
  type BoatKind,
} from './hubSprites';
import { TILE_H, TILE_W, type Point } from './iso';
import { shade } from './palette';
import type { VehicleKind } from './animation/vehicles';
import { drawCommercial, drawIndustrial, drawResidential } from './zoneSprites';

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

function drawPlaceable(g: Graphics, kind: string, size: number): void {
  switch (kind) {
    case 'coalPlant': {
      box(
        g,
        size,
        COAL_PLANT_BOX.inset,
        COAL_PLANT_BOX.height,
        {
          wall: 0x8c8378,
          roof: 0x5a524a,
          window: 0xd8b860,
        },
        2,
      );
      for (const c of chimneys(kind, 1, size)) chimney(g, c.base, c.height, c.color);
      break;
    }
    case 'gasPlant': {
      const top = box(
        g,
        size,
        GAS_PLANT_BOX.inset,
        GAS_PLANT_BOX.height,
        {
          wall: 0xa8b0b0,
          roof: 0x707a80,
          window: 0xd8c070,
        },
        1,
      );
      const c = lerp(top[0] as Point, top[2] as Point, 0.5);
      g.ellipse(c.x - 14, c.y + 2, 10, 5).fill(0xd0d4d8);
      g.rect(c.x - 24, c.y - 16, 20, 18).fill(0xc0c4c8);
      g.ellipse(c.x - 14, c.y - 16, 10, 5).fill(0xe0e4e8);
      for (const ch of chimneys(kind, 1, size)) chimney(g, ch.base, ch.height, ch.color);
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
    case 'well': {
      box(g, size, 0.22, 8, { wall: 0x6a90b0, roof: 0x4a7088, window: 0xcfe8ff }, 0);
      g.rect(-5, -22, 10, 16).fill(0x4f88b8);
      g.ellipse(0, -22, 5, 2.4).fill(0x8fc0e8);
      g.ellipse(0, -6, 5, 2.2).fill(0x3a6a90);
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

const CAR_BODY = [0xd04040, 0x3f6fd0, 0xe8c040, 0xeeeeee, 0x3fa060, 0x45505c];

/** Screen offset of a ground point given in grid units from the origin. */
function isoProject(gx: number, gy: number): Point {
  return { x: (gx - gy) * HALF_W, y: (gx + gy) * HALF_H };
}

/** Ground rectangle (back, right, front, left) centred on the origin, `length` along `axis`. */
function groundRect(axis: 'x' | 'y', length: number, width: number): Point[] {
  const hx = (axis === 'x' ? length : width) / 2;
  const hy = (axis === 'x' ? width : length) / 2;
  return [isoProject(-hx, -hy), isoProject(hx, -hy), isoProject(hx, hy), isoProject(-hx, hy)];
}

function groundShadow(g: Graphics, axis: 'x' | 'y', length: number, width: number): void {
  poly(g, groundRect(axis, length, width), 0x000000, 0.22);
}

/** Box standing on the ground rectangle, lifted by `z0`; returns its top face. */
function groundBox(
  g: Graphics,
  axis: 'x' | 'y',
  length: number,
  width: number,
  z0: number,
  height: number,
  color: number,
  sideColor?: number,
): Point[] {
  const [t, r, b, l] = groundRect(axis, length, width).map((p) => up(p, z0)) as [
    Point,
    Point,
    Point,
    Point,
  ];
  const side = sideColor ?? color;
  poly(g, [l, b, up(b, height), up(l, height)], shade(side, 0.75));
  poly(g, [b, r, up(r, height), up(b, height)], shade(side, 0.92));
  const top = [up(t, height), up(r, height), up(b, height), up(l, height)];
  poly(g, top, color);
  return top;
}

/** Generates and caches procedural textures. */
export class SpriteFactory {
  private readonly cache = new Map<string, SpriteTexture>();

  constructor(private readonly renderer: Renderer) {}

  /** `side` turns buildings that face something (the marina faces its water, 0..3). */
  building(
    b: Pick<BuildingRecord, 'kind' | 'level' | 'variant' | 'abandoned' | 'w'>,
    side = 0,
  ): SpriteTexture {
    const level = Math.max(1, b.level);
    const key = `b:${b.kind}:${level}:${b.variant & 3}:${b.abandoned ? 1 : 0}:${side}`;
    return this.get(key, (g) => {
      if (b.kind === 'residential') drawResidential(g, level, b.variant, b.abandoned);
      else if (b.kind === 'commercial') drawCommercial(g, level, b.variant, b.abandoned);
      else if (b.kind === 'industrial') drawIndustrial(g, level, b.variant, b.abandoned);
      else if (b.kind === 'marina') drawMarina(g, side);
      else if (b.kind === 'airport') drawAirport(g);
      else drawPlaceable(g, b.kind, b.w);
    });
  }

  /** Boat centred on its position; `heading` indexes `HEADINGS`. */
  boat(kind: BoatKind, heading: number, color: number, moving: boolean): SpriteTexture {
    const c = color % BOAT_COLORS.length;
    return this.get(`boat:${kind}:${heading}:${c}:${moving ? 1 : 0}`, (g) =>
      drawBoat(
        g,
        { x: 0, y: 0 },
        HEADINGS[heading] as Point,
        kind,
        BOAT_COLORS[c] as number,
        moving,
      ),
    );
  }

  /** Airliner centred on its ground position (lift it by its altitude when placing it). */
  plane(heading: number): SpriteTexture {
    return this.get(`plane:${heading}`, (g) =>
      drawPlane(g, { x: 0, y: 0 }, HEADINGS[heading] as Point),
    );
  }

  planeShadow(heading: number): SpriteTexture {
    return this.get(`planeShadow:${heading}`, (g) =>
      drawPlaneShadow(g, { x: 0, y: 0 }, HEADINGS[heading] as Point),
    );
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

  /** Vehicle seen from above, its ground centre at the origin; `axis` is its travel axis. */
  vehicle(kind: VehicleKind, axis: 'x' | 'y', color: number, light = false): SpriteTexture {
    const key = `v:${kind}:${axis}:${kind === 'car' ? color % CAR_BODY.length : 0}:${light ? 1 : 0}`;
    return this.get(key, (g) => {
      const length = kind === 'car' ? 0.32 : 0.42;
      const width = kind === 'car' ? 0.17 : 0.19;
      groundShadow(g, axis, length + 0.04, width + 0.04);
      if (kind === 'car') {
        const body = CAR_BODY[color % CAR_BODY.length] as number;
        groundBox(g, axis, length, width, 0, 3.5, body);
        groundBox(g, axis, length * 0.5, width * 0.86, 3.5, 2.5, shade(body, 1.08), 0x2a3a4a);
      } else if (kind === 'truck') {
        groundBox(g, axis, length, width, 0, 6, 0xd8d8d0);
      } else {
        const [t, r, b, l] = groundBox(g, axis, length, width, 0, 5, 0xc8302a) as [
          Point,
          Point,
          Point,
          Point,
        ];
        // Ladder along the travel axis.
        const from = axis === 'x' ? lerp(t, l, 0.5) : lerp(t, r, 0.5);
        const to = axis === 'x' ? lerp(r, b, 0.5) : lerp(l, b, 0.5);
        const a = lerp(from, to, 0.15);
        const e = lerp(from, to, 0.85);
        g.moveTo(a.x, a.y).lineTo(e.x, e.y).stroke({ width: 1.2, color: 0xd8d8d8 });
        groundBox(
          g,
          axis,
          0.06,
          width * 0.8,
          5,
          1.6,
          light ? 0x4a8cff : 0x5a2a2a,
          light ? 0xff3a30 : 0x6a2020,
        );
      }
    });
  }

  smokePuff(): SpriteTexture {
    return this.get('smoke', (g) => {
      g.circle(0, 0, 9).fill({ color: 0xbcbcb8, alpha: 0.7 });
      g.circle(-2.5, -2.5, 6).fill({ color: 0xe4e4e0, alpha: 0.65 });
    });
  }

  /** Short glint on water, aligned with the isometric grid. */
  sparkle(): SpriteTexture {
    return this.get('sparkle', (g) => {
      g.poly([-5, 0, 0, -1.3, 5, 0, 0, 1.3]).fill({ color: 0xffffff, alpha: 0.95 });
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
