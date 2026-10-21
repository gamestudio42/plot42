import {
  computeShade,
  isPlantSpecies,
  MATURE_AGE,
  SPECIES_CROWN,
  SPECIES_FERN,
  SPECIES_GRASS,
  type MataGrid,
  type MataOverlay,
  type SpeciesId,
} from '@mata/sim';
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
import { Application, Container, Graphics, type Sprite } from 'pixi.js';
import { groundColor, lerpColor, MataSprites, tileHash } from './sprites';

const ATTRACT_PERIOD_S = 80;
const ATTRACT_RADIUS = 0.22;
const ATTRACT_ZOOM = 0.92;
const ATTRACT_START = 0.2;

const OVERLAY_RAMP: Record<Exclude<MataOverlay, 'none'>, [number, number]> = {
  moisture: [0x1a3a5c, 0x4aa0e8],
  nutrients: [0x3a2a10, 0xe0b040],
  shade: [0x1a1028, 0x8a6ad0],
  soil: [0x3a2010, 0x6a8a38],
  fauna: [0x201018, 0xe070b0],
};

class FlatHeights implements HeightSource {
  constructor(readonly size: number) {}
  corners(): [number, number, number, number] {
    return [0, 0, 0, 0];
  }
}

interface MataChunk extends ChunkRecord {
  root: Container;
  ground: Graphics;
}

export class MataRenderer {
  readonly app = new Application();
  readonly camera = new Camera();
  private readonly root = new Container();
  private readonly chunkLayer = new Container();
  private readonly stuffLayer = new Container();
  private readonly highlight = new Graphics();
  private readonly chunkGrid = new ChunkGrid<MataChunk>();
  private heights: FlatHeights | null = null;
  private world: MataGrid | null = null;
  private shade: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  private sprites: MataSprites | null = null;
  private hover: Point | null = null;
  private overlay: MataOverlay = 'none';
  private onPlot: ((x: number, y: number, clear: boolean) => void) | null = null;
  private onHover: ((tile: Point | null) => void) | null = null;
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
      background: 0x1c1810,
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
    this.root.addChild(this.chunkLayer, this.stuffLayer, this.highlight);
    this.app.stage.addChild(this.root);
    this.sprites = new MataSprites(this.app.renderer);
    this.attachInput(this.app.canvas);
    this.app.ticker.add(() => this.frame());
    this.initialized = true;
    if (this.world) this.setWorld(this.world);
  }

  setOnPlot(handler: (x: number, y: number, clear: boolean) => void): void {
    this.onPlot = handler;
  }

  setOnHover(handler: (tile: Point | null) => void): void {
    this.onHover = handler;
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
  }

  setOverlay(overlay: MataOverlay): void {
    if (this.overlay === overlay) return;
    this.overlay = overlay;
    for (const chunk of this.chunkGrid.chunks) chunk.dirty = true;
  }

  setAttract(on: boolean): void {
    if (on === (this.attract !== null)) return;
    if (on) {
      this.attract = { time: 0, still: prefersReducedMotion() };
      this.keys.clear();
      this.panning = null;
      this.setHover(null);
    } else {
      this.attract = null;
      this.camera.zoom = 1;
    }
  }

  setWorld(world: MataGrid): void {
    this.world = world;
    this.heights = new FlatHeights(world.size);
    this.shade = computeShade(world);
    if (!this.initialized) return;
    for (const chunk of this.chunkGrid.chunks) chunk.root.destroy({ children: true });
    this.chunkLayer.removeChildren();
    const order = this.chunkGrid.rebuild(world.size, (area) => {
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
    const left = vertexToScreen(0, world.size, 0);
    const right = vertexToScreen(world.size, 0, 0);
    const bottom = vertexToScreen(world.size, world.size, 0);
    this.camera.bounds = { minX: left.x, maxX: right.x, minY: -HEIGHT_STEP, maxY: bottom.y };
    this.camera.viewWidth = this.app.screen.width;
    this.camera.viewHeight = this.app.screen.height;
    const centre = tileCenter(this.heights, Math.floor(world.size / 2), Math.floor(world.size / 2));
    this.camera.centerOn(centre.x, centre.y);
    this.rebuildStuff();
  }

  setLayers(world: MataGrid): void {
    this.world = world;
    this.shade = computeShade(world);
    for (const chunk of this.chunkGrid.chunks) chunk.dirty = true;
    this.rebuildStuff();
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.abort();
    if (this.initialized) this.app.destroy(true, { children: true });
  }

  private rebuildStuff(): void {
    const heights = this.heights;
    const world = this.world;
    const atlas = this.sprites;
    if (!heights || !world || !atlas) return;
    this.stuffLayer.removeChildren();
    const sprites: Sprite[] = [];
    for (let y = 0; y < world.size; y++) {
      for (let x = 0; x < world.size; x++) {
        const i = y * world.size + x;
        const species = world.species[i] as SpeciesId;
        const centre = tileCenter(heights, x, y);
        if (isPlantSpecies(species)) {
          const sprite = atlas.plant(species, world.age[i] as number);
          sprite.position.set(centre.x, centre.y);
          sprite.zIndex = x + y;
          const health = world.health[i] as number;
          sprite.alpha = health < 80 ? 0.45 + (health / 80) * 0.4 : 1;
          sprites.push(sprite);
        }
        const fauna = world.fauna[i] as number;
        const mature = (world.age[i] as number) >= MATURE_AGE;
        if (species === SPECIES_GRASS && mature && fauna >= 40) {
          const mite = atlas.animal('mite');
          mite.position.set(centre.x + 4, centre.y + 2);
          mite.zIndex = x + y + 0.2;
          sprites.push(mite);
        }
        if (species === SPECIES_CROWN && mature && fauna >= 70) {
          const bird = atlas.animal('bird');
          bird.position.set(centre.x - 2, centre.y - 2);
          bird.zIndex = x + y + 0.3;
          sprites.push(bird);
        }
        if (species === SPECIES_FERN && mature && fauna >= 60) {
          const critter = atlas.animal('critter');
          critter.position.set(centre.x + 6, centre.y + 3);
          critter.zIndex = x + y + 0.1;
          sprites.push(critter);
        }
      }
    }
    sprites.sort((a, b) => a.zIndex - b.zIndex);
    for (const sprite of sprites) this.stuffLayer.addChild(sprite);
  }

  private pick(clientX: number, clientY: number): Point | null {
    if (!this.heights) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    const p = this.camera.screenToWorld(clientX - rect.left, clientY - rect.top);
    return pickTile(this.heights, p.x, p.y, 0);
  }

  private frame(): void {
    if (!this.heights || !this.world) return;
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

  private redraw(chunk: MataChunk): void {
    const heights = this.heights;
    const world = this.world;
    if (!heights || !world) return;
    chunk.ground.clear();
    for (let y = chunk.area.y0; y < chunk.area.y1; y++) {
      for (let x = chunk.area.x0; x < chunk.area.x1; x++) {
        const i = y * world.size + x;
        const hash = tileHash(x, y);
        const q = tileQuad(heights, x, y).flatMap((p) => [p.x, p.y]);
        const fill = this.tileFill(world, i, hash);
        chunk.ground.poly(q).fill({ color: fill, alpha: 0.96 });
        if (this.overlay === 'none' && (world.soil[i] as number) < 36) {
          const c = tileCenter(heights, x, y);
          chunk.ground
            .moveTo(c.x - 6, c.y)
            .lineTo(c.x + 3, c.y + 3)
            .stroke({ width: 1, color: 0x2a1a10, alpha: 0.35 });
        }
        chunk.ground.poly(q).stroke({ width: 1, color: 0x241810, alpha: 0.28 });
      }
    }
    chunk.dirty = false;
  }

  private tileFill(world: MataGrid, i: number, hash: number): number {
    if (this.overlay === 'none') {
      return groundColor(world.soil[i] as number, world.moisture[i] as number, hash);
    }
    const [from, to] = OVERLAY_RAMP[this.overlay];
    const value =
      this.overlay === 'moisture'
        ? world.moisture[i]
        : this.overlay === 'nutrients'
          ? world.nutrients[i]
          : this.overlay === 'soil'
            ? world.soil[i]
            : this.overlay === 'fauna'
              ? world.fauna[i]
              : this.shade[i];
    return lerpColor(from, to, (value as number) / 255);
  }

  private drawHover(): void {
    this.highlight.clear();
    if (this.attract || !this.hover || !this.heights) return;
    const q = tileQuad(this.heights, this.hover.x, this.hover.y).flatMap((p) => [p.x, p.y]);
    this.highlight.poly(q).stroke({ width: 2, color: 0xf0e6d2, alpha: 0.9 });
  }

  private setHover(tile: Point | null): void {
    const same = this.hover?.x === tile?.x && this.hover?.y === tile?.y;
    this.hover = tile;
    if (!same) this.onHover?.(tile);
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
      this.setHover(this.attract ? null : this.pick(e.clientX, e.clientY));
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
