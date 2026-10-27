import { Fnv1a, Rng, type RngState } from '@shell/kernel';
import {
  ARRIVAL_REPUTATION,
  BUILDING_IDS,
  BUILDING_NONE,
  BUILDING_SEDE,
  BUILDING_SPECS,
  COFFEE_BASE_PRICE,
  COFFEE_CELLS_PER_PERIOD,
  COFFEE_FORMING,
  COFFEE_GRADES,
  COFFEE_MATURE,
  COFFEE_MUDA,
  COFFEE_NONE,
  COFFEE_PES_PER_CELL,
  COFFEE_QUALITY_BASE,
  EDUCATION_PERIODS,
  FAMILY_NAMES,
  FAMILY_NEED,
  FERTILIZER_QUALITY_BONUS,
  FINAL_TURN,
  FOOD_CAP,
  FROST_LOSS,
  HARVEST_YIELD,
  INPUT_PRICES,
  LIMESTONE_QUALITY_BONUS,
  MORALE_MAX,
  MORALE_START,
  PERSON_NAMES,
  ROAD_TILES_PER_WEEK,
  SCHOOL_AGE,
  SITIO_SIZE,
  START_COINS,
  START_FOOD,
  START_WOOD,
  STARTER_FOOTPRINTS,
  TERRAIN_MATA,
  TERRAIN_ROAD,
  TERRAIN_TERRA,
  TERREIRO_CAPACITY,
  TULHA_EXTRA_CAPACITY,
  TURNS_PER_YEAR,
  WEEKS_PER_SEASON,
  WIN_FAMILIES,
  WOOD_BUY_PRICE,
  WOOD_PER_CLEAR,
  YARD_FOOD_PER_PERIOD,
  footprintOfBuilding,
  seasonOf,
  weekOfSeason,
  weekOfYear,
  yearOf,
  type BuildingKind,
  type CoffeeGrade,
  type CoffeeGrades,
  type CoffeeLot,
  type Family,
  type InputKind,
  type InputStock,
  type NewSitioOptions,
  type Period,
  type Person,
  type Season,
  type SeasonReport,
  type SetupStep,
  type Site,
  type SitioCommand,
  type SitioCommandReason,
  type SitioCommandResult,
  type SitioFullState,
  type SitioMeta,
  type SitioSnapshot,
  type SitioStats,
  type SitioStatus,
  type SitioTotals,
  type StarterKind,
  type StarterPreviewResult,
  type Structure,
  type WorkTask,
  type YearEvent,
} from './types';

const START_ROADS: [number, number][] = [];
for (let x = 0; x < SITIO_SIZE; x++) START_ROADS.push([x, 12]);
for (let y = 4; y < 12; y++) START_ROADS.push([12, y]);
for (let y = 8; y < 12; y++) START_ROADS.push([18, y]);

const MATA_PATCH: [number, number][] = [];
for (let y = 18; y <= 22; y++) {
  for (let x = 18; x <= 22; x++) MATA_PATCH.push([x, y]);
  for (let x = 1; x <= 4; x++) MATA_PATCH.push([x, y]);
}
for (let y = 2; y <= 4; y++) {
  for (let x = 15; x <= 17; x++) MATA_PATCH.push([x, y]);
}

function cloneTask(task: WorkTask): WorkTask {
  switch (task.kind) {
    case 'idle':
      return { kind: 'idle' };
    case 'rest':
      return { kind: 'rest' };
    case 'yard':
      return { kind: 'yard' };
    case 'coffee':
      return { kind: 'coffee' };
    case 'study':
      return { kind: 'study' };
    case 'road':
      return { kind: 'road' };
    case 'fertilize':
      return { kind: 'fertilize', x: task.x, y: task.y };
    case 'limestone':
      return { kind: 'limestone', x: task.x, y: task.y };
    case 'build':
      return { kind: 'build', siteId: task.siteId };
    case 'plant':
      return { kind: 'plant', x: task.x, y: task.y };
    case 'clear':
      return { kind: 'clear', x: task.x, y: task.y };
  }
}

function cloneFamily(family: Family): Family {
  return { ...family };
}

function clonePerson(person: Person): Person {
  return {
    ...person,
    morning: cloneTask(person.morning),
    afternoon: cloneTask(person.afternoon),
  };
}

function cloneSite(site: Site): Site {
  return { ...site };
}

function cloneStructure(structure: Structure): Structure {
  return { ...structure };
}

function cloneCoffeeLot(lot: CoffeeLot): CoffeeLot {
  return { ...lot };
}

function cloneReport(report: SeasonReport | null): SeasonReport | null {
  if (!report) return null;
  return {
    ...report,
    completed: [...report.completed],
    morale: report.morale.map((entry) => ({ ...entry })),
    harvestGrades: cloneGrades(report.harvestGrades),
  };
}

function emptyGrades(): CoffeeGrades {
  return { bad: 0, medium: 0, good: 0 };
}

function cloneGrades(grades: CoffeeGrades): CoffeeGrades {
  return { bad: grades.bad, medium: grades.medium, good: grades.good };
}

function emptyInputs(): InputStock {
  return { fertilizer: 0, limestone: 0 };
}

function emptyTotals(): SitioTotals {
  return {
    harvestTotal: 0,
    revenueTotal: 0,
    builtTotal: 0,
    arrivalsTotal: 0,
    departuresTotal: 0,
  };
}

function isStarterKind(value: string): value is StarterKind {
  return value === 'sede' || value === 'house' || value === 'terreiro' || value === 'coffee';
}

function landscape(): Uint8Array {
  const cells = SITIO_SIZE * SITIO_SIZE;
  const terrain = new Uint8Array(cells);
  for (let x = 0; x < SITIO_SIZE; x++) terrain[x] = TERRAIN_MATA;
  for (let y = 0; y < SITIO_SIZE; y++) terrain[y * SITIO_SIZE + SITIO_SIZE - 1] = TERRAIN_MATA;
  for (const [x, y] of MATA_PATCH) terrain[y * SITIO_SIZE + x] = TERRAIN_MATA;
  for (const [x, y] of START_ROADS) terrain[y * SITIO_SIZE + x] = TERRAIN_ROAD;
  return terrain;
}

export class SitioEngine {
  name: string;
  seed: string;
  turn = 0;
  coins = START_COINS;
  food = START_FOOD;
  wood = START_WOOD;
  inputStock: InputStock = emptyInputs();
  coffeeStock = 0;
  coffeeGrades: CoffeeGrades = emptyGrades();
  coffeePrice = COFFEE_BASE_PRICE;
  status: SitioStatus = 'playing';
  setup: SetupStep | null = 'sede';
  yearEvent: YearEvent = 'none';
  terrain: Uint8Array = new Uint8Array(0);
  buildings: Uint8Array = new Uint8Array(0);
  coffee: Uint8Array = new Uint8Array(0);
  families: Family[] = [];
  people: Person[] = [];
  sites: Site[] = [];
  structures: Structure[] = [];
  coffeeLots: CoffeeLot[] = [];
  roadPlan: { x: number; y: number }[] = [];
  totals: SitioTotals = emptyTotals();
  lastReport: SeasonReport | null = null;
  weekSold = 0;
  weekRevenue = 0;
  readonly rng: Rng;
  private nextFamilyId = 1;
  private nextPersonId = 1;
  private nextSiteId = 1;
  private nextStructureId = 1;
  private nextCoffeeLotId = 1;

  private constructor(name: string, seed: string, rng: Rng) {
    this.name = name;
    this.seed = seed;
    this.rng = rng;
  }

  static create(options: NewSitioOptions): SitioEngine {
    const engine = new SitioEngine(
      options.name || 'Sítio',
      options.seed || 'sitio',
      Rng.fromSeed(options.seed || 'sitio'),
    );
    engine.terrain = landscape();
    engine.buildings = new Uint8Array(SITIO_SIZE * SITIO_SIZE);
    engine.coffee = new Uint8Array(SITIO_SIZE * SITIO_SIZE);
    engine.coins = START_COINS;
    engine.food = START_FOOD;
    engine.setup = 'sede';
    return engine;
  }

  static fromSnapshot(snapshot: SitioSnapshot): SitioEngine {
    const engine = new SitioEngine(snapshot.name, snapshot.seed, new Rng(snapshot.rng));
    engine.turn = snapshot.turn;
    engine.coins = snapshot.coins;
    engine.food = snapshot.food;
    engine.wood = snapshot.wood;
    engine.inputStock = { ...snapshot.inputStock };
    engine.coffeeStock = snapshot.coffeeStock;
    engine.coffeeGrades = cloneGrades(snapshot.coffeeGrades);
    engine.coffeePrice = snapshot.coffeePrice;
    engine.status = snapshot.status;
    engine.setup = snapshot.setup ?? null;
    engine.yearEvent = snapshot.yearEvent;
    engine.terrain = snapshot.terrain.slice();
    engine.buildings = snapshot.buildings.slice();
    engine.coffee = snapshot.coffee.slice();
    engine.families = snapshot.families.map(cloneFamily);
    engine.people = (snapshot.people ?? []).map(clonePerson);
    engine.sites = snapshot.sites.map(cloneSite);
    engine.structures = (snapshot.structures ?? []).map(cloneStructure);
    engine.coffeeLots = (snapshot.coffeeLots ?? []).map(cloneCoffeeLot);
    engine.roadPlan = (snapshot.roadPlan ?? []).map((tile) => ({ ...tile }));
    engine.totals = { ...snapshot.totals };
    engine.lastReport = cloneReport(snapshot.lastReport);
    engine.weekSold = snapshot.weekSold ?? 0;
    engine.weekRevenue = snapshot.weekRevenue ?? 0;
    let maxFamily = 0;
    for (const family of engine.families) maxFamily = Math.max(maxFamily, family.id);
    engine.nextFamilyId = maxFamily + 1;
    let maxPerson = 0;
    for (const person of engine.people) maxPerson = Math.max(maxPerson, person.id);
    engine.nextPersonId = maxPerson + 1;
    let maxSite = 0;
    for (const site of engine.sites) maxSite = Math.max(maxSite, site.id);
    engine.nextSiteId = maxSite + 1;
    let maxStructure = 0;
    for (const structure of engine.structures) {
      maxStructure = Math.max(maxStructure, structure.id);
    }
    engine.nextStructureId = maxStructure + 1;
    let maxLot = 0;
    for (const lot of engine.coffeeLots) maxLot = Math.max(maxLot, lot.id);
    engine.nextCoffeeLotId = maxLot + 1;
    return engine;
  }

  get season(): Season {
    return seasonOf(this.turn);
  }

  get year(): number {
    return yearOf(this.turn);
  }

  get week(): number {
    return this.turn + 1;
  }

  get weekOfSeason(): number {
    return weekOfSeason(this.turn);
  }

  get weekOfYear(): number {
    return weekOfYear(this.turn);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < SITIO_SIZE && y < SITIO_SIZE;
  }

  index(x: number, y: number): number {
    return y * SITIO_SIZE + x;
  }

  buildingAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return BUILDING_NONE;
    return this.buildings[this.index(x, y)] ?? BUILDING_NONE;
  }

  coffeeAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return COFFEE_NONE;
    return this.coffee[this.index(x, y)] ?? COFFEE_NONE;
  }

  familyById(id: number): Family | null {
    return this.families.find((family) => family.id === id) ?? null;
  }

  personById(id: number): Person | null {
    return this.people.find((person) => person.id === id) ?? null;
  }

  familyMembers(familyId: number): Person[] {
    return this.people.filter((person) => person.familyId === familyId);
  }

  siteById(id: number): Site | null {
    return this.sites.find((site) => site.id === id) ?? null;
  }

  siteAt(x: number, y: number): Site | null {
    return this.sites.find((site) => this.siteCovers(site, x, y)) ?? null;
  }

  private siteCovers(site: Site, x: number, y: number): boolean {
    return (
      x >= site.x &&
      y >= site.y &&
      x < site.x + site.w &&
      y < site.y + site.h
    );
  }

  reputation(): number {
    let value = 1;
    if (this.hasBuilding('capela')) value++;
    if (this.hasBuilding('escola')) value++;
    if (this.hasBuilding('venda')) value++;
    return value;
  }

  salePrice(): number {
    return this.coffeePrice + (this.hasBuilding('venda') ? 1 : 0);
  }

  priceForGrade(grade: CoffeeGrade): number {
    const base = this.salePrice();
    if (grade === 'bad') return Math.max(1, base - 1);
    if (grade === 'good') return base + 1;
    return base;
  }

  lotQuality(lot: CoffeeLot): number {
    return (
      COFFEE_QUALITY_BASE +
      (lot.fertilized ? FERTILIZER_QUALITY_BONUS : 0) +
      (lot.limed ? LIMESTONE_QUALITY_BONUS : 0)
    );
  }

  gradeForQuality(quality: number): CoffeeGrade {
    if (quality < 50) return 'bad';
    if (quality < 70) return 'medium';
    return 'good';
  }

  lotAt(x: number, y: number): CoffeeLot | null {
    return (
      this.coffeeLots.find(
        (lot) => x >= lot.x && y >= lot.y && x < lot.x + lot.w && y < lot.y + lot.h,
      ) ?? null
    );
  }

  canPlanRoad(x: number, y: number): SitioCommandResult {
    if (this.setup) return { ok: false, reason: 'setup' };
    if (!this.inBounds(x, y)) return { ok: false, reason: 'oob' };
    if (this.terrain[this.index(x, y)] === TERRAIN_ROAD) {
      return { ok: false, reason: 'road' };
    }
    if (this.terrain[this.index(x, y)] !== TERRAIN_TERRA) {
      return { ok: false, reason: 'mata' };
    }
    if (this.buildingAt(x, y) !== BUILDING_NONE) {
      return { ok: false, reason: 'occupied' };
    }
    if (this.coffeeAt(x, y) !== COFFEE_NONE) {
      return { ok: false, reason: 'occupied' };
    }
    if (this.siteAt(x, y)) return { ok: false, reason: 'occupied' };
    if (this.roadPlan.some((tile) => tile.x === x && tile.y === y)) {
      return { ok: false, reason: 'occupied' };
    }
    return { ok: true };
  }

  planRoad(x: number, y: number): SitioCommandResult {
    const check = this.canPlanRoad(x, y);
    if (!check.ok) return check;
    this.roadPlan.push({ x, y });
    return { ok: true };
  }

  clearRoadPlan(): SitioCommandResult {
    this.roadPlan = [];
    return { ok: true };
  }

  buyInput(kind: InputKind, amount: number): SitioCommandResult {
    if (this.setup) return { ok: false, reason: 'setup' };
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, reason: 'invalid-amount' };
    }
    const price = INPUT_PRICES[kind];
    if (!price) return { ok: false, reason: 'invalid-task' };
    const cost = price * amount;
    if (this.coins < cost) return { ok: false, reason: 'no-coins' };
    this.coins -= cost;
    this.inputStock[kind] += amount;
    return { ok: true };
  }

  coffeeCapacity(): number {
    return (
      this.structures.filter((structure) => structure.kind === 'terreiro').length *
        TERREIRO_CAPACITY +
      (this.hasBuilding('tulha') ? TULHA_EXTRA_CAPACITY : 0)
    );
  }

  hasBuildingOrSite(kind: BuildingKind): boolean {
    return (
      this.hasBuilding(kind) || this.sites.some((site) => site.kind === kind)
    );
  }

  hasBuilding(kind: BuildingKind): boolean {
    return this.structures.some((structure) => structure.kind === kind);
  }

  countHouses(): number {
    return this.structures.filter((structure) => structure.kind === 'house').length;
  }

  execute(command: SitioCommand): SitioCommandResult {
    if (this.status !== 'playing') return { ok: false, reason: 'game-over' };
    switch (command.type) {
      case 'assign':
        return this.assign(command.personId, command.period, command.task);
      case 'build':
        return this.placeBuilding(command.kind, command.x, command.y);
      case 'placeStarter':
        return this.placeStarter(command.kind, command.x, command.y);
      case 'sellCoffee':
        return this.sellCoffee(command.grade, command.amount);
      case 'buyWood':
        return this.buyWood(command.amount);
      case 'buyInput':
        return this.buyInput(command.kind, command.amount);
      case 'planRoad':
        return this.planRoad(command.x, command.y);
      case 'clearRoadPlan':
        return this.clearRoadPlan();
      case 'endWeek':
        if (this.setup) return { ok: false, reason: 'setup' };
        this.endWeek();
        return { ok: true };
    }
    return { ok: false, reason: 'nothing' };
  }

  canPlaceStarter(kind: StarterKind, x: number, y: number): StarterPreviewResult {
    if (!isStarterKind(kind)) return { ok: false, reason: 'invalid-task' };
    if (this.setup === null || this.setup !== kind) return { ok: false, reason: 'setup' };
    const footprint = STARTER_FOOTPRINTS[kind];
    for (let yy = y; yy < y + footprint.h; yy++) {
      for (let xx = x; xx < x + footprint.w; xx++) {
        if (!this.inBounds(xx, yy)) return { ok: false, reason: 'oob' };
        const terrain = this.terrain[this.index(xx, yy)];
        if (terrain === TERRAIN_ROAD) return { ok: false, reason: 'road' };
        if (terrain !== TERRAIN_TERRA) return { ok: false, reason: 'mata' };
        if (this.buildingAt(xx, yy) !== BUILDING_NONE) {
          return { ok: false, reason: 'occupied' };
        }
        if (this.coffeeAt(xx, yy) !== COFFEE_NONE) {
          return { ok: false, reason: 'occupied' };
        }
        if (this.siteAt(xx, yy)) return { ok: false, reason: 'occupied' };
      }
    }
    return { ok: true };
  }

  private placeStarter(kind: StarterKind, x: number, y: number): SitioCommandResult {
    const preview = this.canPlaceStarter(kind, x, y);
    if (!preview.ok) return preview;
    const footprint = STARTER_FOOTPRINTS[kind];
    if (kind === 'coffee') {
      this.coffeeLots.push({
        id: this.nextCoffeeLotId++,
        x,
        y,
        w: footprint.w,
        h: footprint.h,
        fertilized: false,
        limed: false,
      });
      for (let yy = y; yy < y + footprint.h; yy++) {
        for (let xx = x; xx < x + footprint.w; xx++) {
          this.coffee[this.index(xx, yy)] = COFFEE_FORMING;
        }
      }
    } else {
      const id =
        kind === 'sede'
          ? BUILDING_SEDE
          : BUILDING_IDS[kind as Exclude<StarterKind, 'sede' | 'coffee'>];
      for (let yy = y; yy < y + footprint.h; yy++) {
        for (let xx = x; xx < x + footprint.w; xx++) {
          this.buildings[this.index(xx, yy)] = id;
        }
      }
      this.structures.push({
        id: this.nextStructureId++,
        kind,
        x,
        y,
        w: footprint.w,
        h: footprint.h,
      });
      if (kind === 'house') this.createInitialFamily(x, y);
    }
    this.setup =
      kind === 'sede'
        ? 'house'
        : kind === 'house'
          ? 'terreiro'
          : kind === 'terreiro'
            ? 'coffee'
            : null;
    return { ok: true };
  }

  serialize(): SitioSnapshot {
    return {
      name: this.name,
      seed: this.seed,
      turn: this.turn,
      coins: this.coins,
      food: this.food,
      wood: this.wood,
      inputStock: { ...this.inputStock },
      coffeeStock: this.coffeeStock,
      coffeeGrades: cloneGrades(this.coffeeGrades),
      coffeePrice: this.coffeePrice,
      status: this.status,
      setup: this.setup,
      yearEvent: this.yearEvent,
      rng: this.rng.getState() as RngState,
      terrain: this.terrain.slice(),
      buildings: this.buildings.slice(),
      coffee: this.coffee.slice(),
      families: this.families.map(cloneFamily),
      people: this.people.map(clonePerson),
      sites: this.sites.map(cloneSite),
      structures: this.structures.map(cloneStructure),
      coffeeLots: this.coffeeLots.map(cloneCoffeeLot),
      roadPlan: this.roadPlan.map((tile) => ({ ...tile })),
      totals: { ...this.totals },
      lastReport: cloneReport(this.lastReport),
      weekSold: this.weekSold,
      weekRevenue: this.weekRevenue,
    };
  }

  fullState(): SitioFullState {
    return {
      name: this.name,
      seed: this.seed,
      turn: this.turn,
      week: this.week,
      weekOfSeason: this.weekOfSeason,
      weekOfYear: this.weekOfYear,
      year: this.year,
      season: this.season,
      coins: this.coins,
      food: this.food,
      wood: this.wood,
      inputStock: { ...this.inputStock },
      coffeeStock: this.coffeeStock,
      coffeeGrades: cloneGrades(this.coffeeGrades),
      coffeeCapacity: this.coffeeCapacity(),
      coffeePrice: this.coffeePrice,
      reputation: this.reputation(),
      status: this.status,
      setup: this.setup,
      terrain: this.terrain.slice(),
      buildings: this.buildings.slice(),
      coffee: this.coffee.slice(),
      families: this.families.map(cloneFamily),
      people: this.people.map(clonePerson),
      sites: this.sites.map(cloneSite),
      structures: this.structures.map(cloneStructure),
      coffeeLots: this.coffeeLots.map(cloneCoffeeLot),
      roadPlan: this.roadPlan.map((tile) => ({ ...tile })),
      yearEvent: this.yearEvent,
      lastReport: cloneReport(this.lastReport),
      stats: this.stats(),
    };
  }

  stats(): SitioStats {
    return {
      name: this.name,
      seed: this.seed,
      turn: this.turn,
      year: this.year,
      season: this.season,
      families: this.families.length,
      coins: this.coins,
      food: this.food,
      wood: this.wood,
      inputStock: { ...this.inputStock },
      coffeeStock: this.coffeeStock,
      coffeeGrades: cloneGrades(this.coffeeGrades),
      coffeeCapacity: this.coffeeCapacity(),
      coffeePrice: this.coffeePrice,
      roadQueue: this.roadPlan.length,
      reputation: this.reputation(),
      status: this.status,
      ...this.totals,
    };
  }

  meta(savedAt: string): SitioMeta {
    return {
      name: this.name,
      seed: this.seed,
      turn: this.turn,
      year: this.year,
      season: this.season,
      families: this.families.length,
      coins: this.coins,
      savedAt,
    };
  }

  hash(): string {
    const hash = new Fnv1a()
      .string(this.name)
      .string(this.seed)
      .string(this.status)
      .string(this.setup ?? '')
      .string(this.yearEvent)
      .int32s([
        this.turn,
        this.coins,
        this.food,
        this.wood,
        this.inputStock.fertilizer,
        this.inputStock.limestone,
        this.coffeeStock,
        this.coffeeGrades.bad,
        this.coffeeGrades.medium,
        this.coffeeGrades.good,
        this.coffeePrice,
        this.weekSold,
        this.weekRevenue,
      ])
      .bytes(this.terrain)
      .bytes(this.buildings)
      .bytes(this.coffee)
      .int32s([
        this.totals.harvestTotal,
        this.totals.revenueTotal,
        this.totals.builtTotal,
        this.totals.arrivalsTotal,
        this.totals.departuresTotal,
      ]);
    for (const family of this.families) {
      hash.string(family.name).int32s([family.id, family.houseX, family.houseY, family.morale]);
    }
    for (const person of this.people) {
      hash
        .string(person.name)
        .int32s([
          person.id,
          person.age,
          person.familyId,
          person.education ? 1 : 0,
          person.educationProgress,
        ]);
      this.hashTask(hash, person.morning);
      this.hashTask(hash, person.afternoon);
    }
    for (const site of this.sites) {
      hash
        .string(site.kind)
        .int32s([site.id, site.x, site.y, site.w, site.h, site.progress, site.required]);
    }
    for (const structure of this.structures) {
      hash
        .string(structure.kind)
        .int32s([structure.id, structure.x, structure.y, structure.w, structure.h]);
    }
    for (const lot of this.coffeeLots) {
      hash.int32s([
        lot.id,
        lot.x,
        lot.y,
        lot.w,
        lot.h,
        lot.fertilized ? 1 : 0,
        lot.limed ? 1 : 0,
      ]);
    }
    for (const tile of this.roadPlan) {
      hash.int32s([tile.x, tile.y]);
    }
    return hash.hex();
  }

  private hashTask(hash: Fnv1a, task: WorkTask): void {
    hash.string(task.kind);
    if (task.kind === 'build') hash.int32s([task.siteId]);
    if (
      task.kind === 'plant' ||
      task.kind === 'clear' ||
      task.kind === 'fertilize' ||
      task.kind === 'limestone'
    ) {
      hash.int32s([task.x, task.y]);
    }
  }

  private assign(personId: number, period: Period, task: WorkTask): SitioCommandResult {
    if (this.setup) return { ok: false, reason: 'setup' };
    const person = this.personById(personId);
    if (!person) return { ok: false, reason: 'no-person' };
    if (period !== 'morning' && period !== 'afternoon') {
      return { ok: false, reason: 'invalid-task' };
    }
    if (person.age < 16) {
      if (task.kind === 'study') {
        if (person.age < SCHOOL_AGE) return { ok: false, reason: 'invalid-task' };
        if (!this.hasBuilding('escola')) return { ok: false, reason: 'no-school' };
        if (person.education) return { ok: false, reason: 'invalid-task' };
      } else if (task.kind !== 'idle' && task.kind !== 'rest' && task.kind !== 'yard') {
        return { ok: false, reason: 'not-adult' };
      }
      if (period === 'morning') person.morning = cloneTask(task);
      else person.afternoon = cloneTask(task);
      return { ok: true };
    }
    if (task.kind === 'study') return { ok: false, reason: 'invalid-task' };
    const invalid = this.validateTask(person, task);
    if (invalid) return { ok: false, reason: invalid };
    if (period === 'morning') person.morning = cloneTask(task);
    else person.afternoon = cloneTask(task);
    return { ok: true };
  }

  private validateTask(person: Person, task: WorkTask): SitioCommandReason | null {
    if (task.kind === 'idle' || task.kind === 'rest' || task.kind === 'yard' || task.kind === 'coffee') {
      return null;
    }
    if (task.kind === 'build') {
      if (!this.siteById(task.siteId)) return 'no-site';
      return null;
    }
    if (task.kind === 'road') return null;
    if (task.kind === 'study') return 'invalid-task';
    if (task.kind === 'fertilize' || task.kind === 'limestone') {
      if (!this.inBounds(task.x, task.y)) return 'oob';
      if (this.coffeeAt(task.x, task.y) === COFFEE_NONE) return 'invalid-task';
      const lot = this.lotAt(task.x, task.y);
      if (!lot) return 'invalid-task';
      if (task.kind === 'fertilize' && lot.fertilized) return 'invalid-task';
      if (task.kind === 'limestone' && lot.limed) return 'invalid-task';
      if (task.kind === 'fertilize' && this.inputStock.fertilizer < 1) return 'no-input';
      if (task.kind === 'limestone' && this.inputStock.limestone < 1) return 'no-input';
      return null;
    }
    if (!this.inBounds(task.x, task.y)) return 'oob';
    if (task.kind === 'plant') {
      const terrain = this.terrain[this.index(task.x, task.y)];
      if (terrain === TERRAIN_ROAD) return 'road';
      if (terrain !== TERRAIN_TERRA) return 'mata';
      if (this.buildingAt(task.x, task.y) !== BUILDING_NONE) return 'occupied';
      if (this.coffeeAt(task.x, task.y) !== COFFEE_NONE) return 'occupied';
      if (this.siteAt(task.x, task.y)) return 'occupied';
      if (this.otherTaskAt('plant', task.x, task.y, person.id)) return 'reserved';
      if (this.coins < 1) return 'no-coins';
      return null;
    }
    const terrain = this.terrain[this.index(task.x, task.y)];
    if (terrain === TERRAIN_ROAD) return 'road';
    if (terrain !== TERRAIN_MATA) return 'invalid-task';
    if (this.buildingAt(task.x, task.y) !== BUILDING_NONE) return 'occupied';
    if (this.coffeeAt(task.x, task.y) !== COFFEE_NONE) return 'occupied';
    if (this.siteAt(task.x, task.y)) return 'occupied';
    if (this.otherTaskAt('clear', task.x, task.y, person.id)) return 'reserved';
    return null;
  }

  private otherTaskAt(kind: 'plant' | 'clear', x: number, y: number, personId: number): boolean {
    for (const person of this.people) {
      if (person.id === personId) continue;
      for (const task of [person.morning, person.afternoon]) {
        if (task.kind === kind && task.x === x && task.y === y) return true;
      }
    }
    return false;
  }

  canPlaceBuilding(kind: BuildingKind, x: number, y: number): SitioCommandResult {
    if (this.setup) return { ok: false, reason: 'setup' };
    const spec = BUILDING_SPECS[kind];
    if (!spec) return { ok: false, reason: 'invalid-task' };
    if (spec.unique && this.hasBuildingOrSite(kind)) {
      return { ok: false, reason: 'unique' };
    }
    for (const required of spec.prereq ?? []) {
      if (!this.hasBuilding(required)) return { ok: false, reason: 'prereq' };
    }
    const footprint = footprintOfBuilding(BUILDING_IDS[kind]);
    for (let yy = y; yy < y + footprint.h; yy++) {
      for (let xx = x; xx < x + footprint.w; xx++) {
        if (!this.inBounds(xx, yy)) return { ok: false, reason: 'oob' };
        const terrain = this.terrain[this.index(xx, yy)];
        if (terrain === TERRAIN_ROAD) return { ok: false, reason: 'road' };
        if (terrain !== TERRAIN_TERRA) {
          return { ok: false, reason: 'mata' };
        }
        if (this.buildingAt(xx, yy) !== BUILDING_NONE) {
          return { ok: false, reason: 'occupied' };
        }
        if (this.coffeeAt(xx, yy) !== COFFEE_NONE) {
          return { ok: false, reason: 'occupied' };
        }
        if (this.siteAt(xx, yy)) return { ok: false, reason: 'occupied' };
      }
    }
    if (this.coins < spec.coins) return { ok: false, reason: 'no-coins' };
    if (this.wood < spec.wood) return { ok: false, reason: 'no-wood' };
    return { ok: true };
  }

  private placeBuilding(kind: BuildingKind, x: number, y: number): SitioCommandResult {
    const check = this.canPlaceBuilding(kind, x, y);
    if (!check.ok) return check;
    const spec = BUILDING_SPECS[kind];
    const footprint = footprintOfBuilding(BUILDING_IDS[kind]);
    this.coins -= spec.coins;
    this.wood -= spec.wood;
    const site: Site = {
      id: this.nextSiteId++,
      kind,
      x,
      y,
      w: footprint.w,
      h: footprint.h,
      progress: 0,
      required: spec.days,
    };
    this.sites.push(site);
    return { ok: true, siteId: site.id };
  }

  private sellCoffee(grade: CoffeeGrade, amount: number): SitioCommandResult {
    if (this.setup) return { ok: false, reason: 'setup' };
    if (!COFFEE_GRADES.includes(grade)) return { ok: false, reason: 'invalid-task' };
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, reason: 'invalid-amount' };
    }
    if (amount > this.coffeeGrades[grade]) return { ok: false, reason: 'no-stock' };
    const revenue = amount * this.priceForGrade(grade);
    this.coffeeGrades[grade] -= amount;
    this.coffeeStock -= amount;
    this.coins += revenue;
    this.weekSold += amount;
    this.weekRevenue += revenue;
    this.totals.revenueTotal += revenue;
    return { ok: true };
  }

  private buyWood(amount: number): SitioCommandResult {
    if (this.setup) return { ok: false, reason: 'setup' };
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, reason: 'invalid-amount' };
    }
    const cost = amount * WOOD_BUY_PRICE;
    if (this.coins < cost) return { ok: false, reason: 'no-coins' };
    this.coins -= cost;
    this.wood += amount;
    return { ok: true };
  }

  private endWeek(): void {
    const season = this.season;
    const year = this.year;
    const report: SeasonReport = {
      turn: this.turn,
      week: this.turn + 1,
      year,
      season,
      harvest: 0,
      lost: 0,
      sold: 0,
      stock: 0,
      revenue: 0,
      price: this.salePrice(),
      foodProduced: 0,
      foodConsumed: 0,
      foodBought: 0,
      foodSold: 0,
      planted: 0,
      cleared: 0,
      studied: 0,
      educated: 0,
      roads: 0,
      fertilized: 0,
      limed: 0,
      harvestGrades: emptyGrades(),
      arrivals: 0,
      departures: 0,
      stalledCoffee: 0,
      completed: [],
      event: 'none',
      hunger: false,
      morale: [],
    };

    const lastWeekOfSeason = this.weekOfSeason === WEEKS_PER_SEASON;
    let eventThisSeason: YearEvent = 'none';
    if (lastWeekOfSeason) {
      if (season === 'summer' && this.yearEvent === 'drought') {
        eventThisSeason = 'drought';
        this.yearEvent = 'none';
      } else if (season === 'winter' && this.yearEvent === 'frost') {
        eventThisSeason = 'frost';
        this.yearEvent = 'none';
        this.applyFrost();
      }
    }
    report.event = eventThisSeason;

    const yardYield = YARD_FOOD_PER_PERIOD - (eventThisSeason === 'drought' ? 1 : 0);
    let coffeePeriods = 0;
    let childFoodProduced = 0;

    for (const period of ['morning', 'afternoon'] as Period[]) {
      for (const person of this.people) {
        const task = period === 'morning' ? person.morning : person.afternoon;
        if (person.age < 16) {
          if (task.kind === 'yard') {
            const childYield = Math.floor(Math.max(0, yardYield) / 2);
            report.foodProduced += childYield;
            childFoodProduced += childYield;
          } else if (task.kind === 'study' && !person.education && this.hasBuilding('escola')) {
            person.educationProgress = Math.min(
              EDUCATION_PERIODS,
              person.educationProgress + 1,
            );
            report.studied++;
            if (person.educationProgress >= EDUCATION_PERIODS) {
              person.education = true;
              report.educated++;
            }
          }
          continue;
        }
        if (task.kind === 'study') continue;
        const units = person.education ? 2 : 1;
        switch (task.kind) {
          case 'yard':
            report.foodProduced +=
              Math.max(0, yardYield) + (person.education ? 1 : 0);
            break;
          case 'coffee':
            coffeePeriods += units;
            break;
          case 'build': {
            const site = this.siteById(task.siteId);
            if (!site) break;
            site.progress += units;
            if (site.progress >= site.required) this.completeSite(site, report);
            break;
          }
          case 'plant':
            if (this.plantCoffee(task.x, task.y)) {
              this.coins -= 1;
              report.planted++;
            }
            break;
          case 'clear':
            if (this.clearMata(task.x, task.y)) {
              this.wood += WOOD_PER_CLEAR;
              report.cleared++;
            }
            break;
          case 'fertilize':
          case 'limestone':
            this.applyInput(task, report);
            break;
          case 'road':
          case 'idle':
          case 'rest':
            break;
        }
      }
    }

    this.buildPlannedRoads(report);

    if (season !== 'autumn') this.growCoffee(report, coffeePeriods);
    else this.harvest(report, coffeePeriods);

    const capacity = this.coffeeCapacity();
    this.storeHarvest(report, capacity);
    report.sold = this.weekSold;
    report.revenue = this.weekRevenue;
    report.price = this.salePrice();

    this.feedFamilies(report, childFoodProduced);

    const leaving = this.families.filter((family) => family.morale <= 0);
    if (leaving.length > 0) {
      const leavingIds = new Set(leaving.map((family) => family.id));
      this.families = this.families.filter((family) => !leavingIds.has(family.id));
      this.people = this.people.filter((person) => !leavingIds.has(person.familyId));
      report.departures = leaving.length;
    }

    if (lastWeekOfSeason) this.arriveFamily(report);

    this.totals.harvestTotal += report.harvest;
    this.totals.builtTotal += report.completed.length;
    this.totals.arrivalsTotal += report.arrivals;
    this.totals.departuresTotal += report.departures;
    this.lastReport = report;
    this.weekSold = 0;
    this.weekRevenue = 0;

    if (this.families.length < 1) {
      this.status = 'lost';
      return;
    }

    if (this.turn >= FINAL_TURN - 1) {
      this.status = this.isVillage() ? 'won' : 'ended';
      return;
    }

    this.turn++;
    if (this.turn % TURNS_PER_YEAR === 0) {
      this.agePeople();
      this.coffeePrice = COFFEE_BASE_PRICE + this.rng.int(3);
      this.yearEvent = this.turn >= TURNS_PER_YEAR ? this.rollYearEvent() : 'none';
    }
  }

  private agePeople(): void {
    for (const person of this.people) {
      person.age++;
      if (person.age === 16) {
        if (person.morning.kind === 'study' || person.morning.kind === 'idle' || person.morning.kind === 'rest') {
          person.morning = { kind: 'yard' };
        }
        if (person.afternoon.kind === 'study' || person.afternoon.kind === 'idle' || person.afternoon.kind === 'rest') {
          person.afternoon = { kind: 'yard' };
        }
      }
    }
  }

  private rollYearEvent(): YearEvent {
    const roll = this.rng.int(3);
    if (roll === 1) return 'frost';
    if (roll === 2) return 'drought';
    return 'none';
  }

  private applyFrost(): void {
    const mature: number[] = [];
    for (let i = 0; i < this.coffee.length; i++) {
      if (this.coffee[i] === COFFEE_MATURE) mature.push(i);
    }
    const losses = Math.min(FROST_LOSS, mature.length);
    for (let i = 0; i < losses; i++) {
      const pick = this.rng.int(mature.length);
      const index = mature.splice(pick, 1)[0];
      if (index !== undefined) this.coffee[index] = COFFEE_MUDA;
    }
  }

  private applyInput(
    task: Extract<WorkTask, { kind: 'fertilize' | 'limestone' }>,
    report: SeasonReport,
  ): void {
    const lot = this.lotAt(task.x, task.y);
    if (!lot) return;
    if (task.kind === 'fertilize') {
      if (lot.fertilized || this.inputStock.fertilizer < 1) return;
      lot.fertilized = true;
      this.inputStock.fertilizer--;
      report.fertilized++;
    } else {
      if (lot.limed || this.inputStock.limestone < 1) return;
      lot.limed = true;
      this.inputStock.limestone--;
      report.limed++;
    }
  }

  private buildPlannedRoads(report: SeasonReport): void {
    const workers = this.people.filter(
      (person) =>
        person.age >= 16 &&
        (person.morning.kind === 'road' || person.afternoon.kind === 'road'),
    );
    for (let worker = 0; worker < workers.length; worker++) {
      for (let built = 0; built < ROAD_TILES_PER_WEEK; built++) {
        const tile = this.roadPlan.shift();
        if (!tile) return;
        if (!this.inBounds(tile.x, tile.y)) continue;
        const index = this.index(tile.x, tile.y);
        if (this.terrain[index] !== TERRAIN_TERRA) continue;
        if (this.buildingAt(tile.x, tile.y) !== BUILDING_NONE) continue;
        if (this.coffeeAt(tile.x, tile.y) !== COFFEE_NONE) continue;
        if (this.siteAt(tile.x, tile.y)) continue;
        this.terrain[index] = TERRAIN_ROAD;
        report.roads++;
      }
    }
  }

  private storeHarvest(report: SeasonReport, capacity: number): void {
    for (const grade of COFFEE_GRADES) {
      const room = Math.max(0, capacity - this.coffeeStock);
      const kept = Math.min(report.harvestGrades[grade], room);
      this.coffeeGrades[grade] += kept;
      this.coffeeStock += kept;
      report.lost += report.harvestGrades[grade] - kept;
    }
    report.stock = this.coffeeStock;
  }

  private harvest(report: SeasonReport, periods: number): void {
    if (periods <= 0) return;
    const mature: number[] = [];
    for (let i = 0; i < this.coffee.length; i++) {
      if (this.coffee[i] === COFFEE_MATURE) mature.push(i);
    }
    const take = Math.min(mature.length, periods * COFFEE_CELLS_PER_PERIOD);
    const harvestedLots = new Set<number>();
    for (let i = 0; i < take; i++) {
      const index = mature[i];
      if (index === undefined) continue;
      const x = index % SITIO_SIZE;
      const y = Math.floor(index / SITIO_SIZE);
      const lot = this.lotAt(x, y);
      const yieldAmount = HARVEST_YIELD + (lot?.fertilized ? 1 : 0);
      const grade = this.gradeForQuality(
        lot ? this.lotQuality(lot) : COFFEE_QUALITY_BASE,
      );
      this.coffee[index] = COFFEE_FORMING;
      report.harvest += yieldAmount;
      report.harvestGrades[grade] += yieldAmount;
      if (lot) harvestedLots.add(lot.id);
    }
    for (const lot of this.coffeeLots) {
      if (harvestedLots.has(lot.id)) {
        lot.fertilized = false;
        lot.limed = false;
      }
    }
  }

  private growCoffee(report: SeasonReport, periods: number): void {
    const growing: number[] = [];
    for (let i = 0; i < this.coffee.length; i++) {
      const stage = this.coffee[i] ?? COFFEE_NONE;
      if (stage >= COFFEE_MUDA && stage < COFFEE_MATURE) growing.push(i);
    }
    const grown = Math.min(growing.length, Math.max(0, periods) * COFFEE_CELLS_PER_PERIOD);
    report.stalledCoffee = (growing.length - grown) * COFFEE_PES_PER_CELL;
    for (let i = 0; i < grown; i++) {
      const index = growing[i];
      if (index === undefined) continue;
      this.coffee[index] = (this.coffee[index] ?? COFFEE_NONE) + 1;
    }
  }

  private plantCoffee(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    if (this.terrain[this.index(x, y)] !== TERRAIN_TERRA) return false;
    if (this.buildingAt(x, y) !== BUILDING_NONE) return false;
    if (this.coffeeAt(x, y) !== COFFEE_NONE) return false;
    if (this.siteAt(x, y)) return false;
    if (this.coins < 1) return false;
    this.coffee[this.index(x, y)] = COFFEE_MUDA;
    return true;
  }

  private clearMata(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    if (this.terrain[this.index(x, y)] !== TERRAIN_MATA) return false;
    if (this.buildingAt(x, y) !== BUILDING_NONE) return false;
    if (this.coffeeAt(x, y) !== COFFEE_NONE) return false;
    if (this.siteAt(x, y)) return false;
    this.terrain[this.index(x, y)] = TERRAIN_TERRA;
    return true;
  }

  private completeSite(site: Site, report: SeasonReport): void {
    const id = BUILDING_IDS[site.kind];
    for (let y = site.y; y < site.y + site.h; y++) {
      for (let x = site.x; x < site.x + site.w; x++) {
        this.buildings[this.index(x, y)] = id;
      }
    }
    this.structures.push({
      id: this.nextStructureId++,
      kind: site.kind,
      x: site.x,
      y: site.y,
      w: site.w,
      h: site.h,
    });
    this.sites = this.sites.filter((candidate) => candidate.id !== site.id);
    report.completed.push(site.kind);
    if (site.kind === 'capela') {
      for (const family of this.families) {
        const from = family.morale;
        family.morale = Math.min(MORALE_MAX, family.morale + 1);
        if (family.morale !== from) {
          report.morale.push({ id: family.id, from, to: family.morale });
        }
      }
    }
  }

  private feedFamilies(report: SeasonReport, childFoodProduced = 0): void {
    const need = this.families.length * FAMILY_NEED;
    const total = this.food + report.foodProduced;
    const childFood = Math.min(Math.max(0, childFoodProduced), total);
    const childForNeed = Math.min(childFood, need);
    const otherFood = total - childFood;
    const otherConsumed = Math.min(otherFood, Math.max(0, need - childForNeed));
    const consumed = childForNeed + otherConsumed;
    const food = otherFood - otherConsumed;
    report.foodConsumed = consumed;
    let short = need - consumed;
    if (short > 0) {
      const bought = Math.min(short, this.coins);
      this.coins -= bought;
      report.foodBought = bought;
      short -= bought;
    }
    if (short > 0) {
      report.hunger = true;
      for (const family of this.families) {
        const from = family.morale;
        family.morale = Math.max(0, family.morale - 1);
        if (family.morale !== from) {
          report.morale.push({ id: family.id, from, to: family.morale });
        }
      }
    }
    const surplus = Math.max(0, food - FOOD_CAP);
    this.food = food - surplus;
    if (surplus > 0) {
      this.coins += surplus;
      report.foodSold = surplus;
    }
  }

  private createInitialFamily(houseX: number, houseY: number): void {
    const family: Family = {
      id: this.nextFamilyId++,
      name: FAMILY_NAMES[0] ?? 'Família 1',
      houseX,
      houseY,
      morale: MORALE_START,
    };
    this.families.push(family);
    this.addPerson(family, PERSON_NAMES[0] ?? 'João', 34, true);
    this.addPerson(family, PERSON_NAMES[1] ?? 'Maria', 32, true);
    this.addPerson(family, PERSON_NAMES[2] ?? 'Ana', 15, false);
    this.addPerson(family, PERSON_NAMES[3] ?? 'Pedro', 13, false);
  }

  private addPerson(family: Family, given: string, age: number, adult: boolean): void {
    this.people.push({
      id: this.nextPersonId++,
      name: `${given} ${family.name}`,
      age,
      familyId: family.id,
      education: false,
      educationProgress: 0,
      morning: adult ? { kind: 'yard' } : { kind: 'idle' },
      afternoon: adult ? { kind: 'yard' } : { kind: 'idle' },
    });
  }

  private arriveFamily(report: SeasonReport): void {
    if (this.reputation() < ARRIVAL_REPUTATION) return;
    const empty = this.findEmptyHouse();
    if (!empty) return;
    const id = this.nextFamilyId;
    const family: Family = {
      id,
      name: FAMILY_NAMES[(id - 1) % FAMILY_NAMES.length] ?? `Família ${id}`,
      houseX: empty.x,
      houseY: empty.y,
      morale: MORALE_START,
    };
    this.nextFamilyId++;
    this.families.push(family);
    const offset = ((id - 1) * 4) % PERSON_NAMES.length;
    this.addPerson(family, PERSON_NAMES[offset] ?? 'João', 30, true);
    this.addPerson(family, PERSON_NAMES[(offset + 1) % PERSON_NAMES.length] ?? 'Maria', 28, true);
    this.addPerson(family, PERSON_NAMES[(offset + 2) % PERSON_NAMES.length] ?? 'Ana', 14, false);
    this.addPerson(family, PERSON_NAMES[(offset + 3) % PERSON_NAMES.length] ?? 'Pedro', 12, false);
    report.arrivals = 1;
  }

  private findEmptyHouse(): { x: number; y: number } | null {
    for (const structure of this.structures) {
      if (structure.kind !== 'house') continue;
      const occupied = this.families.some(
        (family) => family.houseX === structure.x && family.houseY === structure.y,
      );
      if (!occupied) return { x: structure.x, y: structure.y };
    }
    return null;
  }

  private isVillage(): boolean {
    return (
      this.families.length >= WIN_FAMILIES &&
      this.hasBuilding('capela') &&
      this.hasBuilding('escola') &&
      this.hasBuilding('venda') &&
      this.families.every((family) => family.morale >= 2)
    );
  }
}
