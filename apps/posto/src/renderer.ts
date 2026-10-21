import type { Unit } from '@posto/sim';
import { prefersReducedMotion } from '@shell/chrome';
import {
  Camera,
  ChunkGrid,
  HEIGHT_STEP,
  intersects,
  isoChunkBounds,
  isTyping,
  pickTile,
  tileCenter,
  tileQuad,
  vertexToScreen,
  type ChunkRecord,
  type HeightSource,
  type Point,
} from '@shell/view-iso';
import { Application, Container, Graphics } from 'pixi.js';
import { FLOOR, PostoSprites, tileHash } from './sprites';

const ATTRACT_PERIOD_S = 70;
const ATTRACT_RADIUS = 0.22;
const ATTRACT_ZOOM = 1.05;
const ATTRACT_START = 0.12;

class FlatHeights implements HeightSource {
  constructor(readonly size: number) {}
  corners(): [number, number, number, number] {
    return [0, 0, 0, 0];
  }
}

interface PostoChunk extends ChunkRecord {
  root: Container;
  ground: Graphics;
}

export class PostoRenderer {
  readonly app = new Application();
  readonly camera = new Camera();
  private readonly root = new Container();
  private readonly chunkLayer = new Container();
  private readonly unitsLayer = new Container();
  private readonly overlay = new Graphics();
  private readonly highlight = new Graphics();
  private readonly chunkGrid = new ChunkGrid<PostoChunk>();
  private heights: FlatHeights | null = null;
  private units: Unit[] = [];
  private sprites: PostoSprites | null = null;
  private selectedId: number | null = null;
  private hover: Point | null = null;
  private onTile: ((x: number, y: number) => void) | null = null;
  private initialized = false;
  private destroyed = false;
  private inputEnabled = true;
  private attract: { time: number; still: boolean } | null = null;
  private readonly keys = new Set<string>();
  private readonly listeners = new AbortController();
  private panning: { x: number; y: number } | null = null;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: 0x1c1812,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.classList.add('game-canvas');
    this.root.addChild(this.chunkLayer, this.unitsLayer, this.overlay, this.highlight);
    this.app.stage.addChild(this.root);
    this.sprites = new PostoSprites(this.app.renderer);
    this.attachInput(this.app.canvas);
    this.app.ticker.add(() => this.frame());
    this.initialized = true;
    if (this.heights) this.setWorld(this.heights.size, this.units);
  }

  setOnTile(handler: (x: number, y: number) => void): void {
    this.onTile = handler;
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
  }

  setAttract(on: boolean): void {
    if (on === (this.attract !== null)) return;
    if (on) {
      this.attract = { time: 0, still: prefersReducedMotion() };
      this.keys.clear();
      this.panning = null;
      this.hover = null;
    } else {
      this.attract = null;
      this.camera.zoom = 1;
    }
  }

  setSelected(id: number | null): void {
    this.selectedId = id;
  }

  setWorld(size: number, units: Unit[]): void {
    this.heights = new FlatHeights(size);
    this.units = units;
    if (!this.initialized) return;
    for (const chunk of this.chunkGrid.chunks) chunk.root.destroy({ children: true });
    this.chunkLayer.removeChildren();
    const order = this.chunkGrid.rebuild(size, (area) => {
      const ground = new Graphics();
      const root = new Container();
      root.addChild(ground);
      return {
        area,
        root,
        ground,
        bounds: isoChunkBounds(area, 0),
        dirty: true,
        overlayDirty: false,
      };
    });
    for (const chunk of order) this.chunkLayer.addChild(chunk.root);
    const left = vertexToScreen(0, size, 0);
    const right = vertexToScreen(size, 0, 0);
    const bottom = vertexToScreen(size, size, 0);
    this.camera.bounds = { minX: left.x, maxX: right.x, minY: -HEIGHT_STEP * 4, maxY: bottom.y };
    this.camera.viewWidth = this.app.screen.width;
    this.camera.viewHeight = this.app.screen.height;
    const centre = tileCenter(this.heights, Math.floor(size / 2), Math.floor(size / 2));
    this.camera.centerOn(centre.x, centre.y);
    this.rebuildUnits();
  }

  setUnits(units: Unit[]): void {
    this.units = units;
    this.rebuildUnits();
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.abort();
    if (this.initialized) this.app.destroy(true, { children: true });
  }

  private rebuildUnits(): void {
    const heights = this.heights;
    const atlas = this.sprites;
    if (!heights || !atlas) return;
    this.unitsLayer.removeChildren();
    const living = this.units.filter((unit) => unit.hp > 0).slice();
    living.sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const unit of living) {
      const sprite = atlas.sprite(unit.side);
      const centre = tileCenter(heights, unit.x, unit.y);
      sprite.position.set(centre.x, centre.y);
      this.unitsLayer.addChild(sprite);
    }
  }

  private pick(clientX: number, clientY: number): Point | null {
    if (!this.heights) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    const p = this.camera.screenToWorld(clientX - rect.left, clientY - rect.top);
    return pickTile(this.heights, p.x, p.y, 0);
  }

  private frame(): void {
    if (!this.heights) return;
    this.camera.viewWidth = this.app.screen.width;
    this.camera.viewHeight = this.app.screen.height;
    if (this.attract) this.driftCamera(this.attract);
    else this.applyKeyboardPan();
    this.camera.apply(this.root, this.attract === null);
    const view = this.camera.visibleRect();
    for (const chunk of this.chunkGrid.chunks) {
      const visible = intersects(view, chunk.bounds);
      chunk.root.visible = visible;
      if (visible && chunk.dirty) this.redraw(chunk);
    }
    this.drawOverlay();
    this.drawHover();
  }

  private driftCamera(attract: { time: number; still: boolean }): void {
    if (!this.heights) return;
    if (!attract.still) attract.time += this.app.ticker.deltaMS / 1000;
    const angle = (ATTRACT_START + attract.time / ATTRACT_PERIOD_S) * Math.PI * 2;
    const half = this.heights.size / 2;
    const radius = this.heights.size * ATTRACT_RADIUS;
    const focus = vertexToScreen(
      half + radius * Math.cos(angle),
      half + radius * Math.sin(angle),
      0,
    );
    this.camera.zoom = ATTRACT_ZOOM;
    const shift = this.camera.viewWidth > 900 ? (this.camera.viewWidth * 0.17) / ATTRACT_ZOOM : 0;
    this.camera.centerOn(focus.x - shift, focus.y);
  }

  private redraw(chunk: PostoChunk): void {
    const heights = this.heights;
    if (!heights) return;
    chunk.ground.clear();
    for (let y = chunk.area.y0; y < chunk.area.y1; y++) {
      for (let x = chunk.area.x0; x < chunk.area.x1; x++) {
        const checker = (x + y) % 2;
        const base = FLOOR[checker + (tileHash(x, y) > 0.5 ? 2 : 0)] ?? FLOOR[0];
        const q = tileQuad(heights, x, y).flatMap((p) => [p.x, p.y]);
        chunk.ground.poly(q).fill({ color: base, alpha: 0.96 });
        chunk.ground.poly(q).stroke({ width: 1, color: 0x2a241c, alpha: 0.35 });
      }
    }
    chunk.dirty = false;
  }

  private drawOverlay(): void {
    this.overlay.clear();
    if (!this.heights) return;
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      const centre = tileCenter(this.heights, unit.x, unit.y);
      if (this.selectedId === unit.id) {
        this.overlay.circle(centre.x, centre.y - 18, 16).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
      }
      const barY = centre.y - 36;
      this.overlay.rect(centre.x - 11, barY, 22, 5).fill({ color: 0x1a1410, alpha: 0.72 });
      for (let i = 0; i < unit.hp; i++) {
        this.overlay.rect(centre.x - 10 + i * 11, barY + 1, 9, 3).fill({
          color: unit.side === 'player' ? 0x4ade80 : 0xf87171,
        });
      }
    }
  }

  private drawHover(): void {
    this.highlight.clear();
    if (this.attract || !this.hover || !this.heights) return;
    const q = tileQuad(this.heights, this.hover.x, this.hover.y).flatMap((p) => [p.x, p.y]);
    this.highlight.poly(q).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
  }

  private attachInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic or already-released pointer */
      }
      if (e.button === 1 || e.button === 2) {
        this.panning = { x: e.clientX, y: e.clientY };
        return;
      }
      if (e.button === 0 && this.inputEnabled && !this.attract) {
        const tile = this.pick(e.clientX, e.clientY);
        if (tile) this.onTile?.(tile.x, tile.y);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.panning) {
        this.camera.pan(e.clientX - this.panning.x, e.clientY - this.panning.y);
        this.panning = { x: e.clientX, y: e.clientY };
        return;
      }
      this.hover = this.attract ? null : this.pick(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', () => {
      this.panning = null;
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.attract) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        this.camera.zoomAt(
          e.deltaY < 0 ? 1.15 : 1 / 1.15,
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
      },
      { passive: false },
    );
    const signal = this.listeners.signal;
    window.addEventListener(
      'keydown',
      (e) => {
        if (isTyping(e) || e.ctrlKey || e.metaKey) return;
        this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      },
      { signal },
    );
    window.addEventListener(
      'keyup',
      (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key),
      { signal },
    );
  }

  private applyKeyboardPan(): void {
    if (this.keys.size === 0) return;
    const speed = (this.app.ticker.deltaMS / 1000) * 700;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) dy += speed;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) dy -= speed;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) dx += speed;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) dx -= speed;
    if (dx !== 0 || dy !== 0) this.camera.pan(dx, dy);
  }
}
