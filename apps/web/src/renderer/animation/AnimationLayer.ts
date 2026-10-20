import type { BuildingRecord, Speed } from '@city/shared';
import type { World } from '@city/simulation';
import { Container, Sprite } from 'pixi.js';
import { tileLocalToScreen, tileQuad, vertexToScreen } from '../iso';
import type { SpriteFactory } from '../sprites';
import { FireDispatch, type FireView, type StationFootprint } from './fireDispatch';
import { createRandom } from './random';
import { headingAt, lanePoint, worldRoadView, type RoadView } from './roads';
import { SmokeSim, puffLook, smokeVents } from './smoke';
import { VehicleSim, type Vehicle } from './vehicles';
import { sparkleAlpha, sparkleSpots, type SparkleSpot } from './water';

/** Game-time multiplier per simulation speed: paused, 1×, 2×, 3×. */
export const SPEED_FACTORS = [0, 1, 1.6, 2.2] as const;
/** Cars are too small to read below this zoom. */
export const CAR_MIN_ZOOM = 0.45;
const OVERLAY_ALPHA = 0.45;
const POPULATE_INTERVAL = 0.25;
const VENT_REFRESH = 0.5;
const VENT_MARGIN = 80;
const LIGHT_HZ = 4;

/** The parts of a renderer chunk the animations draw into. */
export interface AnimatedChunk {
  readonly area: { x0: number; y0: number; x1: number; y1: number };
  readonly root: Container;
  readonly vehicles: Container;
  readonly water: Container;
}

export interface AnimationFrame {
  deltaMS: number;
  view: { x: number; y: number; width: number; height: number };
  zoom: number;
  underground: boolean;
  overlay: boolean;
}

export interface AnimationStats {
  cars: number;
  trucks: number;
  puffs: number;
  sparkles: number;
}

export interface VehicleSample {
  id: number;
  kind: Vehicle['kind'];
  tile: number;
  x: number;
  y: number;
}

interface VentPosition {
  key: number;
  x: number;
  y: number;
  strength: number;
}

interface WaterGlints {
  spots: SparkleSpot[];
  sprites: Sprite[];
}

/**
 * Cosmetic animation: cars, fire engines, chimney smoke and water glints. Reads the mirror
 * world and never changes it; motion runs on game time, so it stops while the game is paused.
 */
export class AnimationLayer {
  /** Smoke rises above every chunk; the renderer adds this container over the chunk layer. */
  readonly smoke = new Container();
  private world: World | null = null;
  private buildings: Map<number, BuildingRecord> = new Map();
  private chunks: readonly AnimatedChunk[] = [];
  private chunkAt: (x: number, y: number) => AnimatedChunk | null = () => null;
  private roads: RoadView | null = null;
  private fireView: FireView | null = null;
  private cars = new VehicleSim(createRandom(1));
  private trucks = new FireDispatch();
  private puffs = new SmokeSim(createRandom(2));
  private vents: VentPosition[] = [];
  private stations: StationFootprint[] = [];
  private buildingsDirty = true;
  private sinceVents = VENT_REFRESH;
  private sincePopulate = POPULATE_INTERVAL;
  private time = 0;
  private enabled = true;
  private speed: Speed = 1;
  private readonly vehicleSprites = new Map<number, Sprite>();
  private readonly puffSprites: Sprite[] = [];
  private readonly glints = new Map<AnimatedChunk, WaterGlints>();

  constructor(private readonly factory: SpriteFactory) {}

  setWorld(
    world: World,
    buildings: Map<number, BuildingRecord>,
    chunks: readonly AnimatedChunk[],
    chunkAt: (x: number, y: number) => AnimatedChunk | null,
  ): void {
    this.world = world;
    this.buildings = buildings;
    this.chunks = chunks;
    this.chunkAt = chunkAt;
    this.roads = worldRoadView(world);
    this.fireView = {
      ...this.roads,
      fire: world.fire,
      fireCover: world.influence.fireCover,
    };
    // The previous chunks were destroyed with their children, including vehicle sprites.
    this.vehicleSprites.clear();
    this.glints.clear();
    this.cars = new VehicleSim(createRandom(world.size * 7919 + 1));
    this.trucks = new FireDispatch();
    this.puffs = new SmokeSim(createRandom(world.size * 7919 + 2));
    this.buildingsDirty = true;
    this.sinceVents = VENT_REFRESH;
    this.sincePopulate = POPULATE_INTERVAL;
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) this.clearMoving();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Building records changed: chimneys and fire stations are recomputed soon. */
  buildingsChanged(): void {
    this.buildingsDirty = true;
  }

  /** A fire started at tile (x, y); a covered station sends a truck even if it is already out. */
  reportFire(x: number, y: number): void {
    const world = this.world;
    if (!this.enabled || !world || !world.inBounds(x, y)) return;
    this.trucks.report(world.index(x, y));
  }

  /** Recreates the water glints of a chunk after it was redrawn. */
  rebuildWater(chunk: AnimatedChunk): void {
    for (const child of chunk.water.removeChildren()) child.destroy();
    const world = this.world;
    if (!world) return;
    const spots = sparkleSpots(world, chunk.area);
    const tex = this.factory.sparkle();
    const sprites = spots.map((s) => {
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      const p = tileLocalToScreen(tileQuad(world, s.x, s.y), s.u, s.v);
      sprite.position.set(p.x, p.y);
      sprite.visible = false;
      chunk.water.addChild(sprite);
      return sprite;
    });
    this.glints.set(chunk, { spots, sprites });
  }

  update(frame: AnimationFrame): void {
    const world = this.world;
    const roads = this.roads;
    const fireView = this.fireView;
    if (!world || !roads || !fireView) return;
    const realDt = Math.min(0.1, frame.deltaMS / 1000);
    this.time += realDt;
    const dt = realDt * SPEED_FACTORS[this.speed];
    this.animateWater(this.enabled && !frame.underground);
    if (!this.enabled) return;

    const showCars = !frame.underground && frame.zoom >= CAR_MIN_ZOOM;
    if (!showCars) {
      this.cars.clear();
    } else {
      const visible = (tile: number) => this.isTileVisible(tile);
      this.cars.step(roads, dt, visible);
      if (dt > 0) {
        this.sincePopulate += realDt;
        if (this.sincePopulate >= POPULATE_INTERVAL) {
          this.sincePopulate = 0;
          this.cars.populate(roads, this.visibleRoadTiles(roads));
        }
      }
    }

    this.sinceVents += realDt;
    if (this.buildingsDirty && this.sinceVents >= VENT_REFRESH) this.refreshBuildings(world);
    this.trucks.step(fireView, this.stations, dt);
    this.puffs.step(frame.underground ? [] : this.ventsInView(frame.view), dt);

    const alpha = frame.overlay ? OVERLAY_ALPHA : 1;
    this.syncVehicles(world, !frame.underground, alpha);
    this.syncPuffs(!frame.underground, alpha, frame.zoom);
  }

  stats(): AnimationStats {
    let sparkles = 0;
    if (this.enabled) {
      for (const [chunk, g] of this.glints) {
        if (chunk.root.visible && chunk.water.visible) sparkles += g.spots.length;
      }
    }
    return {
      cars: this.cars.vehicles.length,
      trucks: this.trucks.trucks.length,
      puffs: this.puffs.puffs.length,
      sparkles,
    };
  }

  /** Screen positions of a few vehicles (tests check that they freeze while paused). */
  sample(count = 6): VehicleSample[] {
    const list: VehicleSample[] = [];
    for (const v of [...this.trucks.trucks, ...this.cars.vehicles].slice(0, count)) {
      const sprite = this.vehicleSprites.get(spriteKey(v));
      if (!sprite) continue;
      list.push({ id: v.id, kind: v.kind, tile: v.tile, x: sprite.x, y: sprite.y });
    }
    return list;
  }

  private clearMoving(): void {
    this.cars.clear();
    this.trucks.clear();
    this.puffs.clear();
    for (const sprite of this.vehicleSprites.values()) sprite.destroy();
    this.vehicleSprites.clear();
    for (const sprite of this.puffSprites) sprite.visible = false;
  }

  private isTileVisible(tile: number): boolean {
    const size = this.world?.size ?? 0;
    return this.chunkAt(tile % size, Math.floor(tile / size))?.root.visible ?? false;
  }

  private visibleRoadTiles(roads: RoadView): number[] {
    const tiles: number[] = [];
    for (const chunk of this.chunks) {
      if (!chunk.root.visible) continue;
      const { x0, y0, x1, y1 } = chunk.area;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * roads.size + x;
          if (roads.hasRoad(i)) tiles.push(i);
        }
      }
    }
    return tiles;
  }

  private refreshBuildings(world: World): void {
    this.buildingsDirty = false;
    this.sinceVents = 0;
    this.vents = smokeVents(this.buildings.values()).map((v) => {
      const front = vertexToScreen(
        v.frontX + 1,
        v.frontY + 1,
        world.corners(v.frontX, v.frontY)[2],
      );
      return { key: v.key, x: front.x + v.offsetX, y: front.y + v.offsetY, strength: v.strength };
    });
    this.stations = [];
    for (const b of this.buildings.values()) {
      if (b.kind === 'fireStation') this.stations.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    }
  }

  private ventsInView(view: AnimationFrame['view']): VentPosition[] {
    return this.vents.filter(
      (v) =>
        v.x > view.x - VENT_MARGIN &&
        v.x < view.x + view.width + VENT_MARGIN &&
        v.y > view.y - VENT_MARGIN &&
        v.y < view.y + view.height + VENT_MARGIN * 3,
    );
  }

  private syncVehicles(world: World, show: boolean, alpha: number): void {
    const live = new Set<number>();
    const blink = Math.floor(this.time * LIGHT_HZ) % 2 === 0;
    const place = (v: Vehicle, light: boolean) => {
      const key = spriteKey(v);
      live.add(key);
      const x = v.tile % world.size;
      const y = Math.floor(v.tile / world.size);
      const chunk = this.chunkAt(x, y);
      if (!chunk) return;
      const heading = headingAt(v.travelIn, v.travelOut, v.t);
      const tex = this.factory.vehicle(v.kind, heading % 2 === 1 ? 'x' : 'y', v.color, light);
      let sprite = this.vehicleSprites.get(key);
      if (!sprite) {
        sprite = new Sprite(tex.texture);
        this.vehicleSprites.set(key, sprite);
      } else {
        sprite.texture = tex.texture;
      }
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      if (sprite.parent !== chunk.vehicles) chunk.vehicles.addChild(sprite);
      const { u, v: lv } = lanePoint(v.travelIn, v.travelOut, v.t);
      const p = tileLocalToScreen(tileQuad(world, x, y), u, lv);
      sprite.position.set(p.x, p.y);
      sprite.zIndex = x + u + y + lv;
      sprite.alpha = alpha;
      sprite.visible = show;
    };
    for (const v of this.cars.vehicles) place(v, false);
    for (const t of this.trucks.trucks) place(t, t.state !== 'returning' && blink);
    for (const [key, sprite] of this.vehicleSprites) {
      if (live.has(key)) continue;
      sprite.destroy();
      this.vehicleSprites.delete(key);
    }
  }

  private syncPuffs(show: boolean, alpha: number, zoom: number): void {
    const puffs = this.puffs.puffs;
    const tex = this.factory.smokePuff();
    while (this.puffSprites.length < puffs.length) {
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(0.5);
      this.smoke.addChild(sprite);
      this.puffSprites.push(sprite);
    }
    for (let k = 0; k < this.puffSprites.length; k++) {
      const sprite = this.puffSprites[k] as Sprite;
      const p = puffs[k];
      if (!p || !show) {
        sprite.visible = false;
        continue;
      }
      const look = puffLook(p, zoom);
      sprite.visible = true;
      sprite.position.set(p.x, p.y);
      sprite.scale.set(look.scale);
      sprite.alpha = look.alpha * alpha;
    }
  }

  private animateWater(show: boolean): void {
    for (const chunk of this.chunks) {
      chunk.water.visible = show;
      if (!show || !chunk.root.visible) continue;
      const g = this.glints.get(chunk);
      if (!g) continue;
      for (let k = 0; k < g.sprites.length; k++) {
        const a = sparkleAlpha(g.spots[k] as SparkleSpot, this.time);
        const sprite = g.sprites[k] as Sprite;
        sprite.visible = a > 0.01;
        if (sprite.visible) sprite.alpha = a;
      }
    }
  }
}

function spriteKey(v: Vehicle): number {
  return v.kind === 'fireTruck' ? -v.id : v.id;
}
