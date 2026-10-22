import { Infra, type BuildingRecord } from '@city/shared';
import type { World } from '@city/simulation';
import { headingIndex } from '../hubSprites';
import type { Random } from './random';

/**
 * Cosmetic aerial traffic: drones leaving online drone ports, following a corridor above the
 * road network and returning to land. The lane is derived from the road tiles beside the port,
 * exactly like the simulated relief, but nothing here feeds back into the simulation.
 */

/** Drone cruising speed in tiles per game second. */
export const DRONE_SPEED = 2.1;

/** Flight altitude above the street, in pixels. */
export const DRONE_ALTITUDE = 34;

/** Drones are too small to read below this zoom. */
export const DRONE_MIN_ZOOM = 0.35;

const CLIMB_SPEED = 26;
const SPAWN_DELAY = { min: 0.55, max: 2.2 } as const;
const TURN_DELAY = { min: 0.6, max: 2.2 } as const;
const MAX_DRONES_PER_PORT = 4;
const MAX_LANE = 14;

/** Most drones a single port keeps in the air; exported so tests track the real budget. */
export const DRONES_PER_PORT = MAX_DRONES_PER_PORT;

/** Sideways offset of a lane, in tiles: outbound traffic keeps right, inbound keeps left. */
export const DRONE_LANE_OFFSET = 0.24;

/** Vertical hover wobble, in pixels, so a cruising drone never looks pinned to the sky. */
export const DRONE_BOB = 1.7;

/** A straight corridor above the road network, from the port's edge along one axis. */
export interface DroneLane {
  portId: number;
  x: number;
  y: number;
  length: number;
  /** 0 east, 1 south, 2 west, 3 north. */
  heading: number;
}

/** Where a drone is in its round trip. */
export type DronePhase = 'climb' | 'outbound' | 'turn' | 'inbound' | 'land';

/** One cosmetic drone: lane, progress along it, altitude and phase. */
export interface Drone {
  id: number;
  /** Port the drone belongs to; lanes are looked up by port, never by array index. */
  portId: number;
  /** Tiles from the port along the lane. */
  t: number;
  phase: DronePhase;
  timer: number;
  altitude: number;
}

/** Drone port footprint a lane starts from. */
export interface DronePort {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Unit steps of each lane heading, exported so tests can reconstruct a lane's geometry. */
export const SIDES = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 },
] as const;

/** Longest straight run of road tiles leaving one side of the footprint, capped at `MAX_LANE`. */
export function laneOf(world: World, port: DronePort): DroneLane | null {
  const starts = [
    { x: port.x + port.w, y: port.y },
    { x: port.x, y: port.y + port.h },
    { x: port.x - 1, y: port.y },
    { x: port.x, y: port.y - 1 },
  ];
  let best: DroneLane | null = null;
  for (let k = 0; k < SIDES.length; k++) {
    const side = SIDES[k] as (typeof SIDES)[number];
    const start = starts[k] as { x: number; y: number };
    let x = start.x;
    let y = start.y;
    let length = 0;
    while (length < MAX_LANE && world.inBounds(x, y) && world.hasInfra(world.index(x, y), Infra.Road)) {
      length++;
      x += side.dx;
      y += side.dy;
    }
    if (length === 0) continue;
    if (!best || length > best.length) {
      best = { portId: port.id, x: start.x, y: start.y, length, heading: k };
    }
  }
  return best;
}

/**
 * Grid position of a drone along its lane and the heading it faces. Outbound traffic keeps to one
 * side of the corridor and inbound to the other, so the two directions never overlap, and a
 * cruising drone bobs slightly on its own phase.
 */
export function dronePose(
  drone: Drone,
  lane: DroneLane,
): { x: number; y: number; heading: number; bob: number } {
  const side = SIDES[lane.heading] as (typeof SIDES)[number];
  const returning = drone.phase === 'inbound' || drone.phase === 'land';
  const along = returning ? lane.length - drone.t : drone.t;
  // Perpendicular to the lane, so the offset widens the corridor instead of shortening it.
  const drift = (returning ? -1 : 1) * DRONE_LANE_OFFSET;
  const bob = Math.sin(drone.t * 1.9 + drone.id) * DRONE_BOB;
  return {
    x: lane.x + side.dx * along - side.dy * drift + 0.5,
    y: lane.y + side.dy * along + side.dx * drift + 0.5,
    heading: headingIndex(side.dx, side.dy),
    bob,
  };
}

/**
 * Aerial traffic for the neon ruleset. Reads the drone ports of the mirror world, never writes
 * to it, and advances on game time so it freezes while the game is paused.
 */
export class DroneTraffic {
  readonly drones: Drone[] = [];
  private ports: DronePort[] = [];
  private lanes = new Map<number, DroneLane>();
  private readonly timers = new Map<number, number>();
  private terrainVersion = -1;
  private nextId = 1;

  constructor(private readonly random: Random) {}

  /** Online ports of the city; lanes and drones of removed ports disappear. */
  setPorts(world: World, buildings: Iterable<BuildingRecord>): void {
    const ports: DronePort[] = [];
    for (const b of buildings) {
      if (b.kind !== 'dronePort') continue;
      if (!b.powered || b.offline > 0) continue;
      ports.push({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h });
    }
    if (world.terrainVersion !== this.terrainVersion) {
      this.terrainVersion = world.terrainVersion;
      this.lanes.clear();
    }
    const live = new Set(ports.map((p) => p.id));
    for (const id of [...this.lanes.keys()]) if (!live.has(id)) this.lanes.delete(id);
    for (const port of ports) {
      if (this.lanes.has(port.id)) continue;
      const lane = laneOf(world, port);
      if (lane) this.lanes.set(port.id, lane);
    }
    for (const id of [...this.timers.keys()]) if (!live.has(id)) this.timers.delete(id);
    this.ports = ports;
    removeWhere(this.drones, (d) => !this.lanes.has(d.portId));
  }

  laneOf(portId: number): DroneLane | undefined {
    return this.lanes.get(portId);
  }

  portCount(): number {
    return this.ports.length;
  }

  step(dt: number): void {
    if (dt <= 0) return;
    for (const drone of this.drones) this.advance(drone, dt);
    removeWhere(this.drones, (d) => d.phase === 'land' && d.altitude <= 0);

    for (const [portId, lane] of this.lanes) {
      const active = this.drones.filter((d) => d.portId === portId && d.phase !== 'land').length;
      if (active >= MAX_DRONES_PER_PORT || lane.length < 2) continue;
      const left = (this.timers.get(portId) ?? between(this.random, SPAWN_DELAY)) - dt;
      this.timers.set(portId, left);
      if (left > 0) continue;
      this.timers.set(portId, between(this.random, SPAWN_DELAY));
      this.drones.push({
        id: this.nextId++,
        portId,
        t: 0,
        phase: 'climb',
        timer: 0,
        altitude: 0,
      });
    }
  }

  private advance(drone: Drone, dt: number): void {
    const lane = this.laneOf(drone.portId);
    if (!lane) {
      drone.phase = 'land';
      drone.altitude = 0;
      return;
    }
    switch (drone.phase) {
      case 'climb': {
        drone.altitude = Math.min(DRONE_ALTITUDE, drone.altitude + CLIMB_SPEED * dt);
        if (drone.altitude >= DRONE_ALTITUDE) drone.phase = 'outbound';
        return;
      }
      case 'outbound': {
        drone.t += DRONE_SPEED * dt;
        if (drone.t < lane.length) return;
        drone.t = lane.length;
        drone.phase = 'turn';
        drone.timer = between(this.random, TURN_DELAY);
        return;
      }
      case 'turn': {
        drone.timer -= dt;
        if (drone.timer <= 0) drone.phase = 'inbound';
        return;
      }
      case 'inbound': {
        drone.t -= DRONE_SPEED * dt;
        if (drone.t > 0) return;
        drone.t = 0;
        drone.phase = 'land';
        return;
      }
      case 'land': {
        drone.altitude = Math.max(0, drone.altitude - CLIMB_SPEED * dt);
        return;
      }
    }
  }

  clear(): void {
    this.drones.length = 0;
    this.timers.clear();
  }
}

const between = (random: Random, r: { min: number; max: number }) =>
  r.min + random() * (r.max - r.min);

function removeWhere<T>(list: T[], drop: (item: T) => boolean): void {
  let n = 0;
  for (const item of list) if (!drop(item)) list[n++] = item;
  list.length = n;
}
