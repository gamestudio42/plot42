export { GAME_NAME } from '@city/shared';
export { planToolCommand, DemolishOp, type PlanContext, type ToolPlan } from './commands/plan';
export { lPath, normalizeArea, rectTiles } from './commands/shapes';
export {
  createEngine,
  SimulationEngine,
  type EngineOptions,
  type LoggedCommand,
  type System,
} from './engine';
export { hashSnapshot, hashState, hashTerrain } from './persistence/hash';
export { collectMetrics, type MonthMetrics } from './report';
export {
  buildCorridor,
  buildTown,
  flatCity,
  maintainTown,
  run,
  type CityLayout,
} from './scenarios/builders';
export {
  cityTotals,
  demandTargets,
  taxPressure,
  type CityTotals,
  type DemandInputs,
} from './systems/demand';
export { attractiveness, maxLevel, transportScore, ZONE_KIND } from './systems/growth';
export { boxBlur, populationCentre } from './systems/influence';
export { RoadNetwork } from './systems/roads';
export { SERVICE_LAYERS, stationAccessRoads } from './systems/services';
export { commuteDecay, hasDestination, roadDijkstra, type TrafficResult } from './systems/traffic';
export {
  powerDemand,
  powerSupply,
  pumpNearWater,
  waterDemand,
  waterSupply,
} from './systems/utilities';
export { Rng, type RngState } from './rng/rng';
export { DEFAULT_TERRAIN, generateTerrain, relaxSlopes } from './terrain/generate';
export { FractalNoise, ValueNoise } from './terrain/noise';
export { dateOf, monthIndex, START_YEAR, type CityDate } from './time';
export { BuildingStore } from './world/buildings';
export { Connection, connectionMask } from './world/connections';
export { tileVariant } from './world/variant';
export { World } from './world/world';
