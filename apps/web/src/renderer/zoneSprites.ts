import type { Graphics } from 'pixi.js';
import { INDUSTRIAL_HEIGHTS, INDUSTRIAL_INSET, chimneys, lerp, up } from './chimneys';
import { TILE_H, TILE_W, type Point } from './iso';
import { shade } from './palette';

/** Zone lots: `variant` 0..3 from `tileVariant` picks a palette and a silhouette. */

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

interface BoxColors {
  wall: number;
  roof: number;
  window?: number;
}

interface Palette extends BoxColors {
  accent: number;
}

/** Cream / terracotta, beige / slate, stone / brown, peach / green. */
const RES_PALETTES: Palette[] = [
  { wall: 0xe8dcc0, roof: 0xb6483a, window: 0x6fa8d8, accent: 0x8a4a3a },
  { wall: 0xd4c4a0, roof: 0x4a6080, window: 0x5a90c0, accent: 0x6a5344 },
  { wall: 0xf2e6d0, roof: 0x6b4a32, window: 0x7ab0d0, accent: 0x7a4a38 },
  { wall: 0xe6c8b4, roof: 0x3d6b48, window: 0x6a9cc0, accent: 0x5a4034 },
];

/** Stucco, brick, glass-blue, charcoal — not three tints of the same office. */
const COM_PALETTES: Palette[] = [
  { wall: 0xf0e6d4, roof: 0xc45a42, window: 0xd8eefc, accent: 0xd84a4a },
  { wall: 0xc47858, roof: 0x5a4038, window: 0xffe8c8, accent: 0x2a8f7a },
  { wall: 0x7a9bb8, roof: 0x4a6078, window: 0xc8e4f8, accent: 0x3a5a8a },
  { wall: 0x3a424c, roof: 0xb88850, window: 0x8ec8e8, accent: 0xe8c040 },
];

/** Yellow roof, brown steel, tan brick, rust. */
const IND_PALETTES: Palette[] = [
  { wall: 0xb0aaa0, roof: 0xd0a030, window: 0x50606a, accent: 0x8a4a3a },
  { wall: 0x8a9098, roof: 0x6a5848, window: 0x405058, accent: 0x6a7078 },
  { wall: 0xc4b090, roof: 0x6a7070, window: 0x50606a, accent: 0x7a5040 },
  { wall: 0x8a9a88, roof: 0xb05038, window: 0x405048, accent: 0x6a6860 },
];

function poly(g: Graphics, points: Point[], color: number, alpha = 1): void {
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color, alpha });
}

/** Tile UV: `u` along +x, `v` along +y; the front (south) vertex is the origin. */
function atUV(u: number, v: number): Point {
  return { x: (u - v) * HALF_W, y: (u + v - 2) * HALF_H };
}

function uvCorners(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
): {
  t: Point;
  r: Point;
  b: Point;
  l: Point;
} {
  return {
    t: atUV(u0, v0),
    r: atUV(u1, v0),
    b: atUV(u1, v1),
    l: atUV(u0, v1),
  };
}

function windows(
  g: Graphics,
  from: Point,
  to: Point,
  z0: number,
  height: number,
  floors: number,
  color: number,
): void {
  const columns = Math.max(2, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 9));
  const floorH = height / floors;
  for (let f = 0; f < floors; f++) {
    const za = z0 + f * floorH + floorH * 0.3;
    const zb = z0 + f * floorH + floorH * 0.75;
    for (let c = 0; c < columns; c++) {
      const a = lerp(from, to, (c + 0.25) / columns);
      const e = lerp(from, to, (c + 0.7) / columns);
      poly(g, [up(a, za), up(e, za), up(e, zb), up(a, zb)], color);
    }
  }
}

/** Box on a tile UV rectangle. `z0` lifts it off the ground (rooftop volumes). */
function boxUV(
  g: Graphics,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  height: number,
  colors: BoxColors,
  floors = 0,
  z0 = 0,
): Point[] {
  const { t, r, b, l } = uvCorners(u0, v0, u1, v1);
  poly(g, [up(l, z0), up(b, z0), up(b, z0 + height), up(l, z0 + height)], shade(colors.wall, 0.78));
  poly(g, [up(b, z0), up(r, z0), up(r, z0 + height), up(b, z0 + height)], shade(colors.wall, 0.95));
  const top = [up(t, z0 + height), up(r, z0 + height), up(b, z0 + height), up(l, z0 + height)];
  poly(g, top, colors.roof);
  if (floors > 0 && colors.window !== undefined) {
    windows(g, l, b, z0, height, floors, shade(colors.window, 0.85));
    windows(g, b, r, z0, height, floors, colors.window);
  }
  g.poly([...top, top[0] as Point].flatMap((p) => [p.x, p.y])).stroke({
    width: 1,
    color: shade(colors.roof, 0.7),
    alpha: 0.6,
  });
  return top;
}

function onTop(top: Point[], u: number, v: number): Point {
  const [t, , b, l] = top as [Point, Point, Point, Point];
  return {
    x: l.x + u * (t.x - l.x) + v * (b.x - l.x),
    y: l.y + u * (t.y - l.y) + v * (b.y - l.y),
  };
}

/** Gable with the ridge running left–right. */
function pitchedRoof(g: Graphics, top: Point[], rise: number, color: number): void {
  const [t, r, b, l] = top as [Point, Point, Point, Point];
  const ridgeA = up(lerp(t, l, 0.5), rise);
  const ridgeB = up(lerp(r, b, 0.5), rise);
  poly(g, [l, b, ridgeB, ridgeA], shade(color, 0.85));
  poly(g, [t, r, ridgeB, ridgeA], shade(color, 1.1));
}

/** Gable with the ridge running front–back. */
function pitchedRoofSide(g: Graphics, top: Point[], rise: number, color: number): void {
  const [t, r, b, l] = top as [Point, Point, Point, Point];
  const ridgeA = up(lerp(t, r, 0.5), rise);
  const ridgeB = up(lerp(l, b, 0.5), rise);
  poly(g, [t, l, ridgeB, ridgeA], shade(color, 0.85));
  poly(g, [r, b, ridgeB, ridgeA], shade(color, 1.1));
}

function hipRoof(g: Graphics, top: Point[], rise: number, color: number): void {
  const [t, r, b, l] = top as [Point, Point, Point, Point];
  const peak = up(lerp(lerp(t, r, 0.5), lerp(l, b, 0.5), 0.5), rise);
  poly(g, [t, r, peak], shade(color, 1.12));
  poly(g, [r, b, peak], shade(color, 0.95));
  poly(g, [b, l, peak], shade(color, 0.72));
  poly(g, [l, t, peak], shade(color, 0.88));
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

function tank(g: Graphics, p: Point, radius: number, height: number, color: number): void {
  g.ellipse(p.x, p.y, radius, radius * 0.45).fill(shade(color, 0.7));
  g.rect(p.x - radius, p.y - height, radius * 2, height).fill(color);
  g.ellipse(p.x, p.y - height, radius, radius * 0.45).fill(shade(color, 1.15));
}

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

function awning(
  g: Graphics,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  z: number,
  drop: number,
  dark: number,
  light: number,
  stripes = 4,
): void {
  const { b, r, l } = uvCorners(u0, v0, u1, v1);
  const out = { x: (b.x - l.x) * 0.22, y: (b.y - l.y) * 0.22 };
  for (let k = 0; k < stripes; k++) {
    const a = lerp(b, r, k / stripes);
    const e = lerp(b, r, (k + 1) / stripes);
    poly(
      g,
      [
        up(a, z),
        up(e, z),
        { x: e.x + out.x, y: e.y + out.y - drop },
        { x: a.x + out.x, y: a.y + out.y - drop },
      ],
      k % 2 === 0 ? dark : light,
    );
  }
}

function parapet(g: Graphics, top: Point[], rise: number, color: number): void {
  const [t, r, b, l] = top as [Point, Point, Point, Point];
  poly(g, [l, b, up(b, rise), up(l, rise)], shade(color, 0.7));
  poly(g, [b, r, up(r, rise), up(b, rise)], shade(color, 0.9));
  poly(g, [up(t, rise), up(r, rise), up(b, rise), up(l, rise)], shade(color, 1.08));
}

function door(g: Graphics, from: Point, to: Point, t: number, z1: number, color: number): void {
  const a = lerp(from, to, t);
  const e = lerp(from, to, t + 0.14);
  poly(g, [a, e, up(e, z1), up(a, z1)], color);
}

function hangingSign(g: Graphics, p: Point, color: number): void {
  g.rect(p.x - 0.7, p.y - 12, 1.4, 5).fill(0x4a4a48);
  g.rect(p.x + 0.7, p.y - 13, 10, 8).fill(color);
}

function billboard(g: Graphics, p: Point, color: number): void {
  g.rect(p.x - 1, p.y - 14, 2, 14).fill(0x5a5a58);
  g.rect(p.x + 1, p.y - 16, 14, 9).fill(color);
  g.rect(p.x + 2.5, p.y - 14.5, 11, 6).fill(shade(color, 1.15));
}

function muted(p: Palette, abandoned: boolean): Palette {
  if (!abandoned) return p;
  return { wall: 0x77706a, roof: 0x55504c, window: 0x333333, accent: 0x4a4844 };
}

function styleOf(variant: number): number {
  return variant & 3;
}

export function drawResidential(
  g: Graphics,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const style = styleOf(variant);
  const p = muted(RES_PALETTES[style] ?? RES_PALETTES[0]!, abandoned);
  const colors: BoxColors = { wall: p.wall, roof: p.roof, window: p.window };

  if (level <= 2) {
    const h = level <= 1 ? 12 : 22;
    const floors = level <= 1 ? 1 : 2;
    const rise = level <= 1 ? 9 : 10;
    if (style === 0) {
      const top = boxUV(g, 0.22, 0.22, 0.78, 0.78, h, colors, floors);
      pitchedRoof(g, top, rise, p.roof);
    } else if (style === 1) {
      const top = boxUV(g, 0.16, 0.18, 0.84, 0.82, h, colors, floors);
      hipRoof(g, top, rise, p.roof);
      chimney(g, up(onTop(top, 0.72, 0.36), rise * 0.4), 9, p.accent);
    } else if (style === 2) {
      const top = boxUV(g, 0.18, 0.1, 0.82, 0.64, h, colors, floors);
      pitchedRoofSide(g, top, rise, p.roof);
      const porch = uvCorners(0.28, 0.64, 0.72, 0.94);
      boxUV(g, 0.28, 0.64, 0.72, 0.94, 7, {
        wall: shade(p.wall, 0.9),
        roof: shade(p.roof, 0.85),
      });
      door(g, porch.b, porch.r, 0.36, 7, shade(p.accent, 0.7));
    } else {
      // Wing on the camera-facing front-right so the L reads in iso.
      const main = boxUV(g, 0.1, 0.12, 0.68, 0.78, h, colors, floors);
      pitchedRoof(g, main, rise, p.roof);
      const wing = boxUV(g, 0.5, 0.48, 0.9, 0.88, h * 0.78, colors, Math.max(1, floors - 1));
      pitchedRoofSide(g, wing, rise * 0.7, p.roof);
    }
    return;
  }

  const heights = [0, 0, 0, 40, 68, 104];
  const floors = [0, 0, 0, 4, 7, 11];
  const h = heights[level] ?? 40;
  const f = floors[level] ?? 4;
  const flat = { wall: p.wall, roof: shade(p.wall, 0.8), window: p.window };

  if (style === 0) {
    const top = boxUV(g, 0.1, 0.1, 0.9, 0.9, h, flat, f);
    if (abandoned) return;
    waterTank(g, onTop(top, 0.55, 0.4));
    if (level >= 5) antenna(g, onTop(top, 0.3, 0.7), 16);
    return;
  }
  if (style === 1) {
    boxUV(g, 0.1, 0.1, 0.9, 0.9, h * 0.76, flat, Math.max(2, f - 2));
    const top = boxUV(g, 0.22, 0.22, 0.78, 0.78, h * 0.24, flat, 2, h * 0.76);
    if (abandoned) return;
    miniBox(g, onTop(top, 0.5, 0.45), 6, 5, shade(p.wall, 0.7));
    return;
  }
  if (style === 2) {
    boxUV(
      g,
      0.06,
      0.06,
      0.94,
      0.94,
      11,
      { wall: shade(p.wall, 0.7), roof: shade(p.wall, 0.75), window: p.window },
      1,
    );
    const top = boxUV(g, 0.16, 0.16, 0.84, 0.84, h, flat, f);
    if (!abandoned) antenna(g, onTop(top, 0.65, 0.28), 14);
    return;
  }
  const main = boxUV(g, 0.1, 0.08, 0.9, 0.58, h, flat, f);
  const wing = boxUV(g, 0.1, 0.58, 0.52, 0.92, h * 0.7, flat, Math.max(2, f - 3));
  if (abandoned) return;
  waterTank(g, onTop(main, 0.7, 0.4));
  if (level >= 5) antenna(g, onTop(wing, 0.4, 0.5), 16);
}

export function drawCommercial(
  g: Graphics,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const style = styleOf(variant);
  const p = muted(COM_PALETTES[style] ?? COM_PALETTES[0]!, abandoned);
  const stripe = abandoned ? 0x6a6864 : p.accent;
  const cream = abandoned ? 0x8a8680 : 0xf2efe6;

  if (level <= 2) {
    const h = level <= 1 ? 16 : 28;
    const floors = level <= 1 ? 1 : 2;
    const u0 = 0.16;
    const v0 = 0.16;
    const u1 = 0.84;
    const v1 = 0.84;
    if (style === 2) {
      const top = boxUV(
        g,
        u0,
        v0,
        u1,
        v1,
        h,
        { wall: p.wall, roof: p.roof, window: p.window },
        floors,
      );
      parapet(g, top, 3, p.roof);
      const { b, r } = uvCorners(u0, v0, u1, v1);
      door(g, b, r, 0.4, 8, shade(p.accent, 0.55));
      return;
    }
    if (style === 3) {
      boxUV(g, u0, v0, u1, v1, 8, { wall: shade(p.wall, 0.72), roof: p.roof, window: p.window }, 1);
      boxUV(
        g,
        u0 + 0.03,
        v0 + 0.03,
        u1 - 0.03,
        v1 - 0.03,
        h,
        { wall: p.wall, roof: p.roof, window: p.window },
        floors,
      );
      awning(g, u0, v0, u1, v1, 10, 7, stripe, abandoned ? 0x5a5854 : 0x2a2a2a);
      return;
    }
    boxUV(g, u0, v0, u1, v1, h, { wall: p.wall, roof: p.roof, window: p.window }, floors);
    awning(g, u0, v0, u1, v1, 10, 7, stripe, cream);
    if (style === 1 && !abandoned) {
      const { l, b } = uvCorners(u0, v0, u1, v1);
      hangingSign(g, up(lerp(l, b, 0.22), 12), p.accent);
    }
    return;
  }

  const heights = [0, 16, 28, 50, 84, 128];
  const floors = [0, 1, 2, 4, 7, 11];
  const h = heights[level] ?? 16;
  const f = floors[level] ?? 1;
  const colors: BoxColors = { wall: p.wall, roof: p.roof, window: p.window };

  if (style === 0) {
    const top = boxUV(g, 0.1, 0.1, 0.9, 0.9, h, colors, f);
    if (abandoned) return;
    if (level === 3) {
      miniBox(g, onTop(top, 0.35, 0.35), 5, 4, 0xb8bcc0);
      miniBox(g, onTop(top, 0.7, 0.55), 5, 4, 0xb8bcc0);
    } else {
      miniBox(g, onTop(top, 0.5, 0.5), 9, 8, shade(p.roof, 0.9));
      antenna(g, onTop(top, 0.5, 0.5), level >= 5 ? 30 : 18);
    }
    return;
  }
  if (style === 1) {
    boxUV(g, 0.1, 0.1, 0.9, 0.9, h * 0.78, colors, Math.max(2, f - 2));
    const top = boxUV(g, 0.2, 0.2, 0.8, 0.8, h * 0.22, colors, 2, h * 0.78);
    if (!abandoned) antenna(g, onTop(top, 0.55, 0.45), level >= 5 ? 22 : 14);
    return;
  }
  if (style === 2) {
    const back = boxUV(g, 0.1, 0.08, 0.9, 0.58, h, colors, f);
    boxUV(g, 0.1, 0.58, 0.5, 0.9, h * 0.78, colors, Math.max(2, f - 2));
    if (!abandoned) miniBox(g, onTop(back, 0.75, 0.35), 6, 5, shade(p.roof, 0.85));
    return;
  }
  const top = boxUV(g, 0.1, 0.1, 0.9, 0.9, h, colors, f);
  if (abandoned) return;
  billboard(g, onTop(top, 0.2, 0.55), p.accent);
  antenna(g, onTop(top, 0.75, 0.3), level >= 5 ? 24 : 16);
}

export function drawIndustrial(
  g: Graphics,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const style = styleOf(variant);
  const p = muted(IND_PALETTES[style] ?? IND_PALETTES[0]!, abandoned);
  const colors: BoxColors = { wall: p.wall, roof: p.roof, window: p.window };
  const h = INDUSTRIAL_HEIGHTS[level] ?? 12;

  if (level <= 2) {
    if (style === 0) {
      const top = boxUV(
        g,
        INDUSTRIAL_INSET,
        INDUSTRIAL_INSET,
        1 - INDUSTRIAL_INSET,
        1 - INDUSTRIAL_INSET,
        h,
        colors,
      );
      sawtooth(g, top, 3, 6, p.roof);
    } else if (style === 1) {
      const top = boxUV(g, 0.16, 0.16, 0.84, 0.84, h, colors);
      tank(g, onTop(top, 0.32, 0.4), 5, 8, shade(p.wall, 0.85));
      tank(g, onTop(top, 0.68, 0.58), 4, 6, shade(p.wall, 0.7));
    } else if (style === 2) {
      const shed = boxUV(g, 0.1, 0.08, 0.9, 0.6, h, colors);
      sawtooth(g, shed, 2, 5, p.roof);
      boxUV(
        g,
        0.16,
        0.6,
        0.58,
        0.9,
        14,
        { wall: shade(p.wall, 1.06), roof: p.roof, window: p.window },
        1,
      );
    } else {
      boxUV(g, 0.08, 0.56, 0.92, 0.92, 5, { wall: shade(p.wall, 0.78), roof: 0x5a5a58 });
      const top = boxUV(g, 0.12, 0.1, 0.88, 0.58, h, colors);
      sawtooth(g, top, 2, 5, p.roof);
    }
    return;
  }

  // Main volume stays on chimneys() so smoke sits on the roof; extras sit in front.
  const top = boxUV(
    g,
    INDUSTRIAL_INSET,
    INDUSTRIAL_INSET,
    1 - INDUSTRIAL_INSET,
    1 - INDUSTRIAL_INSET,
    h,
    { wall: p.wall, roof: p.roof, window: 0x50606a },
    1,
  );
  if (style === 1) {
    boxUV(g, 0.18, 0.78, 0.58, 0.98, h * 0.45, { wall: shade(p.wall, 0.9), roof: p.roof });
  } else if (style === 2) {
    boxUV(
      g,
      0.08,
      0.68,
      0.4,
      0.96,
      h + 8,
      { wall: shade(p.wall, 1.08), roof: p.roof, window: p.window },
      1,
    );
  } else if (style === 3 && !abandoned) {
    tank(g, onTop(top, 0.25, 0.35), 5, 7, shade(p.wall, 0.8));
    tank(g, onTop(top, 0.72, 0.58), 4, 6, shade(p.wall, 0.7));
  }
  for (const c of chimneys('industrial', level, 1)) {
    chimney(g, c.base, c.height, abandoned ? 0x555555 : c.color);
  }
}
