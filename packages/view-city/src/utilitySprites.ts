import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import { Frame, poly } from './isoFrame';

/**
 * Power plants and water infrastructure.
 *
 * The coal plant, gas plant, pump and well were the last placeables still drawn as a box with an
 * appurtenance bolted on. Each now reads as an industrial site: a boiler house with a turbine hail
 * and coal heap, a gas plant with spherical storage, a pump house with an elevated tank on legs and
 * a well head with a hand pump.
 */

/** Coal plant (3×3): boiler house, turbine hall, conveyor and a coal heap under two stacks. */
export function drawCoalPlant(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const wall = color(theme, 'coal.wall');
  const roof = color(theme, 'coal.roof');
  const glass = color(theme, 'coal.window');

  // Coal heap: a low dark mound in the yard, drawn first so the buildings sit on top of it.
  f.quad(g, 0.12, 0.14, 1.02, 0.98, shade(wall, 0.45));
  f.quad(g, 0.24, 0.26, 0.9, 0.86, shade(wall, 0.3));

  // Boiler house at the back with the two stacks.
  f.box(g, [0.14, 0.16, 1.5, 1.1], 0, 24, wall, roof, { color: glass, rows: 2 });
  // Turbine hall: lower, with a long clerestory band along the roof.
  f.box(g, [1.12, 0.16, 1.86, 1.6], 0, 15, shade(wall, 1.05), shade(roof, 1.06), {
    color: glass,
    rows: 1,
  });
  const hallTop = f.p(1.49, 0.86, 15);
  g.rect(hallTop.x - 20, hallTop.y - 3, 40, 3).fill(shade(glass, 0.9));
  // Switchyard in front: a fenced pad with insulators.
  f.quad(g, 0.2, 1.24, 1.0, 1.86, color(theme, 'substation.busbar'));
  for (const u of [0.32, 0.52, 0.72, 0.92]) f.post(g, u, 1.78, 8, shade(roof, 0.8), 1.4);
}

/** Gas plant (2×2): process unit with a pair of spherical tanks and a flare boom. */
export function drawGasPlant(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const wall = color(theme, 'gas.wall');
  const roof = color(theme, 'gas.roof');
  const glass = color(theme, 'gas.window');
  const tank = color(theme, 'gas.tankBody');
  const tankTop = color(theme, 'gas.tankTop');
  const rim = color(theme, 'gas.tankRim');

  f.box(g, [0.12, 0.14, 1.08, 1.2], 0, 18, wall, roof, { color: glass, rows: 2 });
  // Spheres on skirt legs: the silhouette that says "gas", not "warehouse".
  for (const [u, v] of [
    [1.36, 0.52],
    [1.44, 1.24],
  ] as const) {
    const c = f.p(u, v, 12);
    for (const d of [-5, 0, 5]) {
      g.rect(c.x + d - 1, c.y + 4, 2, 12).fill(shade(rim, 0.8));
    }
    g.circle(c.x, c.y, 13).fill(shade(tank, 0.78));
    g.circle(c.x, c.y - 2, 11).fill(tank);
    g.ellipse(c.x - 3, c.y - 7, 5, 3.2).fill(tankTop);
    g.ellipse(c.x, c.y + 6, 13, 3).fill({ color: rim, alpha: 0.5 });
  }
  // Flare boom behind the unit.
  const flare = f.post(g, 1.62, 0.18, 46, shade(roof, 0.75), 2.2);
  g.circle(flare.x, flare.y, 4).fill({ color: color(theme, 'fx.flameOuter'), alpha: 0.5 });
  g.circle(flare.x, flare.y, 1.8).fill(color(theme, 'fx.flameInner'));
}

/** Wind turbine (1×1): a tapered tower with a nacelle and three blades. */
export function drawWindTurbine(g: Graphics, theme: Theme): void {
  const tower = color(theme, 'wind.tower');
  const blade = color(theme, 'wind.blade');
  const hubColor = color(theme, 'wind.hub');
  const foot = color(theme, 'ground.bareLot');

  // Concrete pad.
  g.ellipse(0, 0, 17, 8).fill(foot);
  // Tapered tower, drawn as a trapezoid so it does not read as a lamppost.
  poly(
    g,
    [
      { x: -4.5, y: 0 },
      { x: 4.5, y: 0 },
      { x: 1.8, y: -72 },
      { x: -1.8, y: -72 },
    ],
    tower,
  );
  poly(
    g,
    [
      { x: 0, y: 0 },
      { x: 4.5, y: 0 },
      { x: 1.8, y: -72 },
      { x: 0, y: -72 },
    ],
    shade(tower, 0.82),
  );
  // Nacelle.
  const hub = { x: 0, y: -74 };
  g.roundRect(hub.x - 7, hub.y - 4, 20, 8, 3).fill(shade(tower, 1.08));
  for (const [dx, dy] of [
    [0, -22],
    [19, 11],
    [-19, 11],
  ] as const) {
    poly(
      g,
      [
        { x: hub.x + dx * 0.12, y: hub.y + dy * 0.12 },
        { x: hub.x + dx * 0.34 - dy * 0.045, y: hub.y + dy * 0.34 + dx * 0.045 },
        { x: hub.x + dx, y: hub.y + dy },
        { x: hub.x + dx * 0.34 + dy * 0.045, y: hub.y + dy * 0.34 - dx * 0.045 },
      ],
      blade,
    );
  }
  g.circle(hub.x, hub.y, 3.6).fill(hubColor);
}

/** Water pump (2×2): pumphouse with an elevated tank on a leg frame and a rising main. */
export function drawWaterPump(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const wall = color(theme, 'pump.wall');
  const roof = color(theme, 'pump.roof');
  const glass = color(theme, 'pump.window');
  const tank = color(theme, 'pump.tank');
  const tankTop = color(theme, 'pump.tankTop');
  const pipe = color(theme, 'well.pipe');

  f.box(g, [0.12, 0.14, 1.02, 1.86], 0, 15, wall, roof, { color: glass, rows: 1 });
  // Rising main from the pumphouse to the tank.
  const riser = f.p(1.02, 1.1, 0);
  g.rect(riser.x - 2, riser.y - 30, 4, 30).fill(pipe);
  // Elevated tank: four legs and a cylindrical drum.
  const centre = f.p(1.48, 1.3, 0);
  for (const dx of [-11, -4, 4, 11]) {
    g.rect(centre.x + dx - 1.4, centre.y - 34, 2.8, 34).fill(shade(roof, 0.8));
  }
  g.rect(centre.x - 16, centre.y - 56, 32, 23).fill(tank);
  g.rect(centre.x - 16, centre.y - 49, 32, 3).fill(shade(tank, 1.2));
  g.ellipse(centre.x, centre.y - 56, 16, 6).fill(tankTop);
  g.ellipse(centre.x, centre.y - 33, 16, 6).fill(shade(tank, 0.8));
  // Cross-bracing between the legs.
  g.moveTo(centre.x - 11, centre.y - 18)
    .lineTo(centre.x + 11, centre.y - 30)
    .stroke({ width: 1.6, color: shade(roof, 0.7) });
}

/** Well (1×1): a capped borehole with a hand pump and a spill tray. */
export function drawWell(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const wall = color(theme, 'well.wall');
  const roof = color(theme, 'well.roof');
  const pipe = color(theme, 'well.pipe');
  const pipeTop = color(theme, 'well.pipeTop');
  const base = color(theme, 'well.base');

  f.box(g, [0.24, 0.24, 0.76, 0.76], 0, 7, wall, roof);
  // Casing and well head.
  const head = f.p(0.5, 0.5, 7);
  g.rect(head.x - 4, head.y - 22, 8, 22).fill(pipe);
  g.ellipse(head.x, head.y - 22, 4, 2.2).fill(pipeTop);
  g.rect(head.x - 7, head.y - 15, 14, 3).fill(shade(pipe, 0.82));
  // Hand pump arm and spout.
  g.moveTo(head.x, head.y - 18)
    .lineTo(head.x + 12, head.y - 22)
    .stroke({ width: 2.6, color: base });
  g.rect(head.x + 8, head.y - 20, 5, 3).fill(base);
  g.ellipse(head.x + 10, head.y - 4, 4, 1.8).fill({ color: pipeTop, alpha: 0.6 });
}

/** Dispatches the utility buildings; the caller knows the kind. */
export function drawUtility(g: Graphics, theme: Theme, kind: string, size: number): boolean {
  switch (kind) {
    case 'coalPlant':
      drawCoalPlant(g, theme, size);
      return true;
    case 'gasPlant':
      drawGasPlant(g, theme, size);
      return true;
    case 'windTurbine':
      drawWindTurbine(g, theme);
      return true;
    case 'waterPump':
      drawWaterPump(g, theme, size);
      return true;
    case 'well':
      drawWell(g, theme, size);
      return true;
    default:
      return false;
  }
}
