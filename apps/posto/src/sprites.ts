import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';

export interface SpriteTexture {
  texture: Texture;
  anchorX: number;
  anchorY: number;
}

function shade(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

export function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const FLOOR = [0x6b5a3e, 0x7a6848, 0x5a5348, 0x6e6250] as const;

function figure(g: Graphics, body: number, trim: number): void {
  g.poly([-10, 6, 0, 12, 0, -4, -10, -10]).fill({ color: shade(body, 0.78) });
  g.poly([10, 6, 0, 12, 0, -4, 10, -10]).fill({ color: shade(body, 0.95) });
  g.poly([-10, -10, 0, -4, 10, -10, 0, -16]).fill({ color: trim });
  g.circle(0, -20, 6).fill({ color: shade(trim, 1.05) });
  g.circle(-2, -21, 1.4).fill({ color: 0x1a1410 });
  g.circle(2, -21, 1.4).fill({ color: 0x1a1410 });
}

export class PostoSprites {
  private readonly cache = new Map<string, SpriteTexture>();

  constructor(private readonly renderer: Renderer) {}

  player(): SpriteTexture {
    return this.get('player', (g) => figure(g, 0x3d8f4a, 0x4ade80));
  }

  enemy(): SpriteTexture {
    return this.get('enemy', (g) => figure(g, 0xa33a3a, 0xf87171));
  }

  sprite(side: 'player' | 'enemy'): Sprite {
    const entry = side === 'player' ? this.player() : this.enemy();
    const sprite = new Sprite(entry.texture);
    sprite.anchor.set(entry.anchorX, entry.anchorY);
    return sprite;
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
