import type { BuildingRecord } from '@city/shared';
import { color, shade, type Theme } from '@theme/core';
import { Container, Graphics, type Renderer, type Texture } from 'pixi.js';
import { COAL_PLANT_BOX, GAS_PLANT_BOX, chimneys, footprint, lerp, up } from './chimneys';
import {
  HEADINGS,
  drawAirport,
  drawBoat,
  drawMarina,
  drawPlane,
  drawPlaneShadow,
  type BoatKind,
} from './hubSprites';
import { TILE_H, TILE_W, type Point } from './iso';
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

function poly(g: Graphics, points: Point[], fill: number, alpha = 1): void {
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color: fill, alpha });
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
  fill: number,
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
      poly(g, [up(a, z0), up(b, z0), up(b, z1), up(a, z1)], fill);
    }
  }
}

function chimney(g: Graphics, base: Point, height: number, fill: number, flue: number): void {
  poly(
    g,
    [
      { x: base.x - 4, y: base.y },
      { x: base.x, y: base.y + 2 },
      { x: base.x, y: base.y + 2 - height },
      { x: base.x - 4, y: base.y - height },
    ],
    shade(fill, 0.8),
  );
  poly(
    g,
    [
      { x: base.x, y: base.y + 2 },
      { x: base.x + 4, y: base.y },
      { x: base.x + 4, y: base.y - height },
      { x: base.x, y: base.y + 2 - height },
    ],
    fill,
  );
  g.ellipse(base.x, base.y - height, 4, 2).fill(flue);
}

function drawPlaceable(g: Graphics, theme: Theme, kind: string, size: number): void {
  const flue = color(theme, 'lot.chimneyFlue');
  switch (kind) {
    case 'coalPlant': {
      box(
        g,
        size,
        COAL_PLANT_BOX.inset,
        COAL_PLANT_BOX.height,
        {
          wall: color(theme, 'coal.wall'),
          roof: color(theme, 'coal.roof'),
          window: color(theme, 'coal.window'),
        },
        2,
      );
      for (const c of chimneys(kind, 1, size, theme)) chimney(g, c.base, c.height, c.color, flue);
      break;
    }
    case 'gasPlant': {
      const top = box(
        g,
        size,
        GAS_PLANT_BOX.inset,
        GAS_PLANT_BOX.height,
        {
          wall: color(theme, 'gas.wall'),
          roof: color(theme, 'gas.roof'),
          window: color(theme, 'gas.window'),
        },
        1,
      );
      const c = lerp(top[0] as Point, top[2] as Point, 0.5);
      g.ellipse(c.x - 14, c.y + 2, 10, 5).fill(color(theme, 'gas.tankRim'));
      g.rect(c.x - 24, c.y - 16, 20, 18).fill(color(theme, 'gas.tankBody'));
      g.ellipse(c.x - 14, c.y - 16, 10, 5).fill(color(theme, 'gas.tankTop'));
      for (const ch of chimneys(kind, 1, size, theme)) chimney(g, ch.base, ch.height, ch.color, flue);
      break;
    }
    case 'windTurbine': {
      g.rect(-1.5, -52, 3, 46).fill(color(theme, 'wind.tower'));
      const hub = { x: 0, y: -52 };
      for (const [dx, dy] of [
        [0, -20],
        [17, 10],
        [-17, 10],
      ] as const) {
        g.moveTo(hub.x, hub.y)
          .lineTo(hub.x + dx, hub.y + dy)
          .stroke({ width: 3, color: color(theme, 'wind.blade') });
      }
      g.circle(hub.x, hub.y, 3).fill(color(theme, 'wind.hub'));
      break;
    }
    case 'waterPump': {
      const top = box(
        g,
        size,
        0.12,
        14,
        {
          wall: color(theme, 'pump.wall'),
          roof: color(theme, 'pump.roof'),
          window: color(theme, 'pump.window'),
        },
        1,
      );
      const c = lerp(top[0] as Point, top[2] as Point, 0.6);
      g.rect(c.x - 9, c.y - 26, 18, 22).fill(color(theme, 'pump.tank'));
      g.ellipse(c.x, c.y - 26, 9, 4).fill(color(theme, 'pump.tankTop'));
      break;
    }
    case 'well': {
      box(
        g,
        size,
        0.22,
        8,
        {
          wall: color(theme, 'well.wall'),
          roof: color(theme, 'well.roof'),
          window: color(theme, 'well.window'),
        },
        0,
      );
      g.rect(-5, -22, 10, 16).fill(color(theme, 'well.pipe'));
      g.ellipse(0, -22, 5, 2.4).fill(color(theme, 'well.pipeTop'));
      g.ellipse(0, -6, 5, 2.2).fill(color(theme, 'well.base'));
      break;
    }
    case 'policeStation': {
      const top = box(
        g,
        size,
        0.1,
        24,
        {
          wall: color(theme, 'police.wall'),
          roof: color(theme, 'police.roof'),
          window: color(theme, 'police.window'),
        },
        2,
      );
      const c = lerp(top[0] as Point, top[2] as Point, 0.5);
      star(g, c.x, c.y - 4, 7, color(theme, 'police.star'));
      break;
    }
    case 'fireStation': {
      box(
        g,
        size,
        0.1,
        22,
        {
          wall: color(theme, 'fire.wall'),
          roof: color(theme, 'fire.roof'),
          window: color(theme, 'fire.window'),
        },
        2,
      );
      const { b, r } = footprint(size, 0.1);
      for (const t of [0.2, 0.55]) {
        const a = lerp(b, r, t);
        const e = lerp(b, r, t + 0.25);
        poly(g, [a, e, up(e, 12), up(a, 12)], color(theme, 'fire.door'));
      }
      break;
    }
    case 'school': {
      const top = box(
        g,
        size,
        0.1,
        20,
        {
          wall: color(theme, 'school.wall'),
          roof: color(theme, 'school.roof'),
          window: color(theme, 'school.window'),
        },
        2,
      );
      const c = top[0] as Point;
      g.rect(c.x, c.y - 26, 1.5, 26).fill(color(theme, 'school.pole'));
      g.rect(c.x + 1.5, c.y - 26, 12, 7).fill(color(theme, 'school.flag'));
      break;
    }
    case 'hospital': {
      const top = box(
        g,
        size,
        0.1,
        30,
        {
          wall: color(theme, 'hospital.wall'),
          roof: color(theme, 'hospital.roof'),
          window: color(theme, 'hospital.window'),
        },
        3,
      );
      const c = lerp(top[0] as Point, top[2] as Point, 0.5);
      const cross = color(theme, 'hospital.cross');
      g.rect(c.x - 9, c.y - 3, 18, 6).fill(cross);
      g.rect(c.x - 3, c.y - 9, 6, 18).fill(cross);
      break;
    }
    case 'park': {
      const { b, r, t, l } = footprint(size, 0.04);
      poly(g, [t, r, b, l], color(theme, 'park.ground'));
      g.ellipse(-6, -14, 8, 4).fill(color(theme, 'park.pond'));
      tree(g, theme, { x: 9, y: -10 }, 1);
      tree(g, theme, { x: -12, y: -22 }, 0.8);
      tree(g, theme, { x: 4, y: -24 }, 0.7);
      break;
    }
  }
}

function star(g: Graphics, cx: number, cy: number, r: number, fill: number): void {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    points.push(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius * 0.6);
  }
  g.poly(points).fill(fill);
}

function tree(g: Graphics, theme: Theme, base: Point, scale: number): void {
  g.rect(base.x - 1.5 * scale, base.y - 8 * scale, 3 * scale, 8 * scale).fill(
    color(theme, 'tree.trunk'),
  );
  g.circle(base.x, base.y - 13 * scale, 7 * scale).fill(color(theme, 'tree.leafDark'));
  g.circle(base.x - 3 * scale, base.y - 16 * scale, 5 * scale).fill(color(theme, 'tree.leafMid'));
  g.circle(base.x + 2 * scale, base.y - 18 * scale, 4 * scale).fill(color(theme, 'tree.leafLight'));
}

const TREE_SPOTS: Point[] = [
  { x: 0, y: -14 },
  { x: -12, y: -18 },
  { x: 11, y: -19 },
  { x: -2, y: -24 },
  { x: 6, y: -10 },
];

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
  fill: number,
  sideColor?: number,
): Point[] {
  const [t, r, b, l] = groundRect(axis, length, width).map((p) => up(p, z0)) as [
    Point,
    Point,
    Point,
    Point,
  ];
  const side = sideColor ?? fill;
  poly(g, [l, b, up(b, height), up(l, height)], shade(side, 0.75));
  poly(g, [b, r, up(r, height), up(b, height)], shade(side, 0.92));
  const top = [up(t, height), up(r, height), up(b, height), up(l, height)];
  poly(g, top, fill);
  return top;
}

/** Generates and caches procedural textures for one theme. */
export class SpriteFactory {
  private readonly cache = new Map<string, SpriteTexture>();

  constructor(
    private readonly renderer: Renderer,
    private readonly theme: Theme,
  ) {}

  /** `side` turns buildings that face something (the marina faces its water, 0..3). */
  building(b: Pick<BuildingRecord, 'kind' | 'level' | 'variant' | 'abandoned' | 'w'>, side = 0): SpriteTexture {
    const level = Math.max(1, b.level);
    const key = `b:${b.kind}:${level}:${b.variant & 3}:${b.abandoned ? 1 : 0}:${side}`;
    return this.get(key, (g) => {
      if (b.kind === 'residential') drawResidential(g, this.theme, level, b.variant, b.abandoned);
      else if (b.kind === 'commercial') drawCommercial(g, this.theme, level, b.variant, b.abandoned);
      else if (b.kind === 'industrial') drawIndustrial(g, this.theme, level, b.variant, b.abandoned);
      else if (b.kind === 'marina') drawMarina(g, this.theme, side);
      else if (b.kind === 'airport') drawAirport(g, this.theme);
      else drawPlaceable(g, this.theme, b.kind, b.w);
    });
  }

  /** Boat centred on its position; `heading` indexes `HEADINGS`. */
  boat(kind: BoatKind, heading: number, hull: number, moving: boolean): SpriteTexture {
    const c = hull % this.theme.boats.length;
    return this.get(`boat:${kind}:${heading}:${c}:${moving ? 1 : 0}`, (g) =>
      drawBoat(
        g,
        this.theme,
        { x: 0, y: 0 },
        HEADINGS[heading] as Point,
        kind,
        this.theme.boats[c] as number,
        moving,
      ),
    );
  }

  /** Airliner centred on its ground position (lift it by its altitude when placing it). */
  plane(heading: number): SpriteTexture {
    return this.get(`plane:${heading}`, (g) =>
      drawPlane(g, this.theme, { x: 0, y: 0 }, HEADINGS[heading] as Point),
    );
  }

  planeShadow(heading: number): SpriteTexture {
    return this.get(`planeShadow:${heading}`, (g) =>
      drawPlaneShadow(g, this.theme, { x: 0, y: 0 }, HEADINGS[heading] as Point),
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
          this.theme,
          { x: spot.x + ((variant + k) % 3) - 1, y: spot.y + 8 },
          0.75 + ((variant + k) % 3) * 0.1,
        ),
      );
    });
  }

  pole(): SpriteTexture {
    return this.get('pole', (g) => {
      g.rect(-1, -22, 2, 22).fill(color(this.theme, 'pole.post'));
      g.rect(-6, -21, 12, 2).fill(color(this.theme, 'pole.arm'));
    });
  }

  /** Vehicle seen from above, its ground centre at the origin; `axis` is its travel axis. */
  vehicle(kind: VehicleKind, axis: 'x' | 'y', carColor: number, light = false): SpriteTexture {
    const key = `v:${kind}:${axis}:${kind === 'car' ? carColor % this.theme.cars.length : 0}:${light ? 1 : 0}`;
    return this.get(key, (g) => {
      const length = kind === 'car' ? 0.32 : 0.42;
      const width = kind === 'car' ? 0.17 : 0.19;
      groundShadow(g, axis, length + 0.04, width + 0.04);
      if (kind === 'car') {
        const body = this.theme.cars[carColor % this.theme.cars.length] as number;
        groundBox(g, axis, length, width, 0, 3.5, body);
        groundBox(g, axis, length * 0.5, width * 0.86, 3.5, 2.5, shade(body, 1.08), 0x2a3a4a);
      } else if (kind === 'truck') {
        groundBox(g, axis, length, width, 0, 6, color(this.theme, 'vehicle.truckBody'));
      } else {
        const [t, r, b, l] = groundBox(
          g,
          axis,
          length,
          width,
          0,
          5,
          color(this.theme, 'vehicle.fireBody'),
        ) as [Point, Point, Point, Point];
        // Ladder along the travel axis.
        const from = axis === 'x' ? lerp(t, l, 0.5) : lerp(t, r, 0.5);
        const to = axis === 'x' ? lerp(r, b, 0.5) : lerp(l, b, 0.5);
        const a = lerp(from, to, 0.15);
        const e = lerp(from, to, 0.85);
        g.moveTo(a.x, a.y)
          .lineTo(e.x, e.y)
          .stroke({ width: 1.2, color: color(this.theme, 'vehicle.fireLadder') });
        groundBox(
          g,
          axis,
          0.06,
          width * 0.8,
          5,
          1.6,
          color(this.theme, light ? 'vehicle.fireLightOn' : 'vehicle.fireLightOff'),
          color(this.theme, light ? 'vehicle.fireLightGlow' : 'vehicle.fireLightDark'),
        );
      }
    });
  }

  smokePuff(): SpriteTexture {
    return this.get('smoke', (g) => {
      g.circle(0, 0, 9).fill({ color: color(this.theme, 'fx.smokeDark'), alpha: 0.7 });
      g.circle(-2.5, -2.5, 6).fill({ color: color(this.theme, 'fx.smokeLight'), alpha: 0.65 });
    });
  }

  /** Short glint on water, aligned with the isometric grid. */
  sparkle(): SpriteTexture {
    return this.get('sparkle', (g) => {
      g.poly([-5, 0, 0, -1.3, 5, 0, 0, 1.3]).fill({
        color: color(this.theme, 'fx.sparkle'),
        alpha: 0.95,
      });
    });
  }

  flame(frame: number): SpriteTexture {
    return this.get(`fire:${frame % 2}`, (g) => {
      const s = frame % 2 === 0 ? 1 : 1.15;
      g.poly([-12 * s, -4, -4, -34 * s, 2, -12, 8, -40 * s, 14 * s, -4]).fill({
        color: color(this.theme, 'fx.flameOuter'),
        alpha: 0.9,
      });
      g.poly([-7 * s, -4, -1, -24 * s, 4, -10, 7, -26 * s, 9 * s, -4]).fill({
        color: color(this.theme, 'fx.flameInner'),
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
