import {
  BUILDING_CAPELA,
  BUILDING_ESCOLA,
  BUILDING_HOUSE,
  BUILDING_IDS,
  BUILDING_SEDE,
  BUILDING_TERREIRO,
  BUILDING_TULHA,
  BUILDING_VENDA,
  COFFEE_FORMING,
  COFFEE_GROWING,
  COFFEE_MATURE,
  COFFEE_MUDA,
  COFFEE_NONE,
  SITIO_SIZE,
  TERRAIN_MATA,
  TERRAIN_ROAD,
  type BuildingKind,
  type CoffeeLot,
  type SitioFullState,
} from '@sitio/sim';
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import {
  Camera,
  HEIGHT_STEP,
  pickTile,
  tileCenter,
  tileQuad,
  vertexToScreen,
  type HeightSource,
  type Point,
} from '@shell/view-iso';
import { readSlices } from './atlas';

class FlatHeights implements HeightSource {
  constructor(readonly size: number) {}
  corners(): [number, number, number, number] {
    return [0, 0, 0, 0];
  }
}

const TERRA = [0x7d5638, 0x865d3c, 0x744e32] as const;
const MATA = [0x2f5637, 0x356040, 0x294d31] as const;
const ROAD = [0x8a6a48, 0x947452, 0x7f6040] as const;
const COFFEE = [0x78a34a, 0x5c8f3e, 0x437434, 0x2f5f2a] as const;

function tileHash(x: number, y: number): number {
  let h = Math.imul(x + 17, 374761393) + Math.imul(y + 31, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function buildingColor(id: number): number {
  switch (id) {
    case BUILDING_SEDE:
      return 0xe8d8b8;
    case BUILDING_HOUSE:
      return 0xf0e2c4;
    case BUILDING_TERREIRO:
      return 0xc9b38a;
    case BUILDING_TULHA:
      return 0x9a6b43;
    case BUILDING_CAPELA:
      return 0xf4efe0;
    case BUILDING_VENDA:
      return 0xd9b36a;
    case BUILDING_ESCOLA:
      return 0xd7c6a2;
    default:
      return 0xb0a090;
  }
}

function buildingSprite(id: number): string | null {
  switch (id) {
    case BUILDING_SEDE:
      return 'sede';
    case BUILDING_HOUSE:
      return 'house';
    case BUILDING_TERREIRO:
      return 'terreiro';
    case BUILDING_TULHA:
      return 'tulha';
    case BUILDING_CAPELA:
      return 'capela';
    case BUILDING_VENDA:
      return 'venda';
    case BUILDING_ESCOLA:
      return 'escola';
    default:
      return null;
  }
}

interface BuildingArt {
  scale: number;
  anchorX: number;
  anchorY: number;
  yOffset: number;
  xOffset?: number;
}

const DEFAULT_BUILDING_ART: BuildingArt = {
  scale: 1,
  anchorX: 0.5,
  anchorY: 1,
  yOffset: 12,
};

const BUILDING_ART: Record<number, BuildingArt> = {
  [BUILDING_SEDE]: { scale: 2, anchorX: 64 / 112, anchorY: 52 / 88, yOffset: 0 },
  [BUILDING_HOUSE]: { scale: 2, anchorX: 0.5, anchorY: 56 / 80, yOffset: 0 },
  [BUILDING_TERREIRO]: { scale: 2, anchorX: 0.5, anchorY: 56 / 80, yOffset: 0 },
  [BUILDING_TULHA]: { scale: 2, anchorX: 64 / 128, anchorY: 56 / 104, yOffset: 0 },
  [BUILDING_VENDA]: { scale: 2, anchorX: 48 / 96, anchorY: 40 / 64, yOffset: 0 },
  [BUILDING_CAPELA]: { scale: 2, anchorX: 40 / 80, anchorY: 64 / 112, yOffset: 0 },
  [BUILDING_ESCOLA]: { scale: 2, anchorX: 48 / 96, anchorY: 56 / 88, yOffset: 0 },
};

function buildingArt(id: number): BuildingArt {
  return BUILDING_ART[id] ?? DEFAULT_BUILDING_ART;
}

async function loadAtlas(): Promise<Map<string, Texture> | null> {
  const base = import.meta.env.BASE_URL;
  try {
    const response = await fetch(`${base}art/sitio.json`);
    if (!response.ok) return null;
    const slices = readSlices(await response.json());
    if (slices.size === 0) return null;
    const sheet = await Assets.load<Texture>(`${base}art/sitio.png`);
    sheet.source.scaleMode = 'nearest';
    const textures = new Map<string, Texture>();
    for (const [name, bounds] of slices) {
      textures.set(
        name,
        new Texture({
          source: sheet.source,
          frame: new Rectangle(bounds.x, bounds.y, bounds.w, bounds.h),
        }),
      );
    }
    return textures;
  } catch {
    return null;
  }
}

export class SitioRenderer {
  readonly app = new Application();
  readonly camera = new Camera();
  private readonly root = new Container();
  private readonly ground = new Graphics();
  private readonly tileLayer = new Container();
  private readonly objects = new Container();
  private readonly ghostLayer = new Container();
  private readonly planLayer = new Graphics();
  private readonly overlay = new Graphics();
  private readonly heights = new FlatHeights(SITIO_SIZE);
  private atlas: Map<string, Texture> | null = null;
  private state: SitioFullState | null = null;
  private onTile: ((x: number, y: number) => void) | null = null;
  private onHover: ((tile: Point | null) => void) | null = null;
  private hover: Point | null = null;
  private placement: {
    x: number;
    y: number;
    w: number;
    h: number;
    valid: boolean;
    kind?: BuildingKind | 'sede' | 'coffee';
  } | null = null;
  private ghost: Sprite | null = null;
  private panning: { x: number; y: number } | null = null;
  private initialized = false;
  private destroyed = false;
  private inputEnabled = true;
  private readonly listeners = new AbortController();

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: 0x241c16,
      antialias: false,
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
    this.objects.sortableChildren = true;
    this.tileLayer.sortableChildren = true;
    this.root.addChild(
      this.ground,
      this.tileLayer,
      this.objects,
      this.ghostLayer,
      this.planLayer,
      this.overlay,
    );
    this.app.stage.addChild(this.root);
    this.atlas = await loadAtlas();
    this.attachInput(this.app.canvas);
    this.app.ticker.add(() => this.frame());
    this.initialized = true;
    this.setupCamera();
    this.rebuild();
    this.refreshGhost();
  }

  setOnTile(handler: (x: number, y: number) => void): void {
    this.onTile = handler;
  }

  setOnHover(handler: (tile: Point | null) => void): void {
    this.onHover = handler;
  }

  private setHover(tile: Point | null): void {
    if (this.hover?.x === tile?.x && this.hover?.y === tile?.y) return;
    this.hover = tile;
    this.onHover?.(tile);
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
  }

  setPlacement(
    placement: {
      x: number;
      y: number;
      w: number;
      h: number;
      valid: boolean;
      kind?: BuildingKind | 'sede' | 'coffee';
    } | null,
  ): void {
    this.placement = placement;
    if (this.initialized) this.refreshGhost();
  }

  private refreshGhost(): void {
    if (this.ghost) {
      this.ghost.destroy();
      this.ghost = null;
    }
    const placement = this.placement;
    if (!placement?.kind) return;
    let textureName: string | null;
    let art: BuildingArt;
    if (placement.kind === 'coffee') {
      textureName = 'coffee_lot_0';
      art = { scale: 2, anchorX: 76 / 128, anchorY: 56 / 96, yOffset: 0 };
    } else {
      const id =
        placement.kind === 'sede' ? BUILDING_SEDE : BUILDING_IDS[placement.kind];
      textureName = buildingSprite(id);
      art = buildingArt(id);
    }
    if (!textureName) return;
    const texture = this.atlas?.get(textureName);
    if (!texture) return;
    const sprite = new Sprite(texture);
    const centre =
      placement.w > 1 || placement.h > 1
        ? vertexToScreen(
            placement.x + placement.w / 2,
            placement.y + placement.h / 2,
            0,
          )
        : tileCenter(this.heights, placement.x, placement.y);
    sprite.anchor.set(art.anchorX, art.anchorY);
    sprite.scale.set(art.scale);
    sprite.alpha = 0.55;
    sprite.tint = placement.valid ? 0xffffff : 0xffaaaa;
    sprite.position.set(centre.x + (art.xOffset ?? 0), centre.y + art.yOffset);
    this.ghost = sprite;
    this.ghostLayer.addChild(sprite);
  }

  setState(state: SitioFullState): void {
    this.state = state;
    if (this.initialized) this.rebuild();
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.abort();
    if (this.initialized) this.app.destroy(true, { children: true });
  }

  private setupCamera(): void {
    const left = vertexToScreen(0, SITIO_SIZE, 0);
    const right = vertexToScreen(SITIO_SIZE, 0, 0);
    const bottom = vertexToScreen(SITIO_SIZE, SITIO_SIZE, 0);
    this.camera.bounds = {
      minX: left.x,
      maxX: right.x,
      minY: -HEIGHT_STEP * 2,
      maxY: bottom.y,
    };
    this.camera.viewWidth = this.app.screen.width;
    this.camera.viewHeight = this.app.screen.height;
    const centre = tileCenter(this.heights, SITIO_SIZE / 2, SITIO_SIZE / 2);
    const panelOffset = this.app.screen.width > 900 ? 150 : 0;
    this.camera.centerOn(centre.x + panelOffset, centre.y);
  }

  private rebuild(): void {
    this.ground.clear();
    this.planLayer.clear();
    for (const child of this.tileLayer.removeChildren()) child.destroy();
    for (const child of this.objects.removeChildren()) child.destroy();
    const state = this.state;
    if (!state) return;

    for (const tile of state.roadPlan) {
      const quad = tileQuad(this.heights, tile.x, tile.y).flatMap((point) => [
        point.x,
        point.y,
      ]);
      this.planLayer
        .poly(quad)
        .fill({ color: 0xe0a84a, alpha: 0.22 })
        .stroke({ width: 1, color: 0xe0a84a, alpha: 0.8 });
    }

    for (let y = 0; y < SITIO_SIZE; y++) {
      for (let x = 0; x < SITIO_SIZE; x++) {
        const index = y * SITIO_SIZE + x;
        const terrain = state.terrain[index] ?? 0;
        const variant = tileHash(x, y);
        const tile =
          terrain === TERRAIN_ROAD
            ? `road_${this.roadMask(state, x, y)}`
            : terrain === TERRAIN_MATA
              ? variant < 0.5
                ? 'tile_mata'
                : 'tile_mata_alt'
              : variant < 0.5
                ? 'tile_terra'
                : 'tile_terra_alt';
        if (this.drawTileSprite(tile, x, y)) continue;
        const palette = terrain === TERRAIN_ROAD ? ROAD : terrain === TERRAIN_MATA ? MATA : TERRA;
        const color = palette[Math.floor(variant * palette.length)] ?? palette[0];
        const quad = tileQuad(this.heights, x, y).flatMap((point) => [point.x, point.y]);
        this.ground.poly(quad).fill(color).stroke({ width: 1, color: 0x1b140f, alpha: 0.28 });
      }
    }

    for (let y = 0; y < SITIO_SIZE; y++) {
      for (let x = 0; x < SITIO_SIZE; x++) {
        const index = y * SITIO_SIZE + x;
        const terrain = state.terrain[index] ?? 0;
        if (terrain === TERRAIN_MATA && !this.drawSprite('tree', x, y, 0.2, 2, 1, 9)) {
          this.drawTree(this.objectAt(x, y));
        }
        const coffee = state.coffee[index] ?? COFFEE_NONE;
        if (coffee !== COFFEE_NONE && !this.coffeeLotAt(state, x, y)) {
          const coffeeName =
            ['coffee_0', 'coffee_1', 'coffee_2', 'coffee_3'][coffee - COFFEE_MUDA] ?? 'coffee_0';
          if (!this.drawSprite(coffeeName, x, y, 0.1, 2, 1, 10)) {
            this.drawCoffee(this.objectAt(x, y, 0.1), coffee);
          }
        }
      }
    }

    for (const structure of state.structures) {
      const id = structure.kind === 'sede' ? BUILDING_SEDE : BUILDING_IDS[structure.kind];
      const name = buildingSprite(id);
      if (
        !name ||
        !this.drawFootprintBuilding(
          name,
          structure.x,
          structure.y,
          structure.w,
          structure.h,
          buildingArt(id),
        )
      ) {
        this.drawBuilding(this.objectAt(structure.x, structure.y, 0.2), id);
      }
    }

    for (const lot of state.coffeeLots) {
      const stage = this.coffeeLotStage(state, lot);
      if (stage >= 0 && !this.drawCoffeeLot(lot, stage)) {
        for (let y = lot.y; y < lot.y + lot.h; y++) {
          for (let x = lot.x; x < lot.x + lot.w; x++) {
            const coffee = state.coffee[y * SITIO_SIZE + x] ?? COFFEE_NONE;
            if (coffee === COFFEE_NONE) continue;
            const coffeeName =
              ['coffee_0', 'coffee_1', 'coffee_2', 'coffee_3'][coffee - COFFEE_MUDA] ?? 'coffee_0';
            if (!this.drawSprite(coffeeName, x, y, 0.1, 2, 1, 10)) {
              this.drawCoffee(this.objectAt(x, y, 0.1), coffee);
            }
          }
        }
      }
    }

    for (const site of state.sites) {
      this.drawSite(
        this.objectAt(site.x, site.y, 0.3),
        site.x,
        site.y,
        site.w,
        site.h,
        site.progress,
        site.required,
      );
    }

    for (const family of state.families) {
      if (
        !this.drawSprite('family', family.houseX, family.houseY, 0.4, 1, 1, 8, 10)
      ) {
        const sprite = this.objectAt(family.houseX, family.houseY, 0.4);
        sprite.position.x += 12;
        sprite.position.y -= 2;
        this.drawFamily(sprite);
      }
    }
  }

  private roadMask(state: SitioFullState, x: number, y: number): number {
    const isRoad = (xx: number, yy: number): boolean =>
      xx < 0 ||
      yy < 0 ||
      xx >= SITIO_SIZE ||
      yy >= SITIO_SIZE ||
      state.terrain[yy * SITIO_SIZE + xx] === TERRAIN_ROAD;
    return (
      (isRoad(x, y - 1) ? 1 : 0) |
      (isRoad(x + 1, y) ? 2 : 0) |
      (isRoad(x, y + 1) ? 4 : 0) |
      (isRoad(x - 1, y) ? 8 : 0)
    );
  }

  private coffeeLotAt(state: SitioFullState, x: number, y: number): CoffeeLot | null {
    return (
      state.coffeeLots.find(
        (lot) => x >= lot.x && y >= lot.y && x < lot.x + lot.w && y < lot.y + lot.h,
      ) ?? null
    );
  }

  private coffeeLotStage(state: SitioFullState, lot: CoffeeLot): number {
    let stage = -1;
    for (let y = lot.y; y < lot.y + lot.h; y++) {
      for (let x = lot.x; x < lot.x + lot.w; x++) {
        const coffee = state.coffee[y * SITIO_SIZE + x] ?? COFFEE_NONE;
        if (coffee !== COFFEE_NONE) stage = Math.max(stage, coffee - COFFEE_MUDA);
      }
    }
    return stage;
  }

  private drawCoffeeLot(lot: CoffeeLot, stage: number): boolean {
    const texture = this.atlas?.get(`coffee_lot_${stage}`);
    if (!texture) return false;
    const sprite = new Sprite(texture);
    const centre = vertexToScreen(lot.x + lot.w / 2, lot.y + lot.h / 2, 0);
    sprite.anchor.set(76 / 128, 56 / 96);
    sprite.scale.set(2);
    sprite.position.set(centre.x, centre.y);
    sprite.zIndex = lot.x + lot.y + (lot.w - 1) + (lot.h - 1) + 0.1;
    this.objects.addChild(sprite);
    return true;
  }

  private drawTileSprite(name: string, x: number, y: number): boolean {
    const texture = this.atlas?.get(name);
    if (!texture) return false;
    const sprite = new Sprite(texture);
    const centre = tileCenter(this.heights, x, y);
    sprite.anchor.set(0.5);
    sprite.scale.set(2);
    sprite.position.set(centre.x, centre.y);
    sprite.zIndex = x + y;
    this.tileLayer.addChild(sprite);
    return true;
  }

  private drawFootprintBuilding(
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
    art: BuildingArt,
  ): boolean {
    const texture = this.atlas?.get(name);
    if (!texture) return false;
    const sprite = new Sprite(texture);
    const centre =
      w > 1 || h > 1
        ? vertexToScreen(x + w / 2, y + h / 2, 0)
        : tileCenter(this.heights, x, y);
    sprite.anchor.set(art.anchorX, art.anchorY);
    sprite.scale.set(art.scale);
    sprite.position.set(centre.x + (art.xOffset ?? 0), centre.y + art.yOffset);
    sprite.zIndex = x + y + (w - 1) + (h - 1) + 0.2;
    this.objects.addChild(sprite);
    return true;
  }

  private drawSprite(
    name: string,
    x: number,
    y: number,
    offset: number,
    scale: number,
    anchorY: number,
    yOffset: number,
    xOffset = 0,
  ): boolean {
    const texture = this.atlas?.get(name);
    if (!texture) return false;
    const sprite = new Sprite(texture);
    const centre = tileCenter(this.heights, x, y);
    sprite.anchor.set(0.5, anchorY);
    sprite.scale.set(scale);
    sprite.position.set(centre.x + xOffset, centre.y + yOffset);
    sprite.zIndex = x + y + offset;
    this.objects.addChild(sprite);
    return true;
  }

  private objectAt(x: number, y: number, offset = 0): Graphics {
    const sprite = new Graphics();
    const centre = tileCenter(this.heights, x, y);
    sprite.position.set(centre.x, centre.y);
    sprite.zIndex = x + y + offset;
    this.objects.addChild(sprite);
    return sprite;
  }

  private drawTree(g: Graphics): void {
    g.rect(-2, -18, 4, 18).fill(0x5a3d27);
    g.poly([-13, -14, -2, -30, 9, -14]).fill(0x2f5a37);
    g.poly([-10, -22, -2, -34, 6, -22]).fill(0x3f6b44);
    g.rect(-1, -30, 2, 4).fill(0x3f6b44);
  }

  private drawCoffee(g: Graphics, stage: number): void {
    const color = COFFEE[Math.max(0, Math.min(3, stage - COFFEE_MUDA))] ?? COFFEE[0];
    const height = stage === COFFEE_MUDA ? 7 : stage === COFFEE_GROWING ? 11 : 15;
    g.rect(-1, -height, 2, height).fill(color);
    g.poly([-8, -height + 2, 0, -height - 6, 8, -height + 2]).fill(color);
    g.poly([-6, -height + 7, 0, -height - 1, 6, -height + 7]).fill(color);
    if (stage === COFFEE_MATURE) {
      g.rect(-5, -height - 1, 2, 2).fill(0xc7442e);
      g.rect(2, -height + 1, 2, 2).fill(0xc7442e);
      g.rect(-1, -height + 5, 2, 2).fill(0xd85a3a);
    } else if (stage === COFFEE_FORMING) {
      g.rect(-4, -height, 2, 2).fill(0xd8a33a);
      g.rect(2, -height + 3, 2, 2).fill(0xd8a33a);
    }
  }

  private drawBuilding(g: Graphics, id: number): void {
    const wall = buildingColor(id);
    if (id === BUILDING_TERREIRO) {
      g.poly([-14, 0, 0, -7, 14, 0, 0, 7]).fill(0xc9b38a);
      g.poly([-10, 0, 0, -5, 10, 0, 0, 5]).fill(0xa88a62);
      return;
    }
    if (id === BUILDING_HOUSE) {
      g.rect(-13, -14, 26, 14).fill(wall);
      g.poly([-16, -14, 0, -24, 16, -14]).fill(0xb8563a);
      g.rect(-3, -8, 6, 8).fill(0x6b3d2a);
      g.rect(-11, -10, 4, 4).fill(0x6b3d2a);
      g.rect(7, -10, 4, 4).fill(0x6b3d2a);
      g.rect(14, -3, 9, 4).fill(0x4f7a3a);
      g.rect(15, -5, 2, 2).fill(0xe8d08a);
      g.rect(20, -5, 2, 2).fill(0xe8d08a);
      return;
    }
    if (id === BUILDING_SEDE) {
      g.rect(-16, -22, 32, 22).fill(wall);
      g.poly([-19, -22, 0, -34, 19, -22]).fill(0x8c4a34);
      g.rect(-4, -12, 8, 12).fill(0x5a3424);
      g.rect(-12, -16, 5, 5).fill(0x5a3424);
      g.rect(7, -16, 5, 5).fill(0x5a3424);
      return;
    }
    if (id === BUILDING_TULHA) {
      g.rect(-14, -16, 28, 16).fill(wall);
      g.poly([-17, -16, 0, -26, 17, -16]).fill(0x6e4a2e);
      g.rect(-4, -9, 8, 9).fill(0x4a3220);
      return;
    }
    if (id === BUILDING_CAPELA) {
      g.rect(-12, -18, 24, 18).fill(wall);
      g.poly([-15, -18, 0, -28, 15, -18]).fill(0x8c6a4a);
      g.rect(-15, -30, 2, 8).fill(0x4a3a2a);
      g.rect(-18, -27, 8, 2).fill(0x4a3a2a);
      g.rect(-3, -10, 6, 10).fill(0x6b4a2e);
      return;
    }
    if (id === BUILDING_VENDA) {
      g.rect(-12, -14, 24, 14).fill(wall);
      g.poly([-15, -14, 0, -22, 15, -14]).fill(0x8c4a34);
      g.rect(-10, -11, 20, 4).fill(0xe0a84a);
      g.rect(-10, -7, 20, 7).fill(0x7a5a3a);
      return;
    }
    if (id === BUILDING_ESCOLA) {
      g.rect(-14, -16, 28, 16).fill(wall);
      g.poly([-17, -16, 0, -26, 17, -16]).fill(0x6e4a2e);
      g.rect(-11, -12, 5, 5).fill(0x6b4a2e);
      g.rect(-2, -12, 4, 5).fill(0x6b4a2e);
      g.rect(7, -12, 5, 5).fill(0x6b4a2e);
      return;
    }
    g.rect(-13, -14, 26, 14).fill(wall);
    g.poly([-16, -14, 0, -24, 16, -14]).fill(0x8c4a34);
  }

  private drawSite(
    g: Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    progress: number,
    required: number,
  ): void {
    const centre = tileCenter(this.heights, x, y);
    const corners = [
      vertexToScreen(x, y, 0),
      vertexToScreen(x + w, y, 0),
      vertexToScreen(x + w, y + h, 0),
      vertexToScreen(x, y + h, 0),
    ].flatMap((point) => [point.x - centre.x, point.y - centre.y]);
    g.poly(corners)
      .fill({ color: 0xe8d8b8, alpha: 0.22 })
      .stroke({ width: 1, color: 0xe8d8b8, alpha: 0.55 });
    const ratio = required > 0 ? Math.max(0, Math.min(1, progress / required)) : 0;
    const barWidth = Math.max(24, w * 12);
    const local = (wx: number, wy: number) => {
      const point = vertexToScreen(wx, wy, 0);
      return { x: point.x - centre.x, y: point.y - centre.y };
    };
    const posts: [number, number][] = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x + w / 2, y],
      [x + w / 2, y + h],
    ];
    for (const [px, py] of posts) {
      const point = local(px, py);
      g.rect(point.x - 1, point.y - 11, 2, 11).fill(0x6b4d30);
      g.rect(point.x - 2, point.y - 12, 4, 2).fill(0x9a6b43);
    }
    g.rect(-barWidth / 2, -4, barWidth, 3).fill(0x2a2018);
    g.rect(-barWidth / 2, -4, barWidth * ratio, 3).fill(0xe0a84a);
    g.rect(-12, -7, 9, 2).fill(0x9a6b43);
    g.rect(-10, -9, 9, 2).fill(0xb07a4a);
    g.rect(-12, -6, 2, 4).fill(0x6b3d2a);
    g.circle(10, -5, 3).fill(0x4a2c1e);
    g.rect(7, -9, 7, 2).fill(0x6b3d2a);
    g.rect(6, -12, 2, 7).fill(0x8a5a3b);
    if (ratio > 0.45) {
      g.rect(-6, -16, 14, 7).fill({ color: 0xd6c2a0, alpha: 0.7 });
      g.rect(-6, -9, 14, 2).fill(0x6b3d2a);
    }
    if (ratio >= 1) {
      g.rect(-8, -18, 16, 2).fill(0x8c4a34);
    }
  }

  private drawFamily(g: Graphics): void {
    g.rect(-2, -10, 4, 6).fill(0x3a3a3a);
    g.rect(-3, -13, 6, 3).fill(0xe0c070);
    g.rect(-1, -5, 1, 5).fill(0x2a2a2a);
    g.rect(1, -5, 1, 5).fill(0x2a2a2a);
  }

  private pick(clientX: number, clientY: number): Point | null {
    const rect = this.app.canvas.getBoundingClientRect();
    const point = this.camera.screenToWorld(clientX - rect.left, clientY - rect.top);
    return pickTile(this.heights, point.x, point.y, 0);
  }

  private frame(): void {
    this.camera.viewWidth = this.app.screen.width;
    this.camera.viewHeight = this.app.screen.height;
    this.camera.apply(this.root, true);
    this.drawHover();
  }

  private drawHover(): void {
    this.overlay.clear();
    if (this.placement) {
      const color = this.placement.valid ? 0x8fd18a : 0xd96b6b;
      for (let y = this.placement.y; y < this.placement.y + this.placement.h; y++) {
        for (let x = this.placement.x; x < this.placement.x + this.placement.w; x++) {
          if (x < 0 || y < 0 || x >= SITIO_SIZE || y >= SITIO_SIZE) continue;
          const quad = tileQuad(this.heights, x, y).flatMap((point) => [point.x, point.y]);
          this.overlay
            .poly(quad)
            .fill({ color, alpha: 0.26 })
            .stroke({ width: 1, color, alpha: 0.9 });
        }
      }
    }
    if (!this.hover) return;
    const quad = tileQuad(this.heights, this.hover.x, this.hover.y).flatMap((point) => [
      point.x,
      point.y,
    ]);
    this.overlay
      .poly(quad)
      .fill({ color: 0xfff2d8, alpha: 0.08 })
      .stroke({ width: 2, color: 0xfff2d8, alpha: 0.85 });
  }

  private attachInput(canvas: HTMLCanvasElement): void {
    const signal = this.listeners.signal;
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          /* synthetic or already-released pointer */
        }
        if (event.button === 1 || event.button === 2) {
          this.panning = { x: event.clientX, y: event.clientY };
          return;
        }
        if (event.button === 0 && this.inputEnabled) {
          const tile = this.pick(event.clientX, event.clientY);
          if (tile) this.onTile?.(tile.x, tile.y);
        }
      },
      { signal },
    );
    canvas.addEventListener(
      'pointermove',
      (event) => {
        if (this.panning) {
          this.camera.pan(event.clientX - this.panning.x, event.clientY - this.panning.y);
          this.panning = { x: event.clientX, y: event.clientY };
          return;
        }
        this.setHover(this.inputEnabled ? this.pick(event.clientX, event.clientY) : null);
      },
      { signal },
    );
    canvas.addEventListener('pointerup', () => (this.panning = null), { signal });
    canvas.addEventListener('pointerleave', () => this.setHover(null), { signal });
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        this.camera.zoomAt(
          event.deltaY > 0 ? 0.9 : 1.1,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
      },
      { signal, passive: false },
    );
  }
}
