import { ZoneDensity, ZoneType, type Command, type CommandResult } from '@city/shared';
import { createEngine, type SimulationEngine } from '../engine';

/** Flat grass map without water, hills or trees. */
export function flatCity(seed = 'scenario', size = 64): SimulationEngine {
  return createEngine({
    seed,
    size,
    name: 'Cenário',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
}

export function run(engine: SimulationEngine, command: Command): CommandResult {
  const result = engine.execute(command);
  if (!result.ok)
    throw new Error(`Scenario command failed: ${command.type} ${result.reason ?? ''}`);
  return result;
}

export interface CityLayout {
  /** Rows of the main avenue and the zone blocks. */
  avenueY: number;
  x0: number;
  x1: number;
}

/**
 * A small grid town: an avenue reaching the west map edge, residential blocks north of it,
 * commercial and industrial blocks south of it, a power plant and a water pump.
 */
export function buildTown(
  engine: SimulationEngine,
  options: {
    power?: boolean;
    water?: boolean;
    edgeRoad?: boolean;
    industryNearHomes?: boolean;
  } = {},
): CityLayout {
  const { power = true, water = true, edgeRoad = true, industryNearHomes = false } = options;
  const avenueY = 20;
  const x0 = edgeRoad ? 0 : 4;
  const x1 = 40;
  run(engine, { type: 'road', x0, y0: avenueY, x1, y1: avenueY });
  // Side streets every 6 tiles.
  for (let x = 6; x <= x1; x += 6) {
    run(engine, { type: 'road', x0: x, y0: avenueY - 7, x1: x, y1: avenueY + 7 });
  }
  const zone = (z: ZoneType, ax0: number, ay0: number, ax1: number, ay1: number, dense = false) =>
    run(engine, {
      type: 'zone',
      zone: z,
      density: dense ? ZoneDensity.Dense : ZoneDensity.Light,
      x0: ax0,
      y0: ay0,
      x1: ax1,
      y1: ay1,
    });
  for (let x = 7; x + 4 <= x1; x += 6) {
    zone(ZoneType.Residential, x, avenueY - 6, x + 4, avenueY - 1, true);
  }
  if (industryNearHomes) {
    zone(ZoneType.Industrial, 7, avenueY + 1, 35, avenueY + 3, true);
    zone(ZoneType.Commercial, 7, avenueY + 4, 35, avenueY + 6);
  } else {
    zone(ZoneType.Commercial, 7, avenueY + 1, 23, avenueY + 3, true);
    zone(ZoneType.Industrial, 25, avenueY + 1, 35, avenueY + 6, true);
    zone(ZoneType.Commercial, 7, avenueY + 4, 23, avenueY + 6);
  }
  if (power) {
    run(engine, { type: 'place', kind: 'coalPlant', x: 44, y: avenueY + 2 });
    run(engine, { type: 'powerLine', x0: 36, y0: avenueY + 3, x1: 43, y1: avenueY + 3 });
  }
  if (water) {
    run(engine, { type: 'place', kind: 'waterPump', x: 44, y: avenueY - 4 });
    run(engine, { type: 'powerLine', x0: 44, y0: avenueY - 2, x1: 44, y1: avenueY + 1 });
    run(engine, { type: 'pipe', x0: 43, y0: avenueY - 3, x1: 7, y1: avenueY - 3 });
    run(engine, { type: 'pipe', x0: 7, y0: avenueY + 2, x1: 43, y1: avenueY + 2 });
    run(engine, { type: 'pipe', x0: 43, y0: avenueY - 3, x1: 43, y1: avenueY + 2 });
  }
  return { avenueY, x0, x1 };
}
