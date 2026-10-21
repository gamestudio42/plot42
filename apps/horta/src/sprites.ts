import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';

export interface SpriteTexture {
  texture: Texture;
  anchorX: number;
  anchorY: number;
}

export type PlantFamily = 'tree' | 'palm' | 'araucaria';

export interface PlantLook {
  family: PlantFamily;
  palette: number;
  flowering: boolean;
}

interface Palette {
  leaf: number;
  light: number;
  dark: number;
  trunk: number;
  flower: number;
  /** Ipê / mulungu: flowers on bare limbs. */
  deciduous?: boolean;
}

function shade(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

/** Deterministic 0..1 hash for visual variation (renderer only). */
export function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const DIRT = [0x6b5a3e, 0x7a6848, 0x5c4c34] as const;

/** Refloreste-facing tree colours: jequitibá, pequi, ipê, manacá, mulungu, barbatimão. */
const TREE_PALETTES: readonly Palette[] = [
  { leaf: 0x4a9e4a, light: 0x6bb85a, dark: 0x2f6b34, trunk: 0x6a4a2a, flower: 0xf2f0e6 },
  { leaf: 0x7cb342, light: 0xa5d66a, dark: 0x4a7a28, trunk: 0x7a5530, flower: 0xf5f2e0 },
  {
    leaf: 0x5a9c48,
    light: 0x7ec05a,
    dark: 0x3d6b30,
    trunk: 0x6a4a2a,
    flower: 0xf6e27a,
    deciduous: true,
  },
  { leaf: 0x4a8f4a, light: 0x6aad62, dark: 0x2f5c32, trunk: 0x5a4030, flower: 0xe8a0d0 },
  {
    leaf: 0x3d8a40,
    light: 0x5aa84e,
    dark: 0x2a5a2c,
    trunk: 0x6a4a2a,
    flower: 0xe85a3a,
    deciduous: true,
  },
  { leaf: 0x3d6b38, light: 0x5a8a48, dark: 0x2a4a24, trunk: 0x4a3424, flower: 0xf0ead8 },
];

/** Açaí, buriti, juçara. */
const PALM_PALETTES: readonly Palette[] = [
  { leaf: 0x4a9c4a, light: 0x6bb85a, dark: 0x2d6b34, trunk: 0x7a6840, flower: 0x2d6b38 },
  { leaf: 0x6a8a38, light: 0x8aaa48, dark: 0x4a5a20, trunk: 0x8a7048, flower: 0xc45a3a },
  { leaf: 0x3d7a40, light: 0x5a9a50, dark: 0x285430, trunk: 0x6a5a38, flower: 0x4a8a40 },
];

const ARAUCARIA: Palette = {
  leaf: 0x1e3d28,
  light: 0x2a5640,
  dark: 0x14281c,
  trunk: 0x3a2e22,
  flower: 0x2a4a32,
};

function palettesFor(family: PlantFamily): readonly Palette[] {
  if (family === 'palm') return PALM_PALETTES;
  if (family === 'araucaria') return [ARAUCARIA];
  return TREE_PALETTES;
}

/** Species family and bloom stay fixed per tile so a sprout grows into the same tree. */
export function plantLook(x: number, y: number): PlantLook {
  const roll = tileHash(x, y);
  const family: PlantFamily = roll < 0.58 ? 'tree' : roll < 0.82 ? 'palm' : 'araucaria';
  const set = palettesFor(family);
  const palette = Math.floor(tileHash(x + 17, y + 31) * set.length) % set.length;
  const flowering = tileHash(x + 3, y + 9) > 0.55;
  return { family, palette, flowering };
}

function lookPalette(look: PlantLook): Palette {
  const set = palettesFor(look.family);
  return set[look.palette] ?? set[0] ?? ARAUCARIA;
}

function trunk(g: Graphics, height: number, width: number, color: number): void {
  const half = width / 2;
  g.poly([-half - 0.6, 2, half + 0.2, 2, half, -height, -half - 0.4, -height]).fill({
    color: shade(color, 0.78),
  });
  g.poly([-half * 0.2, 2, half + 0.6, 2, half + 0.4, -height, -half * 0.15, -height]).fill({
    color,
  });
}

function blob(g: Graphics, x: number, y: number, r: number, color: number): void {
  g.ellipse(x, y, r, r * 0.72).fill({ color });
}

function seedlingTree(g: Graphics, p: Palette): void {
  trunk(g, 18, 2.4, p.trunk);
  blob(g, -5, -20, 7.5, p.dark);
  blob(g, 5, -22, 6.5, p.light);
  blob(g, 0, -18, 5.2, p.leaf);
}

function seedlingPalm(g: Graphics, p: Palette): void {
  trunk(g, 20, 2.2, p.trunk);
  g.poly([0, -36, 12, -25, 0, -16, -12, -25]).fill({ color: p.leaf });
  g.poly([0, -36, 6, -25, 0, -18]).fill({ color: p.light });
}

function seedlingAraucaria(g: Graphics, p: Palette): void {
  trunk(g, 16, 2.4, p.trunk);
  const green = shade(p.light, 1.35);
  g.poly([-9, -16, 0, -20, 9, -16, 0, -13]).fill({ color: green });
  g.poly([-6, -20, 0, -25, 6, -20, 0, -18]).fill({ color: p.light });
}

function adultTree(g: Graphics, p: Palette, flowering: boolean): void {
  g.ellipse(0, 4, 13, 5).fill({ color: 0x1a1810, alpha: 0.22 });
  trunk(g, 22, 5, p.trunk);
  if (flowering && p.deciduous) {
    g.poly([-12, -18, -2, -26, 2, -16]).stroke({ width: 1.8, color: shade(p.trunk, 0.7) });
    g.poly([4, -17, 13, -28, 7, -15]).stroke({ width: 1.8, color: shade(p.trunk, 0.7) });
    g.poly([-2, -22, 2, -32, 5, -20]).stroke({ width: 1.6, color: shade(p.trunk, 0.75) });
    for (const [x, y] of [
      [-12, -20],
      [-3, -28],
      [5, -32],
      [13, -26],
      [1, -18],
      [8, -17],
    ] as const) {
      blob(g, x, y, 3.8, p.flower);
      blob(g, x + 1.6, y - 1.4, 2.4, shade(p.flower, 1.08));
    }
    return;
  }
  blob(g, -10, -24, 12, p.dark);
  blob(g, 10, -22, 11, shade(p.leaf, 0.88));
  blob(g, 0, -32, 13, p.leaf);
  blob(g, -4, -36, 8.5, p.light);
  blob(g, 7, -34, 7.5, shade(p.light, 1.05));
  if (flowering) {
    for (const [x, y] of [
      [-8, -26],
      [2, -36],
      [11, -24],
      [-2, -20],
      [6, -32],
    ] as const) {
      g.circle(x, y, 2.2).fill({ color: p.flower });
    }
  }
}

function adultPalm(g: Graphics, p: Palette, flowering: boolean): void {
  g.ellipse(0, 4, 8, 3.4).fill({ color: 0x1a1810, alpha: 0.2 });
  trunk(g, 40, 3.6, p.trunk);
  const crown = -40;
  g.ellipse(0, crown, 4, 2.6).fill({ color: flowering ? p.flower : shade(p.trunk, 0.85) });
  const fronds = [
    { a: -2.55, len: 26 },
    { a: -1.95, len: 24 },
    { a: -1.25, len: 22 },
    { a: -0.45, len: 20 },
    { a: 0.35, len: 21 },
    { a: 1.15, len: 24 },
    { a: 1.9, len: 26 },
    { a: 2.55, len: 18 },
  ];
  for (const [i, frond] of fronds.entries()) {
    const tipX = Math.cos(frond.a) * frond.len;
    const tipY = crown + Math.sin(frond.a) * frond.len * 0.55;
    const px = Math.cos(frond.a + 1.57) * 4.2;
    const py = Math.sin(frond.a + 1.57) * 2.2;
    g.poly([0, crown, tipX + px, tipY + py, tipX, tipY, tipX - px, tipY - py]).fill({
      color: i % 2 === 0 ? p.leaf : p.light,
    });
  }
}

function adultAraucaria(g: Graphics, p: Palette): void {
  g.ellipse(0, 4, 12, 4).fill({ color: 0x1a1810, alpha: 0.2 });
  trunk(g, 26, 4.2, p.trunk);
  const layers = [
    { y: -18, w: 20, h: 6 },
    { y: -28, w: 16, h: 5.2 },
    { y: -37, w: 12, h: 4.4 },
    { y: -45, w: 7.5, h: 3.6 },
  ];
  for (const [i, layer] of layers.entries()) {
    g.poly([
      -layer.w,
      layer.y,
      0,
      layer.y - layer.h,
      layer.w,
      layer.y,
      0,
      layer.y + layer.h * 0.45,
    ]).fill({ color: i % 2 === 0 ? p.leaf : p.light });
  }
  g.poly([-2.4, -48, 0, -56, 2.4, -48]).fill({ color: p.dark });
}

export class HortaSprites {
  private readonly cache = new Map<string, SpriteTexture>();

  constructor(private readonly renderer: Renderer) {}

  sprite(ripe: boolean, x: number, y: number): Sprite {
    const look = plantLook(x, y);
    const entry = this.entry(ripe, look);
    const sprite = new Sprite(entry.texture);
    sprite.anchor.set(entry.anchorX, entry.anchorY);
    return sprite;
  }

  private entry(ripe: boolean, look: PlantLook): SpriteTexture {
    const bloom = ripe && look.flowering ? 1 : 0;
    const key = `${ripe ? 'ripe' : 'seed'}:${look.family}:${look.palette}:${bloom}`;
    return this.get(key, (g) => {
      const p = lookPalette(look);
      if (!ripe) {
        if (look.family === 'palm') seedlingPalm(g, p);
        else if (look.family === 'araucaria') seedlingAraucaria(g, p);
        else seedlingTree(g, p);
        return;
      }
      if (look.family === 'palm') adultPalm(g, p, look.flowering);
      else if (look.family === 'araucaria') adultAraucaria(g, p);
      else adultTree(g, p, look.flowering);
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
