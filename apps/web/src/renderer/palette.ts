export const TERRAIN_COLORS = [0x3b78b8, 0xdcc78f, 0x74ad52, 0x9d8a5a, 0x8f8e86] as const;
export const SKIRT_COLOR = 0x5b4632;
export const WATER_EDGE = 0x5c95cf;

export const ZONE_COLORS = [0x000000, 0x3fbf4f, 0x3f7fdf, 0xe0b030] as const;

export const ROAD_COLOR = 0x4a4d52;
export const ROAD_EDGE = 0x6c6f74;
export const ROAD_MARK = 0xe8d870;
export const BRIDGE_COLOR = 0x7a6a58;
export const RUBBLE_COLOR = 0x7b6f63;
export const PIPE_COLOR = 0x2fa3ff;
export const WIRE_COLOR = 0x2b2420;
export const FLOOD_COLOR = 0x4f8fd8;

export function shade(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 0xff) * (1 - t) + ((b >> 16) & 0xff) * t;
  const g = ((a >> 8) & 0xff) * (1 - t) + ((b >> 8) & 0xff) * t;
  const bl = (a & 0xff) * (1 - t) + (b & 0xff) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Small deterministic per-tile hash for visual variation. */
export function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Gradient used by thematic overlays: low = green, mid = yellow, high = red. */
export function heatColor(t: number): number {
  const v = Math.max(0, Math.min(1, t));
  if (v < 0.5) return mix(0x2fbf4f, 0xf0d040, v * 2);
  return mix(0xf0d040, 0xe0402f, (v - 0.5) * 2);
}

/** Gradient for "good" values (coverage, land value): low = red, high = blue/green. */
export function goodColor(t: number): number {
  const v = Math.max(0, Math.min(1, t));
  if (v < 0.5) return mix(0xd04030, 0xe8d050, v * 2);
  return mix(0xe8d050, 0x30b0e0, (v - 0.5) * 2);
}
