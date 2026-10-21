import { Infra, NEON_DRONES } from '@city/shared';
import type { SimulationEngine } from '../../engine';
import type { World } from '../../world/world';
import { isOperatingHub } from '../traffic';

/**
 * Drone air traffic (neon ruleset).
 *
 * Drone ports open an aerial lane above the road network. The lane is purely additive: it never
 * touches the ground `traffic` layer. Consumers instead read `droneRelief`, which lowers the
 * congestion they feel while a port is online, so the ground rules stay exactly as they are.
 *
 * The lanes are a derived read model, rebuilt on demand for the renderer; the only serialized
 * state is the drone port buildings themselves.
 */

/** A rendered aerial corridor leaving one side of a port. */
export interface DroneLane {
  portId: number;
  x: number;
  y: number;
  /** Road tiles the lane overflies. */
  length: number;
  /** 0 east, 1 south, 2 west, 3 north. */
  heading: number;
}

/** Online drone ports in the city. */
export function portCount(engine: SimulationEngine): number {
  let ports = 0;
  for (const b of engine.buildings.values()) {
    if (b.kind === 'dronePort' && b.powered && b.offline === 0) ports++;
  }
  return ports;
}

/** Drones the city can keep in the air. */
export function droneCapacity(engine: SimulationEngine): number {
  return portCount(engine) * NEON_DRONES.perPort;
}

/**
 * Congestion relief 0..1 from the aerial layer. Zero without a port; otherwise the port's share
 * of the road network, capped at `relief`. `roadTiles` comes from the traffic pass.
 */
export function droneRelief(engine: SimulationEngine, roadTiles: number): number {
  const capacity = droneCapacity(engine);
  if (capacity === 0) return 0;
  // One port serves roughly 24 road tiles before it is saturated.
  const share = Math.min(1, capacity / Math.max(1, roadTiles / 24));
  return Math.round(NEON_DRONES.relief * share * 1000) / 1000;
}

/** Aerial lanes for the renderer, derived from the road network beside each port. */
export function droneLanes(engine: SimulationEngine): DroneLane[] {
  const lanes: DroneLane[] = [];
  for (const port of engine.buildings.values()) {
    if (port.kind !== 'dronePort' || !isOperatingHub(port)) continue;
    const lane = longestLane(engine.world, port);
    if (lane) lanes.push(lane);
  }
  return lanes;
}

const SIDES = [
  { dx: 1, dy: 0, heading: 0 },
  { dx: 0, dy: 1, heading: 1 },
  { dx: -1, dy: 0, heading: 2 },
  { dx: 0, dy: -1, heading: 3 },
] as const;

/** Longest straight run of road tiles leaving one side of the footprint. */
function longestLane(
  w: World,
  port: { id: number; x: number; y: number; w: number; h: number },
): DroneLane | null {
  let best: DroneLane | null = null;
  const starts = [
    { x: port.x + port.w, y: port.y },
    { x: port.x, y: port.y + port.h },
    { x: port.x - 1, y: port.y },
    { x: port.x, y: port.y - 1 },
  ];
  for (let k = 0; k < SIDES.length; k++) {
    const side = SIDES[k] as (typeof SIDES)[number];
    const start = starts[k] as { x: number; y: number };
    let x = start.x;
    let y = start.y;
    let length = 0;
    while (w.inBounds(x, y) && w.hasInfra(w.index(x, y), Infra.Road)) {
      length++;
      x += side.dx;
      y += side.dy;
    }
    if (length === 0) continue;
    if (!best || length > best.length) {
      best = { portId: port.id, x: start.x, y: start.y, length, heading: side.heading };
    }
  }
  return best;
}
