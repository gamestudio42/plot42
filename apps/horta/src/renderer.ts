import { PLOT_PLANTED, PLOT_RIPE } from '@horta/sim';
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
import { DIRT, HortaSprites, tileHash } from './sprites';

const ATTRACT_PERIOD_S = 70;
const ATTRACT_RADIUS = 0.2;
const ATTRACT_ZOOM = 0.95;
const ATTRACT_START = 0.18;

class FlatHeights implements HeightSource {
  constructor(readonly size: number) {}
  corners(): [number, number, number, number] {
    return [0, 0, 0, 0];
  }
}

interface HortaChunk extends ChunkRecord {
  root: Container;
  ground: Graphics;
}

export class HortaRenderer {
  readonly app = new Application();
  readonly camera = new Camera();
  private readonly root = new Container();
  private readonly chunkLayer = new Container();
  private readonly plantsLayer = new Container();
  private readonly highlight = new Graphics();
  private readonly chunkGrid = new ChunkGrid<HortaChunk>();
  private heights: FlatHeights | null = null;
  private plots: Uint8Array | null = null;
  private sprites: HortaSprites | null = null;
  private hover: Point | null = null;
  private onPlot: ((x: number, y: number, clear: boolean) => void) | null = null;
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
      background: 0x1a2420,
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
    this.root.addChild(this.chunkLayer, this.plantsLayer, this.highlight);
    this.app.stage.addChild(this.root);
    this.sprites = new HortaSprites(this.app.renderer);
    this.attachInput(this.app.canvas);
    this.app.ticker.add(() => this.frame());
    this.initialized = true;
    if (this.heights && this.plots) this.setWorld(this.heights.size, this.plots);
  }

  setOnPlot(handler: (x: number, y: number, clear: boolean) => void): void {
    this.onPlot = handler;
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

  setWorld(size: number, plots: Uint8Array): void {
    this.heights = new FlatHeights(size);
    this.plots = plots;
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
    this.camera.bounds = { minX: left.x, maxX: right.x, minY: -HEIGHT_STEP, maxY: bottom.y };
    this.camera.viewWidth = this.app.screen.width;
    this.camera.viewHeight = this.app.screen.height;
    const centre = tileCenter(this.heights, Math.floor(size / 2), Math.floor(size / 2));
    this.camera.centerOn(centre.x, centre.y);
    this.rebuildPlants();
  }

  setPlots(plots: Uint8Array): void {
    this.plots = plots;
    for (const chunk of this.chunkGrid.chunks) chunk.dirty = true;
    this.rebuildPlants();
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.abort();
    if (this.initialized) this.app.destroy(true, { children: true });
  }

  private rebuildPlants(): void {
    const heights = this.heights;
    const plots = this.plots;
    const atlas = this.sprites;
    if (!heights || !plots || !atlas) return;
    this.plantsLayer.removeChildren();
    const sprites = [];
    for (let y = 0; y < heights.size; y++) {
      for (let x = 0; x < heights.size; x++) {
        const state = plots[y * heights.size + x];
        if (state !== PLOT_PLANTED && state !== PLOT_RIPE) continue;
        const sprite = atlas.sprite(state === PLOT_RIPE, x, y);
        const centre = tileCenter(heights, x, y);
        sprite.position.set(centre.x, centre.y);
        sprite.zIndex = x + y;
        sprites.push(sprite);
      }
    }
    sprites.sort((a, b) => a.zIndex - b.zIndex);
    for (const sprite of sprites) this.plantsLayer.addChild(sprite);
  }

  private pick(clientX: number, clientY: number): Point | null {
    if (!this.heights) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    const p = this.camera.screenToWorld(clientX - rect.left, clientY - rect.top);
    return pickTile(this.heights, p.x, p.y, 0);
  }

  private frame(): void {
    if (!this.heights || !this.plots) return;
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

  private redraw(chunk: HortaChunk): void {
    const heights = this.heights;
    if (!heights) return;
    chunk.ground.clear();
    for (let y = chunk.area.y0; y < chunk.area.y1; y++) {
      for (let x = chunk.area.x0; x < chunk.area.x1; x++) {
        const dirt = DIRT[Math.floor(tileHash(x, y) * DIRT.length)] ?? DIRT[0];
        const q = tileQuad(heights, x, y).flatMap((p) => [p.x, p.y]);
        chunk.ground.poly(q).fill({ color: dirt, alpha: 0.96 });
        chunk.ground.poly(q).stroke({ width: 1, color: 0x243028, alpha: 0.28 });
      }
    }
    chunk.dirty = false;
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
        if (tile) this.onPlot?.(tile.x, tile.y, e.shiftKey);
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
