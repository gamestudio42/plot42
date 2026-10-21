/**
 * Neo Urbe balance: the cyberpunk ruleset. Kept apart from `BALANCE` so Urbe keeps its classic
 * numbers byte for byte, and so a single place documents every new knob.
 *
 * Provenance of each formula lives in `docs/neon-spec.md`; this file only holds constants.
 */

/** Power grid: substations, cascading overloads and batteries. */
export const NEON_GRID = {
  /** Extra power a substation adds to its component while online. */
  substationSupply: 400,
  /** Cost and upkeep of a substation. */
  substationCost: 2200,
  substationUpkeep: 40,
  /** Cost and upkeep of a battery bank. */
  batteryCost: 1200,
  batteryUpkeep: 20,
  /** Ticks a full battery bank covers at its rated load. */
  batteryTicks: 240,
  /** Share of a battery's stored energy released per tick while the grid is short. */
  batteryDischarge: 1 / 240,
  /** Power a battery bank can carry while discharging. */
  batteryOutput: 120,
  /** Demand above this fraction of supply starts degrading the district. */
  overloadThreshold: 0.9,
  /** Chance per day that an overloaded district blows a substation. */
  cascadeChance: 0.08,
  /** Days a blown substation stays dark. */
  cascadeOutageDays: 2,
  /** Share of a component's buildings that may lose power in one cascade. */
  cascadeShare: 0.35,
} as const;

/** Megacorporations: land-market agents that buy idle lots and distort land value. */
export const NEON_CORPS = {
  count: 4,
  /** Starting capital of each corporation. */
  startingCapital: 24000,
  /** A corporation buys a lot when it has at least this share of its capital free. */
  buyReserve: 0.35,
  /** Cash a corporation spends on one lot, as a share of its capital. */
  lotPrice: 0.18,
  /** Land value added around a corporate lot. */
  landValue: 26,
  landValueRadius: 5,
  /** Pollution a corporate tower adds. */
  pollution: 8,
  /** Monthly chance that each corporation expands. */
  expandChance: 0.5,
  /** A corporation never buys a lot with this many residents or jobs. */
  maxOccupancy: 6,
  /** Fraction of tax revenue a corporate lot diverts from the city. */
  taxSkim: 0.12,
} as const;

/** Hackers: intrusions that take a service offline and firewalls that stop them. */
export const NEON_INTRUSION = {
  /** Base chance per month of an intrusion attempt. */
  baseChance: 0.35,
  /** Chance added per 1000 residents. */
  populationChance: 0.12,
  /** Chance reduction per point of firewall coverage (0..1). */
  firewallMitigation: 0.75,
  /** Ticks a hacked service stays offline. */
  offlineTicks: 60,
  /** Cost and upkeep of a firewall node. */
  firewallCost: 900,
  firewallUpkeep: 15,
  /** Radius of one firewall node, in tiles. */
  firewallRadius: 6,
  /** Cash stolen when an intrusion succeeds. */
  theft: 400,
  /** Highest chance an intrusion can reach, whatever the firewall. */
  maxChance: 0.8,
} as const;

/** Drone traffic: a separate aerial layer above the roads. */
export const NEON_DRONES = {
  /** Drones a single drone port supports. */
  perPort: 4,
  /** Cost and upkeep of a drone port. */
  portCost: 1600,
  portUpkeep: 30,
  /** Tiles a drone crosses per tick of simulated traffic. */
  tilesPerTick: 2,
  /** Share of a road's traffic that drones relieve while a port is online. */
  relief: 0.15,
  /** Vertical clearance of the drone lanes, in sprite pixels. */
  altitude: 34,
} as const;

/** Vertical density: how tall a neon lot may grow. */
export const NEON_VERTICAL = {
  /** Level a dense zone can reach in the neon ruleset. */
  maxLevelDense: 7,
  /** Level a light zone can reach in the neon ruleset. */
  maxLevelLight: 3,
  /** Extra capacity per level above the classic table, as a multiplier. */
  capacityPerLevel: 1.35,
  /** Extra power demand per level above the classic table. */
  powerPerLevel: 1.2,
  /** Extra water demand per level above the classic table. */
  waterPerLevel: 1.15,
} as const;

export const NEON_BALANCE = {
  grid: NEON_GRID,
  corps: NEON_CORPS,
  intrusion: NEON_INTRUSION,
  drones: NEON_DRONES,
  vertical: NEON_VERTICAL,
} as const;

export type NeonBalance = typeof NEON_BALANCE;
