import { NEON_DRONES } from '@city/shared';
import {
  buildTown,
  createEngine,
  droneCapacity,
  droneLanes,
  droneRelief,
  portCount,
  type SimulationEngine,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

/**
 * Flat neon city with the standard town and one drone port beside the avenue at y = 20.
 * The port footprint is 2x2, so (38,21) hugs the road and satisfies `requiresRoad`.
 */
function droneTown(seed = 'neon-drone'): SimulationEngine {
  const e = createEngine({
    seed,
    size: 64,
    ruleset: 'neon',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 400_000,
  });
  e.disastersEnabled = false;
  buildTown(e);
  return e;
}

describe('neon drone traffic', () => {
  it('has no capacity and no relief without a port', () => {
    const e = droneTown();
    e.refreshUtilities();
    expect(portCount(e)).toBe(0);
    expect(droneCapacity(e)).toBe(0);
    expect(droneRelief(e, 100)).toBe(0);
    expect(droneLanes(e)).toEqual([]);
  });

  it('adds capacity and relief once a port is online', () => {
    const e = droneTown();
    expect(e.execute({ type: 'place', kind: 'dronePort', x: 38, y: 21 }).ok).toBe(true);
    e.refreshUtilities();
    expect(portCount(e)).toBe(1);
    expect(droneCapacity(e)).toBe(NEON_DRONES.perPort);
    expect(droneRelief(e, 100)).toBeGreaterThan(0);
  });

  it('never exceeds the configured relief cap', () => {
    const e = droneTown();
    e.execute({ type: 'place', kind: 'dronePort', x: 38, y: 21 });
    e.refreshUtilities();
    expect(droneRelief(e, 1)).toBeLessThanOrEqual(NEON_DRONES.relief);
    expect(droneRelief(e, 10_000)).toBeLessThanOrEqual(NEON_DRONES.relief);
  });

  it('scales relief with the number of online ports', () => {
    const e = droneTown();
    e.execute({ type: 'place', kind: 'dronePort', x: 38, y: 21 });
    e.refreshUtilities();
    const one = droneRelief(e, 400);
    expect(e.execute({ type: 'place', kind: 'dronePort', x: 22, y: 13 }).ok).toBe(true);
    e.refreshUtilities();
    const two = droneRelief(e, 400);
    expect(two).toBeGreaterThanOrEqual(one);
  });

  it('takes an offline port out of service', () => {
    const e = droneTown();
    e.execute({ type: 'place', kind: 'dronePort', x: 38, y: 21 });
    e.refreshUtilities();
    expect(portCount(e)).toBe(1);
    const port = e.buildings.ofKind('dronePort')[0];
    expect(port).toBeDefined();
    if (!port) return;
    port.offline = 20;
    expect(portCount(e)).toBe(0);
    expect(droneCapacity(e)).toBe(0);
  });

  it('derives a lane along the road beside the port', () => {
    const e = droneTown();
    e.execute({ type: 'place', kind: 'dronePort', x: 38, y: 21 });
    e.refreshUtilities();
    const lanes = droneLanes(e);
    expect(lanes).toHaveLength(1);
    const lane = lanes[0];
    if (!lane) return;
    expect(lane.length).toBeGreaterThan(0);
    expect(lane.heading).toBeGreaterThanOrEqual(0);
    expect(lane.heading).toBeLessThan(4);
    expect(lane.portId).toBeGreaterThan(0);
  });

  it('leaves the classic ruleset without drone relief', () => {
    const e = createEngine({
      seed: 'classic-drone',
      size: 64,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 400_000,
    });
    e.disastersEnabled = false;
    buildTown(e);
    e.runMonths(6);
    expect(e.stats().neon).toBeUndefined();
  });

  it('is deterministic for the same seed', () => {
    const a = droneTown('drone-same');
    const b = droneTown('drone-same');
    a.execute({ type: 'place', kind: 'dronePort', x: 38, y: 21 });
    b.execute({ type: 'place', kind: 'dronePort', x: 38, y: 21 });
    a.runMonths(6);
    b.runMonths(6);
    expect(droneLanes(a)).toEqual(droneLanes(b));
    expect(a.stats().avgCongestion).toBe(b.stats().avgCongestion);
  });
});
