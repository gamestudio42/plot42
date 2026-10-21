import { shade, mix, type Theme } from '@theme/core';
import { urbe } from '@theme/urbe';

/**
 * Neo Urbe: the cyberpunk art direction.
 *
 * The structure is the Urbe theme — same tokens, same palette counts — so the renderer draws the
 * same shapes. Only the colours change: a cold blue-black base, cyan and magenta signage, amber
 * service lights. Deriving from `urbe` keeps every token that has no cyberpunk equivalent (plane
 * liveries, marina wood) coherent instead of inventing one-off values.
 */

/** Recolour a value towards `target` by `amount` (0..1). */
const towards = (value: number, target: number, amount: number): number =>
  mix(value, target, Math.max(0, Math.min(1, amount)));

/** Cold, saturated neon grade applied to a whole palette. */
const grade = (value: number): number => {
  const cool = towards(value, 0x0a1020, 0.35);
  const lifted = shade(cool, 1.05);
  return mix(lifted, 0x2de2e6, 0.08);
};

const NEON_OVERRIDES: Record<string, number> = {
  // Ground reads as wet asphalt and concrete under sodium light.
  'ground.skirt': 0x0b1220,
  'ground.waterEdge': 0x123a52,
  'ground.outline': 0x04060c,
  'ground.undergroundWater': 0x0d2233,
  'ground.undergroundLand': 0x181a22,
  'ground.bareLot': 0x2a2f3a,

  // Smoke and fire keep their warmth: they are the only natural light in the scene.
  'fx.flameOuter': 0xff6a1f,
  'fx.flameInner': 0xffd24a,

  // Roads: black asphalt, cyan markings, magenta light strips.
  'road.surface': 0x14161d,
  'road.edge': 0x242a36,
  'road.mark': 0x2de2e6,
  'road.bridge': 0x1a1d26,
  'road.bridgePier': 0x0c0e14,
  'road.bridgeRail': 0xff3ea5,
  'road.bridgeSide': 0x22262f,
  'road.bridgeShadow': 0x05070d,
  'road.bridgeMark': 0x9b7bff,

  // Infrastructure glows.
  'infra.pipe': 0x1fd6ff,
  'infra.pipeDry': 0x39414f,
  'infra.wire': 0x0e1018,
  'infra.wireCut': 0xff2d55,
  'infra.rubble': 0x2c2b33,
  'infra.flood': 0x1c6fa8,

  // Overlays stay legible on dark ground.
  'overlay.powerOn': 0xffd21f,
  'overlay.waterOn': 0x2de2e6,
  'overlay.unserved': 0xff2d55,
  'overlay.heatLow': 0x22e6a0,
  'overlay.heatMid': 0xffd21f,
  'overlay.heatHigh': 0xff2d55,
  'overlay.goodLow': 0xff2d55,
  'overlay.goodMid': 0xffd21f,
  'overlay.goodHigh': 0x2de2e6,

  // Selection.
  'highlight.okFill': 0x22e6a0,
  'highlight.okStroke': 0x8affd8,
  'highlight.badFill': 0xff2d55,
  'highlight.badStroke': 0xff9ab4,
  'highlight.neutralFill': 0x8a93a6,
  'highlight.neutralStroke': 0xf2f6ff,
  'highlight.hover': 0xffffff,

  // Trees: the only green left is bioluminescent.
  'tree.trunk': 0x241a26,
  'tree.leafDark': 0x0b3a3a,
  'tree.leafMid': 0x0f6a62,
  'tree.leafLight': 0x22b39a,

  // Vehicles.
  'vehicle.truckBody': 0x3a4150,
  'vehicle.fireBody': 0xff2d55,
  'vehicle.fireLadder': 0xd8dbe4,
  'vehicle.fireLightOn': 0xff2d55,
  'vehicle.fireLightOff': 0x2de2e6,
  'vehicle.fireLightDark': 0x3a1020,
  'vehicle.fireLightGlow': 0xff2d55,

  // Aircraft and airport.
  'plane.body': 0x2a3140,
  'plane.wing': 0x1e2430,
  'plane.engine': 0x161b24,
  'plane.cockpit': 0x2de2e6,
  'plane.accent': 0xff3ea5,
  'airport.asphalt': 0x10131a,
  'airport.taxiway': 0x1c202a,
  'airport.apron': 0x222833,
  'airport.paint': 0x2de2e6,
  'airport.yellow': 0xffd21f,
  'airport.light': 0xffd21f,
  'airport.grass': 0x142a26,
  'airport.terminalWall': 0x242b38,
  'airport.terminalRoof': 0x161b24,
  'airport.terminalWindow': 0x2de2e6,
  'airport.towerGlass': 0x2de2e6,
  'airport.mastLight': 0xff2d55,
  'airport.windsock': 0xff6a1f,

  // Marina wood reads as painted steel.
  'marina.wood': 0x24303c,
  'marina.woodEdge': 0x141a22,
  'marina.pierWood': 0x2a3644,
  'marina.pierSide': 0x141a22,
  'marina.clubRoof': 0x1d3a4a,
  'marina.clubWindow': 0x2de2e6,
  'marina.flagCloth': 0xff3ea5,
  'boat.deck': 0x2a3140,
  'boat.sail': 0x2de2e6,
  'boat.sailShade': 0x1a9fa6,
  'boat.wake': 0x9beef0,
};

const colors: Record<string, number> = {};
for (const [token, value] of Object.entries(urbe.colors)) {
  colors[token] = NEON_OVERRIDES[token] ?? grade(value);
}

/** Cyberpunk take on the lot palettes: dark bodies, neon signage, lit windows. */
const neonLot = (wall: number, roof: number, window: number | undefined, accent: number) => ({
  wall: mix(grade(wall), 0x1b2130, 0.55),
  roof: mix(grade(roof), 0x0c101a, 0.45),
  ...(window === undefined ? {} : { window: mix(window, 0x2de2e6, 0.65) }),
  accent: mix(accent, 0xff3ea5, 0.6),
});

export const neon: Theme = {
  id: 'neon',
  background: 0x05070d,

  terrain: [0x0d3550, 0x1b2230, 0x14332c, 0x2a2a30, 0x202430],
  zone: [0x000000, 0x22e6a0, 0x2de2e6, 0xffd21f],
  lot: [0, 0x0f2a24, 0x14242e, 0x26241c],

  housePalettes: urbe.housePalettes.map((p) => neonLot(p.wall, p.roof, p.window, p.accent)),
  towerPalettes: urbe.towerPalettes.map((p) => neonLot(p.wall, p.roof, p.window, p.accent)),
  commercialPalettes: urbe.commercialPalettes.map((p) =>
    neonLot(p.wall, p.roof, p.window, p.accent),
  ),
  industrialPalettes: urbe.industrialPalettes.map((p) =>
    neonLot(p.wall, p.roof, p.window, p.accent),
  ),
  abandoned: neonLot(
    urbe.abandoned.wall,
    urbe.abandoned.roof,
    urbe.abandoned.window,
    urbe.abandoned.accent,
  ),

  boats: urbe.boats.map((c) => mix(grade(c), 0x2de2e6, 0.3)),
  cars: [0xff2d55, 0x2de2e6, 0xffd21f, 0xf2f6ff, 0x9b7bff, 0x3a4150],

  colors,
};

/** CSS custom properties for the Neo UI shell. */
export const neonCss: Record<string, string> = {
  '--bg': '#05070d',
  '--panel': '#0b1220',
  '--panel-edge': '#1b2a3a',
  '--ink': '#e6f7ff',
  '--ink-dim': '#8ea3b8',
  '--cyan': '#2de2e6',
  '--magenta': '#ff3ea5',
  '--amber': '#ffd21f',
  '--green': '#22e6a0',
  '--danger': '#ff2d55',
  '--violet': '#9b7bff',
};

/** Audio theme hooks: tempo and waveform choices for the synthwave composer. */
export const neonAudio = {
  bpm: 104,
  /** Scale degrees in a natural minor, as semitone offsets from the root. */
  scale: [0, 2, 3, 5, 7, 8, 10, 12],
  /** Detune of the pad voice, in cents. */
  padDetune: 11,
  /** Bass waveform. */
  bassWave: 'sawtooth' as const,
  /** Lead waveform. */
  leadWave: 'square' as const,
} as const;
