import {
  Infra,
  Terrain,
  ZoneDensity,
  type BuildingRecord,
  type InfluenceLayer,
} from '@city/shared';
import { Connection, connectionMask, type World } from '@city/simulation';
import { Container, Sprite, type Graphics } from 'pixi.js';
import { HEIGHT_STEP, tileLocalToScreen, tileQuad, vertexToScreen, type Point } from './iso';
import {
  BRIDGE_COLOR,
  FLOOD_COLOR,
  PIPE_COLOR,
  ROAD_COLOR,
  ROAD_EDGE,
  ROAD_MARK,
  RUBBLE_COLOR,
  SKIRT_COLOR,
  TERRAIN_COLORS,
  WATER_EDGE,
  WIRE_COLOR,
  ZONE_COLORS,
  goodColor,
  heatColor,
  shade,
  tileHash,
} from './palette';
import { BOAT_COLORS, HEADINGS, drawBoat } from './hubSprites';
import type { SpriteFactory } from './sprites';

export type OverlayMode =
  | 'none'
  | 'pollution'
  | 'crime'
  | 'landValue'
  | 'traffic'
  | 'power'
  | 'water'
  | 'police'
  | 'fireCover'
  | 'health'
  | 'education'
  | 'access';

export interface DrawContext {
  world: World;
  buildings: Map<number, BuildingRecord>;
  underground: boolean;
  grid: boolean;
  overlay: OverlayMode;
  animationFrame: number;
}

export interface ChunkArea {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const LOT_COLORS = [0, 0x92c46e, 0xbdbdb5, 0xa49c8a] as const;

/** Iterates tiles of the area back to front (by x + y). */
function forEachTile(area: ChunkArea, fn: (x: number, y: number) => void): void {
  const w = area.x1 - area.x0;
  const h = area.y1 - area.y0;
  for (let d = 0; d < w + h - 1; d++) {
    for (let lx = Math.max(0, d - h + 1); lx <= Math.min(d, w - 1); lx++) {
      fn(area.x0 + lx, area.y0 + d - lx);
    }
  }
}

function fillQuad(g: Graphics, q: Point[], color: number, alpha = 1): void {
  g.poly(q.flatMap((p) => [p.x, p.y])).fill({ color, alpha });
}

function rect(
  q: [Point, Point, Point, Point],
  u0: number,
  v0: number,
  u1: number,
  v1: number,
): Point[] {
  return [
    tileLocalToScreen(q, u0, v0),
    tileLocalToScreen(q, u1, v0),
    tileLocalToScreen(q, u1, v1),
    tileLocalToScreen(q, u0, v1),
  ];
}

export function drawGround(g: Graphics, ctx: DrawContext, area: ChunkArea): void {
  const { world } = ctx;
  const size = world.size;
  const infraLayer = world.infra;
  forEachTile(area, (x, y) => {
    const i = y * size + x;
    const q = tileQuad(world, x, y);
    const [n, e, s, w] = world.corners(x, y);
    const terrain = world.terrain[i] as number;
    const infra = infraLayer[i] as number;
    const jitter = 0.975 + tileHash(x, y) * 0.05;
    const light = 1 + 0.16 * (e - w) + 0.1 * (s - n) + 0.025 * Math.min(n, e, s, w);
    let color = shade(TERRAIN_COLORS[terrain] ?? 0x777777, jitter * light);
    if (ctx.underground) color = shade(0x6a5a48, 0.75 + 0.1 * light);

    // Map edge skirts.
    if (y === size - 1) skirt(g, q[3], q[2], w, s);
    if (x === size - 1) skirt(g, q[2], q[1], s, e);

    fillQuad(g, q, color);
    if (terrain === Terrain.Water && !ctx.underground) {
      g.poly(q.flatMap((p) => [p.x, p.y])).stroke({ width: 1, color: WATER_EDGE, alpha: 0.25 });
      drawMarinaPiers(g, ctx, x, y, q);
    }

    if (ctx.underground) {
      if (infra & Infra.Pipe) drawPipe(g, ctx, x, y, q);
      if (infra & Infra.Road) fillQuad(g, rect(q, 0.35, 0.35, 0.65, 0.65), 0x3a3a3a, 0.5);
      if (ctx.grid) outline(g, q, 0.08);
      return;
    }

    const zone = world.zone[i] as number;
    const id = world.buildingId[i] as number;
    if (zone !== 0) {
      if (id !== 0) {
        fillQuad(g, rect(q, 0.04, 0.04, 0.96, 0.96), LOT_COLORS[zone] ?? 0x999999);
      } else {
        const zc = ZONE_COLORS[zone] ?? 0xffffff;
        fillQuad(g, rect(q, 0.1, 0.1, 0.9, 0.9), zc, 0.32);
        const border = rect(q, 0.1, 0.1, 0.9, 0.9);
        g.poly(border.flatMap((p) => [p.x, p.y])).stroke({ width: 1.5, color: zc, alpha: 0.9 });
        if (world.zoneDensity[i] === ZoneDensity.Dense) {
          const inner = rect(q, 0.25, 0.25, 0.75, 0.75);
          g.poly(inner.flatMap((p) => [p.x, p.y])).stroke({ width: 1.5, color: zc, alpha: 0.9 });
        }
      }
    } else if (id !== 0) {
      const b = ctx.buildings.get(id);
      if (b && b.kind !== 'park') fillQuad(g, rect(q, 0.02, 0.02, 0.98, 0.98), 0xa8a8a0);
    }

    if (infra & Infra.Rubble) {
      fillQuad(g, rect(q, 0.1, 0.1, 0.9, 0.9), RUBBLE_COLOR);
      for (let k = 0; k < 5; k++) {
        const p = tileLocalToScreen(
          q,
          0.2 + tileHash(x + k, y) * 0.6,
          0.2 + tileHash(x, y + k) * 0.6,
        );
        g.circle(p.x, p.y, 2).fill(shade(RUBBLE_COLOR, 0.7));
      }
    }

    if ((world.flood[i] as number) > 0) fillQuad(g, q, FLOOD_COLOR, 0.6);
    if (ctx.grid) outline(g, q, 0.08);
  });
}

/**
 * Roads and bridge decks, drawn above boats so a boat sailing a water tile slips under the
 * span instead of painting over it. Cars stay in the vehicles layer, above this one.
 */
export function drawRoads(g: Graphics, ctx: DrawContext, area: ChunkArea): void {
  if (ctx.underground) return;
  const { world } = ctx;
  const size = world.size;
  const infraLayer = world.infra;
  forEachTile(area, (x, y) => {
    const i = y * size + x;
    if (!((infraLayer[i] as number) & Infra.Road)) return;
    drawRoad(g, ctx, x, y, tileQuad(world, x, y), world.terrain[i] === Terrain.Water);
  });
}

function marinaAt(ctx: DrawContext, x: number, y: number): boolean {
  if (!ctx.world.inBounds(x, y)) return false;
  const id = ctx.world.buildingId[ctx.world.index(x, y)] as number;
  if (id === 0) return false;
  return ctx.buildings.get(id)?.kind === 'marina';
}

/** Side of a building with the most water beside it: 0 = +y, 1 = +x, 2 = -y, 3 = -x. */
export function waterSide(world: World, b: Pick<BuildingRecord, 'x' | 'y' | 'w' | 'h'>): number {
  const count = [0, 0, 0, 0];
  const water = (x: number, y: number) => world.inBounds(x, y) && world.isWater(world.index(x, y));
  for (let k = 0; k < b.w; k++) {
    if (water(b.x + k, b.y + b.h)) count[0]!++;
    if (water(b.x + k, b.y - 1)) count[2]!++;
  }
  for (let k = 0; k < b.h; k++) {
    if (water(b.x + b.w, b.y + k)) count[1]!++;
    if (water(b.x - 1, b.y + k)) count[3]!++;
  }
  let best = 0;
  for (let s = 1; s < 4; s++) if ((count[s] as number) > (count[best] as number)) best = s;
  return best;
}

const PIER_WOOD = 0xb88a55;
const PIER_SIDE = 0x6e5236;
const PIER_LIFT = 2;

/**
 * Jetty on a water tile beside a marina: a walkway out from the quay, two finger piers and
 * boats moored between them (chosen by a stable hash of the tile).
 */
function drawMarinaPiers(
  g: Graphics,
  ctx: DrawContext,
  x: number,
  y: number,
  q: [Point, Point, Point, Point],
): void {
  // Tile-local (u, v) of a point `out` tiles from the quay and `along` it.
  let local: ((along: number, out: number) => [number, number]) | null = null;
  let heading = 0;
  if (marinaAt(ctx, x, y - 1)) {
    local = (a, o) => [a, o];
    heading = 0;
  } else if (marinaAt(ctx, x - 1, y)) {
    local = (a, o) => [o, a];
    heading = 2;
  } else if (marinaAt(ctx, x, y + 1)) {
    local = (a, o) => [a, 1 - o];
    heading = 0;
  } else if (marinaAt(ctx, x + 1, y)) {
    local = (a, o) => [1 - o, a];
    heading = 2;
  }
  if (!local) return;
  const at = (a: number, o: number, lift = 0) => {
    const [u, v] = (local as (a: number, o: number) => [number, number])(a, o);
    const p = tileLocalToScreen(q, u, v);
    return { x: p.x, y: p.y - lift };
  };
  const deck = (a0: number, o0: number, a1: number, o1: number) => {
    const corners = [at(a0, o0), at(a1, o0), at(a1, o1), at(a0, o1)];
    fillQuad(g, corners, PIER_SIDE);
    fillQuad(
      g,
      corners.map((p) => ({ x: p.x, y: p.y - PIER_LIFT })),
      PIER_WOOD,
    );
  };
  const boatAt = (a: number, o: number, slot: number) => {
    const roll = tileHash(x * 7 + slot, y * 13 + slot);
    if (roll < 0.25) return;
    const kind = roll > 0.62 ? 'sail' : 'motor';
    const color = BOAT_COLORS[Math.floor(roll * 97) % BOAT_COLORS.length] as number;
    drawBoat(g, at(a, o), HEADINGS[heading] as Point, kind, color, false, 0.85);
  };
  boatAt(0.27, 0.26, 0);
  boatAt(0.73, 0.26, 1);
  deck(0.44, 0, 0.56, 0.95);
  deck(0.08, 0.44, 0.92, 0.52);
  boatAt(0.27, 0.7, 2);
  boatAt(0.73, 0.7, 3);
  deck(0.18, 0.88, 0.82, 0.95);
  for (const a of [0.44, 0.56]) {
    const p = at(a, 0.95, PIER_LIFT);
    g.rect(p.x - 0.5, p.y, 1, 3).fill(PIER_SIDE);
  }
}

function outline(g: Graphics, q: Point[], alpha: number): void {
  g.poly(q.flatMap((p) => [p.x, p.y])).stroke({ width: 1, color: 0x000000, alpha });
}

function skirt(g: Graphics, a: Point, b: Point, ha: number, hb: number): void {
  const depth = 2 * HEIGHT_STEP;
  g.poly([
    a.x,
    a.y,
    b.x,
    b.y,
    b.x,
    b.y + depth + hb * HEIGHT_STEP,
    a.x,
    a.y + depth + ha * HEIGHT_STEP,
  ]).fill(SKIRT_COLOR);
}

/** Cosmetic lift of a bridge deck above the water, in pixels. */
const BRIDGE_DECK = HEIGHT_STEP;
const BRIDGE_PIER = 0x3d2e22;
const BRIDGE_RAIL = 0xe4d4b4;
const BRIDGE_SIDE = 0x5a4a3a;

function lift(p: Point, h: number): Point {
  return { x: p.x, y: p.y - h };
}

function liftAll(pts: Point[], h: number): Point[] {
  return pts.map((p) => lift(p, h));
}

function landRoad(world: World, x: number, y: number): boolean {
  if (!world.inBounds(x, y)) return false;
  const i = world.index(x, y);
  return world.hasInfra(i, Infra.Road) && !world.isWater(i);
}

function drawRoad(
  g: Graphics,
  ctx: DrawContext,
  x: number,
  y: number,
  q: [Point, Point, Point, Point],
  bridge: boolean,
): void {
  const mask = connectionMask(ctx.world, x, y, Infra.Road);
  const north = (mask & Connection.North) !== 0;
  const east = (mask & Connection.East) !== 0;
  const south = (mask & Connection.South) !== 0;
  const west = (mask & Connection.West) !== 0;
  const base = bridge ? BRIDGE_COLOR : ROAD_COLOR;
  const lo = bridge ? 0.28 : 0.22;
  const hi = bridge ? 0.72 : 0.78;
  const deck = bridge ? BRIDGE_DECK : 0;
  const any = north || east || south || west;
  const band = (u0: number, v0: number, u1: number, v1: number) =>
    liftAll(rect(q, u0, v0, u1, v1), deck);

  if (bridge) drawBridgeSupports(g, ctx.world, x, y, q, north, east, south, west);

  if (!any) {
    fillQuad(g, band(0.2, 0.2, 0.8, 0.8), base);
    return;
  }
  fillQuad(g, band(lo, lo, hi, hi), base);
  if (north) fillQuad(g, band(lo, 0, hi, lo), base);
  if (south) fillQuad(g, band(lo, hi, hi, 1), base);
  if (west) fillQuad(g, band(0, lo, lo, hi), base);
  if (east) fillQuad(g, band(hi, lo, 1, hi), base);

  const edge = (a: Point, b: Point, color: number, width: number) =>
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color, alpha: 0.9 });
  const side = (u0: number, v0: number, u1: number, v1: number) => {
    const a = lift(tileLocalToScreen(q, u0, v0), deck);
    const b = lift(tileLocalToScreen(q, u1, v1), deck);
    edge(a, b, bridge ? BRIDGE_RAIL : ROAD_EDGE, bridge ? 2 : 1);
  };
  if (!north) side(lo, lo, hi, lo);
  if (!south) side(lo, hi, hi, hi);
  if (!west) side(lo, lo, lo, hi);
  if (!east) side(hi, lo, hi, hi);

  const straightX = (east || west) && !north && !south;
  const straightY = (north || south) && !east && !west;
  if (straightX || straightY) {
    for (const t of [0.2, 0.58]) {
      const a = lift(straightX ? tileLocalToScreen(q, t, 0.5) : tileLocalToScreen(q, 0.5, t), deck);
      const b = lift(
        straightX ? tileLocalToScreen(q, t + 0.2, 0.5) : tileLocalToScreen(q, 0.5, t + 0.2),
        deck,
      );
      edge(a, b, bridge ? 0xd8d0c0 : ROAD_MARK, 1);
    }
  }
}

function drawBridgeSupports(
  g: Graphics,
  world: World,
  x: number,
  y: number,
  q: [Point, Point, Point, Point],
  north: boolean,
  east: boolean,
  south: boolean,
  west: boolean,
): void {
  const lo = 0.28;
  const hi = 0.72;
  const straightX = (east || west) && !north && !south;
  // Posts sit on the front edge of the deck so a flat top does not hide them.
  const spots: Array<[number, number]> = straightX
    ? [
        [0.32, hi],
        [0.68, hi],
      ]
    : [
        [hi, 0.32],
        [hi, 0.68],
      ];
  for (const [u, v] of spots) {
    const top = lift(tileLocalToScreen(q, u, v), BRIDGE_DECK);
    const foot = tileLocalToScreen(q, u, v);
    g.moveTo(top.x, top.y)
      .lineTo(foot.x, foot.y + 4)
      .stroke({ width: 4, color: BRIDGE_PIER, alpha: 1 });
    g.ellipse(foot.x, foot.y + 3, 4, 1.8).fill({ color: 0x2a4a68, alpha: 0.5 });
  }

  const face = (u0: number, v0: number, u1: number, v1: number) => {
    const a = tileLocalToScreen(q, u0, v0);
    const b = tileLocalToScreen(q, u1, v1);
    fillQuad(g, [a, b, lift(b, BRIDGE_DECK), lift(a, BRIDGE_DECK)], BRIDGE_SIDE);
  };
  // South and east faces — the visible sides in isometric order.
  face(lo, hi, hi, hi);
  face(hi, lo, hi, hi);

  const ramp = (u0: number, v0: number, u1: number, v1: number) => {
    const innerU0 = u0 === 0 ? lo : u0 === 1 ? hi : u0;
    const innerV0 = v0 === 0 ? lo : v0 === 1 ? hi : v0;
    const innerU1 = u1 === 0 ? lo : u1 === 1 ? hi : u1;
    const innerV1 = v1 === 0 ? lo : v1 === 1 ? hi : v1;
    fillQuad(
      g,
      [
        tileLocalToScreen(q, u0, v0),
        tileLocalToScreen(q, u1, v1),
        lift(tileLocalToScreen(q, innerU1, innerV1), BRIDGE_DECK),
        lift(tileLocalToScreen(q, innerU0, innerV0), BRIDGE_DECK),
      ],
      shade(BRIDGE_COLOR, 0.85),
    );
  };
  if (north && landRoad(world, x, y - 1)) ramp(lo, 0, hi, 0);
  if (south && landRoad(world, x, y + 1)) ramp(lo, 1, hi, 1);
  if (west && landRoad(world, x - 1, y)) ramp(0, lo, 0, hi);
  if (east && landRoad(world, x + 1, y)) ramp(1, lo, 1, hi);
}

function drawPipe(
  g: Graphics,
  ctx: DrawContext,
  x: number,
  y: number,
  q: [Point, Point, Point, Point],
): void {
  const w = ctx.world;
  const c = tileLocalToScreen(q, 0.5, 0.5);
  const mask = connectionMask(w, x, y, Infra.Pipe);
  const watered = w.watered[w.index(x, y)] === 1;
  const color = watered ? PIPE_COLOR : 0x8090a0;
  const links: Array<[boolean, number, number]> = [
    [(mask & Connection.North) !== 0, 0.5, 0],
    [(mask & Connection.East) !== 0, 1, 0.5],
    [(mask & Connection.South) !== 0, 0.5, 1],
    [(mask & Connection.West) !== 0, 0, 0.5],
  ];
  let any = false;
  for (const [on, u, v] of links) {
    if (!on) continue;
    any = true;
    const p = tileLocalToScreen(q, u, v);
    g.moveTo(c.x, c.y).lineTo(p.x, p.y).stroke({ width: 5, color, alpha: 0.95 });
  }
  g.circle(c.x, c.y, any ? 3 : 4).fill(color);
}

/** Pole top position for a power line tile. */
function poleTop(world: World, x: number, y: number): Point {
  const q = tileQuad(world, x, y);
  const onRoad = world.hasInfra(world.index(x, y), Infra.Road);
  const p = onRoad ? tileLocalToScreen(q, 0.12, 0.12) : tileLocalToScreen(q, 0.5, 0.5);
  return { x: p.x, y: p.y - 20 };
}

export function drawWires(g: Graphics, ctx: DrawContext, area: ChunkArea): void {
  if (ctx.underground) return;
  const w = ctx.world;
  forEachTile(area, (x, y) => {
    if (!w.hasInfra(w.index(x, y), Infra.PowerLine)) return;
    const a = poleTop(w, x, y);
    const powered = w.powered[w.index(x, y)] === 1;
    for (const [nx, ny] of [
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
      [x, y - 1],
    ] as const) {
      if (!w.inBounds(nx, ny) || !w.hasInfra(w.index(nx, ny), Infra.PowerLine)) continue;
      const b = poleTop(w, nx, ny);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 2 };
      g.moveTo(a.x, a.y)
        .quadraticCurveTo((a.x + mid.x) / 2, (a.y + mid.y) / 2 + 1, mid.x, mid.y)
        .stroke({
          width: 1,
          color: powered ? WIRE_COLOR : 0x9a3030,
          alpha: 0.9,
        });
    }
  });
}

/** Rebuilds building, tree, pole and fire sprites of a chunk, depth-sorted. */
export function buildObjects(
  container: Container,
  ctx: DrawContext,
  factory: SpriteFactory,
  area: ChunkArea,
): void {
  for (const child of container.removeChildren()) child.destroy();
  if (ctx.underground) return;
  const w = ctx.world;
  const size = w.size;
  const alpha = ctx.overlay === 'none' ? 1 : 0.45;
  forEachTile(area, (x, y) => {
    const i = y * size + x;
    const id = w.buildingId[i] as number;
    if (id !== 0) {
      const b = ctx.buildings.get(id);
      // Draw a building once, from its front (south) tile.
      if (b && b.x + b.w - 1 === x && b.y + b.h - 1 === y) {
        const tex = factory.building(b, b.kind === 'marina' ? waterSide(w, b) : 0);
        const sprite = new Sprite(tex.texture);
        sprite.anchor.set(tex.anchorX, tex.anchorY);
        const front = vertexToScreen(b.x + b.w, b.y + b.h, w.corners(x, y)[2]);
        sprite.position.set(front.x, front.y);
        sprite.alpha = alpha;
        container.addChild(sprite);
      }
    } else if ((w.trees[i] as number) > 0) {
      const tex = factory.trees(w.trees[i] as number, Math.floor(tileHash(x, y) * 4));
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      const q = tileQuad(w, x, y);
      const c = tileLocalToScreen(q, 0.5, 0.5);
      sprite.position.set(c.x, c.y + 8);
      sprite.alpha = alpha;
      container.addChild(sprite);
    }
    if (w.hasInfra(i, Infra.PowerLine)) {
      const tex = factory.pole();
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      const top = poleTop(w, x, y);
      sprite.position.set(top.x, top.y + 20);
      sprite.alpha = alpha;
      container.addChild(sprite);
    }
    if ((w.fire[i] as number) > 0) {
      const tex = factory.flame(ctx.animationFrame + x + y);
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      const c = tileLocalToScreen(tileQuad(w, x, y), 0.5, 0.5);
      sprite.position.set(c.x, c.y + 8);
      container.addChild(sprite);
    }
  });
}

const OVERLAY_LAYER: Partial<Record<OverlayMode, InfluenceLayer>> = {
  pollution: 'pollution',
  crime: 'crime',
  landValue: 'landValue',
  traffic: 'traffic',
  police: 'police',
  fireCover: 'fireCover',
  health: 'health',
  education: 'education',
  access: 'access',
};

const GOOD_OVERLAYS = new Set<OverlayMode>([
  'landValue',
  'police',
  'fireCover',
  'health',
  'education',
  'access',
]);

export const POWER_ON_COLOR = 0xf8e040;
export const WATER_ON_COLOR = 0x30a0f0;
export const UNSERVED_COLOR = 0xd03030;

/** Overlays where a high value is good (green scale) instead of bad (heat scale). */
export function isGoodOverlay(mode: OverlayMode): boolean {
  return GOOD_OVERLAYS.has(mode);
}

/** Colour of tile `i` in an overlay, or null when the tile is not shaded. */
export function overlayColor(w: World, i: number, mode: OverlayMode): number | null {
  if (mode === 'none') return null;
  if (w.terrain[i] === Terrain.Water && mode !== 'traffic') return null;
  if (mode === 'power' || mode === 'water') {
    const consumer =
      (w.buildingId[i] as number) !== 0 ||
      (w.zone[i] as number) !== 0 ||
      w.hasInfra(i, mode === 'power' ? Infra.PowerLine : Infra.Pipe);
    if (!consumer) return null;
    const served = mode === 'power' ? w.powered[i] === 1 : w.watered[i] === 1;
    return served ? (mode === 'power' ? POWER_ON_COLOR : WATER_ON_COLOR) : UNSERVED_COLOR;
  }
  if (mode === 'traffic') {
    if (!w.hasInfra(i, Infra.Road)) return null;
    return heatColor((w.influence.traffic[i] as number) / 200);
  }
  const layer = OVERLAY_LAYER[mode];
  if (!layer) return null;
  const value = (w.influence[layer][i] as number) / 255;
  if (!GOOD_OVERLAYS.has(mode) && value < 0.03) return null;
  return GOOD_OVERLAYS.has(mode) ? goodColor(value) : heatColor(value);
}

export function drawOverlay(g: Graphics, ctx: DrawContext, area: ChunkArea): void {
  const mode = ctx.overlay;
  if (mode === 'none') return;
  const w = ctx.world;
  const size = w.size;
  const alpha = mode === 'traffic' ? 0.8 : 0.55;
  forEachTile(area, (x, y) => {
    const color = overlayColor(w, y * size + x, mode);
    if (color !== null) fillQuad(g, tileQuad(w, x, y), color, alpha);
  });
}
