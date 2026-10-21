import type { Outcome, Unit } from '@posto/sim';
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
import {
  FIRE_TILE,
  FLAG_TILE,
  FLOOR,
  PostoSprites,
  ROLE_HEAD_Y,
  reservedTile,
  tileHash,
  tileProp,
  unitRole,
  type FlagKind,
} from './sprites';

const ATTRACT_PERIOD_S = 70;
const ATTRACT_RADIUS = 0.22;
const ATTRACT_ZOOM = 1.05;
const ATTRACT_START = 0.12;
const STEPS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

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
  private readonly stuffLayer = new Container();
  private readonly marks = new Graphics();
  private readonly overlay = new Graphics();
  private readonly highlight = new Graphics();
  private readonly chunkGrid = new ChunkGrid<PostoChunk>();
  private heights: FlatHeights | null = null;
  private units: Unit[] = [];
  private sprites: PostoSprites | null = null;
  private selectedId: number | null = null;
  private outcome: Outcome = 'playing';
  private hover: Point | null = null;
  private onTile: ((x: number, y: number) => void) | null = null;
  private initialized = false;
  private destroyed = false;
  private inputEnabled = true;
  private attract: { time: number; still: boolean } | null = null;
  private readonly keys = new Set<string>();
  private readonly listeners = new AbortController();
  private panning: { x: number; y: number } | null = null;
  private readonly prevHp = new Map<number, number>();
  private readonly flashes = new Map<number, number>();

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
    this.stuffLayer.sortableChildren = true;
    this.root.addChild(this.chunkLayer, this.stuffLayer, this.marks, this.overlay, this.highlight);
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
      if (this.outcome === 'playing') this.camera.zoom = 1;
    }
  }

  setSelected(id: number | null): void {
    this.selectedId = id;
  }

  setOutcome(outcome: Outcome): void {
    this.outcome = outcome;
    if (outcome === 'playing' || !this.heights) return;
    this.attract = null;
    const focus = tileCenter(this.heights, FLAG_TILE.x, FLAG_TILE.y);
    this.camera.zoom = 1.18;
    this.camera.centerOn(focus.x, focus.y);
    this.rebuildStuff();
  }

  setWorld(size: number, units: Unit[]): void {
    this.heights = new FlatHeights(size);
    this.units = units;
    this.prevHp.clear();
    this.flashes.clear();
    for (const unit of units) this.prevHp.set(unit.id, unit.hp);
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
    const left = vertexToScreen(-0.6, size + 0.4, 0);
    const right = vertexToScreen(size + 0.4, -0.6, 0);
    const bottom = vertexToScreen(size + 0.4, size + 0.4, 0);
    this.camera.bounds = {
      minX: left.x,
      maxX: right.x,
      minY: -HEIGHT_STEP * 8,
      maxY: bottom.y,
    };
    this.camera.viewWidth = this.app.screen.width;
    this.camera.viewHeight = this.app.screen.height;
    const centre = tileCenter(this.heights, Math.floor(size / 2), Math.floor(size / 2));
    this.camera.centerOn(centre.x, centre.y);
    this.rebuildStuff();
  }

  setUnits(units: Unit[]): void {
    const reduced = prefersReducedMotion();
    for (const unit of units) {
      const prev = this.prevHp.get(unit.id);
      if (prev !== undefined && unit.hp < prev && !reduced) this.flashes.set(unit.id, 220);
      this.prevHp.set(unit.id, unit.hp);
    }
    this.units = units;
    this.rebuildStuff();
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.abort();
    if (this.initialized) this.app.destroy(true, { children: true });
  }

  private flagKind(): FlagKind {
    if (this.outcome === 'victory') return 'victory';
    if (this.outcome === 'defeat') return 'defeat';
    return 'idle';
  }

  private rebuildStuff(): void {
    const heights = this.heights;
    const atlas = this.sprites;
    if (!heights || !atlas) return;
    this.stuffLayer.removeChildren();
    const size = heights.size;
    const place = (sprite: Sprite, x: number, y: number, z = 0) => {
      const centre = tileCenter(heights, x, y);
      sprite.position.set(centre.x, centre.y);
      sprite.zIndex = x + y + z;
      this.stuffLayer.addChild(sprite);
    };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const kind = tileProp(x, y);
        if (!kind) continue;
        place(atlas.prop(kind), x, y, -0.2);
      }
    }
    place(atlas.prop('fire'), FIRE_TILE.x, FIRE_TILE.y, -0.1);
    place(atlas.prop('flag', this.flagKind()), FLAG_TILE.x, FLAG_TILE.y, -0.1);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const rim = x === 0 || y === 0 || x === size - 1 || y === size - 1;
        if (!rim) continue;
        const gate = y === size - 1 && (x === 4 || x === 5);
        if (gate || reservedTile(x, y)) continue;
        const post = atlas.prop('post');
        const centre = tileCenter(heights, x, y);
        const edge = vertexToScreen(
          x + (x === 0 ? -0.15 : x === size - 1 ? 1.15 : 0.5),
          y + (y === 0 ? -0.15 : y === size - 1 ? 1.15 : 0.5),
          0,
        );
        post.position.set((centre.x + edge.x) / 2, (centre.y + edge.y) / 2);
        post.zIndex = x + y - 0.3;
        this.stuffLayer.addChild(post);
      }
    }

    const sorted = this.units.slice().sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const unit of sorted) {
      const fallen = unit.hp <= 0;
      const sprite = atlas.unit(unit.side, unitRole(unit.id), fallen);
      if (fallen) sprite.alpha = 0.82;
      place(sprite, unit.x, unit.y, fallen ? -0.05 : 0);
    }
  }

  private pick(clientX: number, clientY: number): Point | null {
    if (!this.heights) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    const p = this.camera.screenToWorld(clientX - rect.left, clientY - rect.top);
    return pickTile(this.heights, p.x, p.y, 0);
  }

  private occupant(x: number, y: number): Unit | undefined {
    return this.units.find((unit) => unit.hp > 0 && unit.x === x && unit.y === y);
  }

  private legalTiles(): { move: Point[]; attack: Point[] } {
    const move: Point[] = [];
    const attack: Point[] = [];
    if (!this.heights || this.outcome !== 'playing') return { move, attack };
    const selected = this.units.find((unit) => unit.id === this.selectedId);
    if (!selected || selected.side !== 'player' || selected.hp <= 0) return { move, attack };
    for (const step of STEPS) {
      const x = selected.x + step.x;
      const y = selected.y + step.y;
      if (!this.heights || x < 0 || y < 0 || x >= this.heights.size || y >= this.heights.size) continue;
      const other = this.occupant(x, y);
      if (!other) move.push({ x, y });
      else if (other.side === 'enemy') attack.push({ x, y });
    }
    return { move, attack };
  }

  private frame(): void {
    if (!this.heights) return;
    const dt = this.app.ticker.deltaMS;
    for (const [id, left] of this.flashes) {
      const next = left - dt;
      if (next <= 0) this.flashes.delete(id);
      else this.flashes.set(id, next);
    }
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
    this.drawMarks();
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
        const worn = reservedTile(x, y) || tileHash(x + 3, y + 5) > 0.72;
        const base = FLOOR[checker + (tileHash(x, y) > 0.5 ? 2 : 0)] ?? FLOOR[0];
        const q = tileQuad(heights, x, y).flatMap((p) => [p.x, p.y]);
        chunk.ground.poly(q).fill({ color: worn ? shadeFloor(base, 0.86) : base, alpha: 0.96 });
        chunk.ground.poly(q).stroke({ width: 1, color: 0x2a241c, alpha: 0.35 });
        if (tileHash(x, y + 11) > 0.78 && !reservedTile(x, y)) {
          const c = tileCenter(heights, x, y);
          chunk.ground.ellipse(c.x + 6, c.y + 2, 3.2, 1.4).fill({ color: 0x3a3228, alpha: 0.35 });
        }
      }
    }
    chunk.dirty = false;
  }

  private drawMarks(): void {
    this.marks.clear();
    if (!this.heights || this.attract) return;
    const { move, attack } = this.legalTiles();
    for (const tile of move) {
      const q = tileQuad(this.heights, tile.x, tile.y).flatMap((p) => [p.x, p.y]);
      this.marks.poly(q).fill({ color: 0xe8c56b, alpha: 0.28 });
      this.marks.poly(q).stroke({ width: 2, color: 0xe8c56b, alpha: 0.85 });
    }
    for (const tile of attack) {
      const q = tileQuad(this.heights, tile.x, tile.y).flatMap((p) => [p.x, p.y]);
      this.marks.poly(q).fill({ color: 0xf87171, alpha: 0.3 });
      this.marks.poly(q).stroke({ width: 2, color: 0xf87171, alpha: 0.95 });
    }
  }

  private drawOverlay(): void {
    this.overlay.clear();
    if (!this.heights) return;
    if (this.outcome === 'defeat') {
      const left = vertexToScreen(-1, this.heights.size + 1, 0);
      const right = vertexToScreen(this.heights.size + 1, -1, 0);
      const top = vertexToScreen(-1, -1, 0);
      const bottom = vertexToScreen(this.heights.size + 1, this.heights.size + 1, 0);
      this.overlay
        .poly([left.x, left.y, top.x, top.y, right.x, right.y, bottom.x, bottom.y])
        .fill({ color: 0x1c1010, alpha: 0.28 });
    }
    for (const unit of this.units) {
      const centre = tileCenter(this.heights, unit.x, unit.y);
      const role = unitRole(unit.id);
      const head = ROLE_HEAD_Y[role];
      const flash = this.flashes.get(unit.id) ?? 0;
      if (flash > 0 && unit.hp > 0) {
        this.overlay.circle(centre.x, centre.y + head + 6, 18).fill({
          color: 0xfff4d0,
          alpha: (flash / 220) * 0.55,
        });
      }
      if (unit.hp <= 0) continue;
      if (this.selectedId === unit.id) {
        this.overlay.circle(centre.x, centre.y + head + 6, 16).stroke({
          width: 2,
          color: 0xffffff,
          alpha: 0.9,
        });
      }
      const barY = centre.y + head - 10;
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
        if (this.attract || this.outcome !== 'playing') return;
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
    if (this.keys.size === 0 || this.outcome !== 'playing') return;
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

function shadeFloor(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}
