import { Infra, type BuildingKind } from '@city/shared';
import { describe, expect, it } from 'vitest';
import {
  FireDispatch,
  MIN_WORK_TIME,
  dispatchRoute,
  stationAccess,
  type FireView,
  type StationFootprint,
} from '../../apps/web/src/renderer/animation/fireDispatch';
import { createRandom } from '../../apps/web/src/renderer/animation/random';
import {
  DX,
  DY,
  LANE_OFFSET,
  lanePoint,
  nextDirection,
  reverse,
  routeBfs,
  type Dir,
} from '../../apps/web/src/renderer/animation/roads';
import {
  MAX_PUFFS,
  SmokeSim,
  emissionShare,
  isSmoking,
  puffLook,
  puffZoomBoost,
  smokeVents,
} from '../../apps/web/src/renderer/animation/smoke';
import { VehicleSim, carDensity } from '../../apps/web/src/renderer/animation/vehicles';
import { sparkleAlpha, sparkleSpots } from '../../apps/web/src/renderer/animation/water';
import { addWater, flatEngine } from '../helpers/engine';

interface TestView extends FireView {
  readonly road: Uint8Array;
  readonly traffic: Uint8Array;
  readonly fire: Uint8Array;
  readonly fireCover: Uint8Array;
}

function testView(
  size: number,
  roads: readonly (readonly [number, number])[],
  traffic = 0,
): TestView {
  const n = size * size;
  const road = new Uint8Array(n);
  const load = new Uint8Array(n);
  for (const [x, y] of roads) {
    road[y * size + x] = 1;
    load[y * size + x] = traffic;
  }
  return {
    size,
    road,
    hasRoad: (i) => road[i] === 1,
    traffic: load,
    fire: new Uint8Array(n),
    fireCover: new Uint8Array(n),
  };
}

function row(y: number, x0: number, x1: number): [number, number][] {
  const tiles: [number, number][] = [];
  for (let x = x0; x <= x1; x++) tiles.push([x, y]);
  return tiles;
}

function roadTiles(view: TestView): number[] {
  const tiles: number[] = [];
  view.road.forEach((r, i) => r && tiles.push(i));
  return tiles;
}

const everywhere = (): boolean => true;
const DIRS: Dir[] = [0, 1, 2, 3];

describe('road lanes', () => {
  it('drives on the right-hand side of the road', () => {
    // Heading east (+x) the right-hand side is south (+y).
    expect(lanePoint(1, 1, 0)).toEqual({ u: 0, v: 0.5 + LANE_OFFSET });
    expect(lanePoint(1, 1, 1)).toEqual({ u: 1, v: 0.5 + LANE_OFFSET });
    // Heading north (−y) the right-hand side is east (+x).
    expect(lanePoint(0, 0, 0.5)).toEqual({ u: 0.5 + LANE_OFFSET, v: 0.5 });
  });

  it('joins lanes seamlessly across tile edges', () => {
    for (const a of DIRS) {
      for (const b of DIRS) {
        if (b === reverse(a)) continue;
        for (const c of DIRS) {
          if (c === reverse(b)) continue;
          const leave = lanePoint(a, b, 1);
          const enter = lanePoint(b, c, 0);
          expect(leave.u - DX[b]).toBeCloseTo(enter.u, 9);
          expect(leave.v - DY[b]).toBeCloseTo(enter.v, 9);
        }
      }
    }
  });

  it('only turns back at dead ends', () => {
    const view = testView(8, row(3, 1, 6));
    const random = createRandom(1);
    for (let k = 0; k < 50; k++) expect(nextDirection(view, 3 * 8 + 3, 1, random)).toBe(1);
    expect(nextDirection(view, 3 * 8 + 6, 1, random)).toBe(3);
    const lonely = testView(8, [[4, 4]]);
    expect(nextDirection(lonely, 4 * 8 + 4, 1, random)).toBe(-1);
  });

  it('finds the shortest road route, source first', () => {
    const view = testView(8, [...row(2, 0, 6), [6, 3], [6, 4]]);
    const route = routeBfs(view, [2 * 8 + 1], (i) => i === 4 * 8 + 6);
    expect(route).toEqual([17, 18, 19, 20, 21, 22, 30, 38]);
    expect(routeBfs(view, [2 * 8 + 1], (i) => i === 4 * 8 + 6, 3)).toBeNull();
    expect(routeBfs(view, [2 * 8 + 1], (i) => i === 7 * 8 + 7)).toBeNull();
  });
});

describe('cars', () => {
  it('maps simulated traffic to a capped car density', () => {
    expect(carDensity(0)).toBe(0);
    expect(carDensity(40)).toBeGreaterThan(0);
    expect(carDensity(200)).toBeGreaterThan(carDensity(40));
    expect(carDensity(255)).toBeLessThanOrEqual(0.6);
  });

  it('spawns no cars on roads without traffic', () => {
    const view = testView(24, row(5, 0, 23), 0);
    const sim = new VehicleSim(createRandom(3));
    for (let k = 0; k < 10; k++) sim.populate(view, roadTiles(view));
    expect(sim.vehicles).toHaveLength(0);
  });

  it('puts cars on roads only, more of them where traffic is heavier', () => {
    const counts = [30, 200].map((traffic) => {
      const view = testView(24, row(5, 0, 23), traffic);
      const sim = new VehicleSim(createRandom(3));
      for (let k = 0; k < 10; k++) sim.populate(view, roadTiles(view));
      for (const v of sim.vehicles) expect(view.hasRoad(v.tile)).toBe(true);
      return sim.vehicles.length;
    });
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBeGreaterThan(counts[0] as number);
  });

  it('stays on the network while driving and freezes when paused', () => {
    const view = testView(16, [...row(4, 2, 12), ...row(10, 2, 12)], 120);
    for (let y = 4; y <= 10; y++) {
      view.road[y * 16 + 2] = 1;
      view.road[y * 16 + 12] = 1;
    }
    const sim = new VehicleSim(createRandom(5));
    for (let k = 0; k < 5; k++) sim.populate(view, roadTiles(view));
    expect(sim.vehicles.length).toBeGreaterThan(0);
    for (let k = 0; k < 200; k++) {
      sim.step(view, 0.05, everywhere);
      for (const v of sim.vehicles) expect(view.hasRoad(v.tile)).toBe(true);
    }
    const before = JSON.stringify(sim.vehicles);
    for (let k = 0; k < 20; k++) sim.step(view, 0, everywhere);
    expect(JSON.stringify(sim.vehicles)).toBe(before);
  });

  it('removes cars whose road disappears or leaves the view', () => {
    const view = testView(16, row(4, 0, 15), 120);
    const sim = new VehicleSim(createRandom(5));
    sim.populate(view, roadTiles(view));
    expect(sim.vehicles.length).toBeGreaterThan(0);
    for (let k = 0; k < 40; k++) sim.step(view, 0.1, () => false);
    expect(sim.vehicles).toHaveLength(0);
    sim.populate(view, roadTiles(view));
    view.road.fill(0);
    sim.step(view, 0.01, everywhere);
    expect(sim.vehicles).toHaveLength(0);
  });

  it('is deterministic for a given seed', () => {
    const run = (): string => {
      const view = testView(16, row(4, 0, 15), 90);
      const sim = new VehicleSim(createRandom(42));
      for (let k = 0; k < 30; k++) {
        sim.populate(view, roadTiles(view));
        sim.step(view, 0.1, everywhere);
      }
      return JSON.stringify(sim.vehicles);
    };
    expect(run()).toBe(run());
  });
});

describe('chimney smoke', () => {
  const building = (
    kind: BuildingKind,
    overrides: Partial<Parameters<typeof isSmoking>[0]> = {},
  ) => ({
    id: 7,
    kind,
    x: 4,
    y: 4,
    w: kind === 'industrial' ? 1 : 4,
    h: kind === 'industrial' ? 1 : 4,
    level: 3,
    abandoned: false,
    powered: true,
    occupancy: 10,
    offline: 0,
    ...overrides,
  });

  it('only smokes from working industry and online plants', () => {
    expect(isSmoking(building('industrial'))).toBe(true);
    expect(isSmoking(building('industrial', { level: 2 }))).toBe(false);
    expect(isSmoking(building('industrial', { abandoned: true }))).toBe(false);
    expect(isSmoking(building('industrial', { powered: false }))).toBe(false);
    expect(isSmoking(building('industrial', { occupancy: 0 }))).toBe(false);
    expect(isSmoking(building('coalPlant'))).toBe(true);
    expect(isSmoking(building('coalPlant', { offline: 30 }))).toBe(false);
    expect(isSmoking(building('residential'))).toBe(false);
  });

  it('places one vent per smoking chimney with stable keys', () => {
    const vents = smokeVents([
      building('coalPlant'),
      building('industrial', { id: 9, abandoned: true }),
      building('industrial', { id: 11, level: 5 }),
    ]);
    expect(vents.map((v) => v.key)).toEqual([28, 29, 44, 45]);
    const plant = vents.filter((v) => v.buildingId === 7);
    expect(plant[0]?.offsetX).not.toBeCloseTo(plant[1]?.offsetX ?? 0, 0);
    for (const v of vents) expect(v.offsetY).toBeLessThan(0);
  });

  it('emits rising puffs in game time, capped', () => {
    const vents = [{ key: 1, x: 0, y: 0, strength: 1 }];
    const sim = new SmokeSim(createRandom(9), 5);
    sim.step(vents, 0);
    expect(sim.puffs).toHaveLength(0);
    sim.step(vents, 1);
    expect(sim.puffs.length).toBeGreaterThan(0);
    const y = sim.puffs[0]?.y ?? 0;
    sim.step(vents, 0.5);
    expect(sim.puffs[0]?.y).toBeLessThan(y);
    for (let k = 0; k < 20; k++) sim.step(vents, 0.2);
    expect(sim.puffs.length).toBeLessThanOrEqual(5);
    for (let k = 0; k < 40; k++) sim.step([], 0.2);
    expect(sim.puffs).toHaveLength(0);
  });

  it('shares the puff budget so every chimney in view keeps smoking', () => {
    expect(emissionShare([1, 0.7, 0.5])).toBe(1);
    const strengths = Array.from({ length: 120 }, (_, k) => [1, 0.7, 0.5][k % 3] as number);
    expect(emissionShare(strengths)).toBeLessThan(1);

    // Vents 100 px apart; a puff drifts less than 60 px, so its origin is known.
    const vents = strengths.map((strength, k) => ({ key: k, x: k * 100, y: 0, strength }));
    const sim = new SmokeSim(createRandom(4));
    for (let k = 0; k < 600; k++) sim.step(vents, 1 / 60);
    expect(sim.puffs.length).toBeLessThanOrEqual(MAX_PUFFS);
    const smoking = new Set(sim.puffs.map((p) => Math.floor((p.x + 10) / 100)));
    expect(smoking.size).toBe(vents.length);
  });

  it('enlarges puffs when zoomed out, never when zoomed in', () => {
    expect(puffZoomBoost(1)).toBe(1);
    expect(puffZoomBoost(2.5)).toBe(1);
    expect(puffZoomBoost(0.5)).toBeGreaterThan(1);
    expect(puffZoomBoost(0.25)).toBeLessThanOrEqual(2);
    const puff = { x: 0, y: 0, vx: 0, vy: 0, age: 1, life: 3, weight: 1 };
    expect(puffLook(puff, 0.4).scale).toBeGreaterThan(puffLook(puff, 1).scale);
    expect(puffLook(puff, 0.4).alpha).toBeLessThanOrEqual(1);
  });
});

describe('water glints', () => {
  it('sparkles on open water only and flashes briefly', () => {
    const engine = flatEngine(32);
    addWater(engine, 0, 0, 15, 15);
    const w = engine.world;
    w.infra[w.index(3, 3)] = (w.infra[w.index(3, 3)] as number) | Infra.Road;
    const spots = sparkleSpots(w, { x0: 0, y0: 0, x1: 32, y1: 32 });
    expect(spots.length).toBeGreaterThan(0);
    for (const s of spots) {
      expect(s.x).toBeLessThan(16);
      expect(s.y).toBeLessThan(16);
      expect(s.x === 3 && s.y === 3).toBe(false);
    }
    const spot = spots[0]!;
    const samples = Array.from({ length: 200 }, (_, k) =>
      sparkleAlpha(spot, (k * spot.period) / 200),
    );
    expect(Math.max(...samples)).toBeGreaterThan(0.5);
    expect(samples.filter((a) => a > 0).length).toBeLessThan(60);
  });
});

describe('fire trucks', () => {
  const SIZE = 20;
  const station: StationFootprint = { x: 14, y: 6, w: 2, h: 2 };
  const fireAt = 3 * SIZE + 2;

  function town(): TestView {
    const view = testView(SIZE, row(5, 0, 19));
    view.fireCover.fill(200);
    return view;
  }

  function run(dispatch: FireDispatch, view: TestView, seconds: number, dt = 0.1): number {
    let present = 0;
    for (let k = 0; k < Math.round(seconds / dt); k++) {
      dispatch.step(view, [station], dt);
      if (dispatch.trucks.length > 0) present += dt;
    }
    return present;
  }

  it('routes from the station to a road tile next to the fire', () => {
    const view = town();
    const route = dispatchRoute(view, [station], fireAt);
    expect(route).not.toBeNull();
    expect(stationAccess(view, station)).toContain(route![0]);
    const last = route![route!.length - 1] as number;
    expect(Math.abs((last % SIZE) - 2)).toBeLessThanOrEqual(3);
    expect(Math.abs(Math.floor(last / SIZE) - 3)).toBeLessThanOrEqual(3);
  });

  it('does not dispatch without coverage, a route or a station, nor while paused', () => {
    const uncovered = town();
    uncovered.fireCover.fill(0);
    uncovered.fire[fireAt] = 1;
    const a = new FireDispatch();
    run(a, uncovered, 2);
    expect(a.trucks).toHaveLength(0);

    const cut = town();
    cut.fire[fireAt] = 1;
    cut.road[5 * SIZE + 9] = 0;
    const b = new FireDispatch();
    run(b, cut, 2);
    expect(b.trucks).toHaveLength(0);

    const burning = town();
    burning.fire[fireAt] = 1;
    const c = new FireDispatch();
    for (let k = 0; k < 20; k++) c.step(burning, [], 0.1);
    expect(c.trucks).toHaveLength(0);
    for (let k = 0; k < 20; k++) c.step(burning, [station], 0);
    expect(c.trucks).toHaveLength(0);
  });

  it('drives to the fire, works until it is out, returns and despawns', () => {
    const view = town();
    view.fire[fireAt] = 1;
    const dispatch = new FireDispatch();
    run(dispatch, view, 12);
    expect(dispatch.trucks).toHaveLength(1);
    const truck = dispatch.trucks[0]!;
    expect(truck.state).toBe('working');
    expect(Math.abs((truck.tile % SIZE) - 2)).toBeLessThanOrEqual(3);
    view.fire[fireAt] = 0;
    run(dispatch, view, MIN_WORK_TIME + 0.2);
    expect(truck.state).toBe('returning');
    run(dispatch, view, 12);
    expect(dispatch.trucks).toHaveLength(0);
  });

  it('answers a reported fire that is already out, parking for a while', () => {
    const view = town();
    const dispatch = new FireDispatch();
    dispatch.report(fireAt);
    const present = run(dispatch, view, 30);
    expect(present).toBeGreaterThan(MIN_WORK_TIME);
    expect(dispatch.trucks).toHaveLength(0);
  });
});
