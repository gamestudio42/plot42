import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import type { Point } from './iso';
import { Frame, poly } from './isoFrame';

/**
 * Civic service buildings: police, fire, school and hospital.
 *
 * All four used to be the same plain box with a different paint job, which read as filler next to
 * the zoned lots. Each one now has the silhouette of what it does — a watch tower, a ready bay, a
 * classroom wing, a ward block — so the service layer is legible at a glance.
 */

/** Police station: a squat precinct with a glazed watch tower and a rooftop light. */
export function drawPoliceStation(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'police.wall');
  const roof = color(theme, 'police.roof');
  const glass = color(theme, 'police.window');
  const star = color(theme, 'police.star');

  f.box(g, [0.12, 0.12, 1.88, 1.88], 0, 20, wall, roof, { color: glass, rows: 2 });
  // Front canopy over the entrance.
  f.quad(g, 0.2, 1.86, 1.1, 1.86, shade(roof, 1.25), 13);
  f.post(g, 0.24, 1.86, 13, shade(wall, 0.85), 2.2);
  f.post(g, 1.06, 1.86, 13, shade(wall, 0.85), 2.2);

  // Watch tower on the rear corner: glass drum, cap and the badge on the wall.
  f.box(g, [1.0, 0.18, 1.8, 0.98], 20, 16, wall, roof, { color: glass, rows: 1 });
  const cap = f.box(g, [0.94, 0.12, 1.86, 1.04], 36, 4, shade(roof, 1.15), roof);
  const c = cap[0] as Point;
  const pole = f.post(g, 1.42, 0.58, 10, color(theme, 'lot.antennaPole'), 1.4, 40);
  const blink = { x: (pole.x + c.x) / 2, y: pole.y };
  g.circle(blink.x, blink.y, 3.4).fill({ color: star, alpha: 0.24 });
  g.circle(blink.x, blink.y, 1.6).fill(star);

  // Badge plate beside the door.
  const face = f.p(0.62, 1.88, 12);
  g.circle(face.x, face.y, 6).fill(shade(star, 0.8));
  g.circle(face.x, face.y, 4.2).fill({ color: star, alpha: 0.9 });
}

/** Fire station: a wide apparatus bay with red doors and a drill tower behind it. */
export function drawFireStation(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'fire.wall');
  const roof = color(theme, 'fire.roof');
  const glass = color(theme, 'fire.window');
  const door = color(theme, 'fire.door');

  f.box(g, [0.1, 0.42, 1.9, 1.88], 0, 16, wall, roof, { color: glass, rows: 1 });
  // Apparatus bays: two tall doors on the front face, each with its lintel lamp.
  const bays = [
    [0.28, 0.86],
    [1.02, 1.6],
  ] as const;
  for (const [u0, u1] of bays) {
    f.quad(g, u0, 1.88, u1, 1.88, door, 10);
    f.quad(g, u0 + 0.04, 1.88, u1 - 0.04, 1.88, shade(door, 0.72), 8);
    const lamp = f.p((u0 + u1) / 2, 1.88, 12.5);
    g.circle(lamp.x, lamp.y, 3.6).fill({ color: glass, alpha: 0.3 });
    g.circle(lamp.x, lamp.y, 1.4).fill(glass);
  }
  // Drill tower, set back so it clears the bay roof.
  f.box(g, [1.24, 0.14, 1.86, 0.72], 16, 26, wall, roof, { color: glass, rows: 3 });
  const beaconBase = f.p(1.55, 0.43, 42);
  g.circle(beaconBase.x, beaconBase.y, 4.2).fill({ color: glass, alpha: 0.26 });
  g.circle(beaconBase.x, beaconBase.y, 1.8).fill(glass);
}

/** School: a classroom wing, a gym with a barrel roof and a flagpole in the yard. */
export function drawSchool(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'school.wall');
  const roof = color(theme, 'school.roof');
  const glass = color(theme, 'school.window');
  const pole = color(theme, 'school.pole');
  const flag = color(theme, 'school.flag');

  f.box(g, [0.12, 0.16, 1.88, 0.92], 0, 18, wall, roof, { color: glass, rows: 3 });
  // Gym: lower block with a light barrel roof and a clerestory band.
  f.box(g, [0.16, 1.0, 1.1, 1.86], 0, 12, shade(wall, 1.06), shade(roof, 1.1), { color: glass, rows: 1 });
  const gymTop = f.box(g, [0.24, 1.08, 1.02, 1.78], 12, 5, shade(roof, 1.2), shade(roof, 1.3));
  poly(
    g,
    [
      f.p(0.24, 1.08, 17),
      f.p(0.63, 1.08, 20),
      f.p(1.02, 1.08, 17),
      f.p(1.02, 1.78, 17),
      f.p(0.63, 1.78, 20),
      f.p(0.24, 1.78, 17),
    ],
    shade(roof, 1.16),
  );
  void gymTop;

  // Yard: paved apron with the flagpole.
  f.quad(g, 1.2, 1.06, 1.86, 1.86, color(theme, 'park.ground'), 0.6);
  const poleTip = f.post(g, 1.5, 1.5, 30, pole, 1.3, 1);
  g.moveTo(poleTip.x, poleTip.y)
    .lineTo(poleTip.x + 13, poleTip.y + 4)
    .lineTo(poleTip.x + 13, poleTip.y + 10)
    .lineTo(poleTip.x, poleTip.y + 6)
    .closePath()
    .fill(flag);
}

/** Hospital: a tall ward block with a helipad and a lit red cross. */
export function drawHospital(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'hospital.wall');
  const roof = color(theme, 'hospital.roof');
  const glass = color(theme, 'hospital.window');
  const cross = color(theme, 'hospital.cross');

  f.box(g, [0.14, 0.2, 1.2, 1.88], 0, 34, wall, roof, { color: glass, rows: 5 });
  // Podium in front, with the ambulance bay.
  f.box(g, [1.16, 0.86, 1.88, 1.86], 0, 12, shade(wall, 0.96), shade(roof, 0.95), { color: glass, rows: 1 });
  f.quad(g, 1.24, 1.86, 1.78, 1.86, shade(roof, 0.6), 9);
  // Helipad marker on the ward roof.
  const pad = f.p(0.67, 1.04, 34);
  g.ellipse(pad.x, pad.y, 13, 6.5).fill(shade(roof, 0.8));
  g.ellipse(pad.x, pad.y, 9, 4.4).fill({ color: glass, alpha: 0.45 });
  // Red cross on the podium roof, readable from the isometric angle.
  const c = f.p(1.52, 1.36, 12);
  g.rect(c.x - 8, c.y - 2.4, 16, 4.8).fill(cross);
  g.rect(c.x - 2.4, c.y - 8, 4.8, 16).fill(cross);
}

/** Dispatches a civic building to its own drawing; the caller knows the kind. */
export function drawCivic(g: Graphics, theme: Theme, kind: string): boolean {
  switch (kind) {
    case 'policeStation':
      drawPoliceStation(g, theme);
      return true;
    case 'fireStation':
      drawFireStation(g, theme);
      return true;
    case 'school':
      drawSchool(g, theme);
      return true;
    case 'hospital':
      drawHospital(g, theme);
      return true;
    default:
      return false;
  }
}
