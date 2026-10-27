import {
  BUILDING_HOUSE,
  BUILDING_IDS,
  BUILDING_SEDE,
  BUILDING_TERREIRO,
  COFFEE_FORMING,
  COFFEE_MATURE,
  COFFEE_MUDA,
  COFFEE_PES_PER_CELL,
  SITIO_SIZE,
  SitioEngine,
  TERRAIN_TERRA,
  decodeSitioSave,
  encodeSitioSave,
  type BuildingKind,
  type Family,
  type Period,
  type SeasonReport,
  type WorkTask,
} from '@sitio/sim';
import { stringifySave } from '@shell/kernel';
import { describe, expect, it } from 'vitest';

function create(seed = 'sitio'): SitioEngine {
  return SitioEngine.create({ name: 'Sítio', seed });
}

function place(engine: SitioEngine, kind: 'sede' | 'house' | 'terreiro' | 'coffee', x: number, y: number): void {
  expect(engine.execute({ type: 'placeStarter', kind, x, y }).ok).toBe(true);
}

function setup(engine: SitioEngine): SitioEngine {
  place(engine, 'sede', 6, 2);
  place(engine, 'house', 3, 5);
  place(engine, 'terreiro', 9, 9);
  place(engine, 'coffee', 6, 6);
  return engine;
}

function adults(engine: SitioEngine) {
  return engine.people.filter((person) => person.age >= 16);
}

function assignAll(engine: SitioEngine, task: WorkTask): void {
  for (const person of adults(engine)) {
    for (const period of ['morning', 'afternoon'] as Period[]) {
      expect(engine.execute({ type: 'assign', personId: person.id, period, task }).ok).toBe(true);
    }
  }
}

function endWeek(engine: SitioEngine): SeasonReport {
  expect(engine.execute({ type: 'endWeek' }).ok).toBe(true);
  expect(engine.lastReport).not.toBeNull();
  return engine.lastReport as SeasonReport;
}

function addBuilding(
  engine: SitioEngine,
  kind: BuildingKind,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const id = BUILDING_IDS[kind];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      engine.buildings[engine.index(xx, yy)] = id;
    }
  }
  engine.structures.push({ id: 500 + engine.structures.length, kind, x, y, w, h });
}

describe('SitioEngine', () => {
  it('starts in setup and creates the first family after placing the house', () => {
    const engine = create();
    expect(engine.setup).toBe('sede');
    expect(engine.families).toHaveLength(0);
    expect(engine.people).toHaveLength(0);
    expect(engine.coffeeLots).toHaveLength(0);
    expect(engine.coins).toBe(12);
    expect(engine.food).toBe(4);
    expect(engine.wood).toBe(4);
    expect(engine.execute({ type: 'endWeek' })).toEqual({ ok: false, reason: 'setup' });
    expect(engine.execute({ type: 'placeStarter', kind: 'house', x: 3, y: 5 })).toEqual({
      ok: false,
      reason: 'setup',
    });
    expect(engine.execute({ type: 'placeStarter', kind: 'sede', x: 0, y: 12 })).toEqual({
      ok: false,
      reason: 'road',
    });

    place(engine, 'sede', 6, 2);
    expect(engine.setup).toBe('house');
    place(engine, 'house', 3, 5);
    expect(engine.setup).toBe('terreiro');
    expect(engine.families).toHaveLength(1);
    expect(engine.people).toHaveLength(4);
    expect(adults(engine)).toHaveLength(2);
    expect(engine.people.filter((person) => person.age < 16)).toHaveLength(2);
    const family = engine.families[0] as Family;
    expect(family).toMatchObject({ houseX: 3, houseY: 5, morale: 3 });
    expect(adults(engine).every((person) => person.morning.kind === 'yard')).toBe(true);
    expect(adults(engine).every((person) => person.afternoon.kind === 'yard')).toBe(true);

    place(engine, 'terreiro', 9, 9);
    expect(engine.setup).toBe('coffee');
    place(engine, 'coffee', 6, 6);
    expect(engine.setup).toBeNull();
    expect(engine.coffeeLots).toHaveLength(1);
    expect(engine.coffeeLots[0]).toMatchObject({ x: 6, y: 6, w: 4, h: 2 });
    expect(engine.coffee.filter((stage) => stage === COFFEE_FORMING)).toHaveLength(8);
    expect(engine.coffee.filter((stage) => stage === COFFEE_FORMING).length * COFFEE_PES_PER_CELL).toBe(
      16,
    );
    expect(engine.buildingAt(6, 2)).toBe(BUILDING_SEDE);
    expect(engine.buildingAt(3, 5)).toBe(BUILDING_HOUSE);
    expect(engine.buildingAt(9, 9)).toBe(BUILDING_TERREIRO);
    expect(engine.structures).toHaveLength(3);
    expect(engine.execute({ type: 'endWeek' }).ok).toBe(true);
  });

  it('runs the first week from morning to afternoon and persists routines', () => {
    const engine = setup(create());
    const report = endWeek(engine);
    expect(report).toMatchObject({
      turn: 0,
      week: 1,
      year: 1,
      season: 'spring',
      foodProduced: 8,
      foodConsumed: 2,
      foodSold: 2,
      hunger: false,
    });
    expect(engine.turn).toBe(1);
    expect(engine.week).toBe(2);
    expect(engine.weekOfSeason).toBe(2);
    expect(engine.coins).toBe(14);
    expect(engine.food).toBe(8);
    expect(engine.coffee.filter((stage) => stage === COFFEE_FORMING)).toHaveLength(8);
    expect(adults(engine).every((person) => person.morning.kind === 'yard')).toBe(true);
    expect(adults(engine).every((person) => person.afternoon.kind === 'yard')).toBe(true);
  });

  it('grows and harvests the full 16-pé lot with two workers', () => {
    const engine = setup(create());
    assignAll(engine, { kind: 'coffee' });
    endWeek(engine);
    expect(engine.coffee.filter((stage) => stage === COFFEE_MATURE)).toHaveLength(8);

    for (let week = 0; week < 7; week++) {
      assignAll(engine, { kind: 'yard' });
      endWeek(engine);
    }
    assignAll(engine, { kind: 'coffee' });
    const report = endWeek(engine);
    expect(report.harvest).toBe(16);
    expect(report.lost).toBe(0);
    expect(report.sold).toBe(0);
    expect(report.stock).toBe(16);
    expect(report.revenue).toBe(0);
    expect(engine.coffee.filter((stage) => stage === COFFEE_MATURE)).toHaveLength(0);

    const coins = engine.coins;
    expect(engine.execute({ type: 'sellCoffee', grade: 'bad', amount: 16 })).toEqual({ ok: true });
    expect(engine.marketCart.bad).toBe(16);
    endWeek(engine);
    expect(engine.coffeeStock).toBe(0);
    expect(engine.coins).toBe(coins + 16);
  });

  it('lets one worker-period harvest only half of the lot', () => {
    const engine = setup(create());
    assignAll(engine, { kind: 'coffee' });
    endWeek(engine);
    expect(engine.coffee.filter((stage) => stage === COFFEE_MATURE)).toHaveLength(8);

    for (let week = 0; week < 7; week++) {
      assignAll(engine, { kind: 'yard' });
      endWeek(engine);
    }
    const people = adults(engine);
    const first = people[0];
    const second = people[1];
    if (!first || !second) throw new Error('missing adults');
    engine.execute({ type: 'assign', personId: first.id, period: 'morning', task: { kind: 'coffee' } });
    engine.execute({ type: 'assign', personId: first.id, period: 'afternoon', task: { kind: 'yard' } });
    engine.execute({ type: 'assign', personId: second.id, period: 'morning', task: { kind: 'yard' } });
    engine.execute({ type: 'assign', personId: second.id, period: 'afternoon', task: { kind: 'yard' } });
    const report = endWeek(engine);
    expect(report.harvest).toBe(8);
    expect(report.lost).toBe(0);
    expect(report.stock).toBe(8);
    expect(report.revenue).toBe(0);
    expect(engine.coffee.filter((stage) => stage === COFFEE_MATURE)).toHaveLength(4);

    const coins = engine.coins;
    expect(engine.execute({ type: 'sellCoffee', grade: 'bad', amount: 8 })).toEqual({ ok: true });
    expect(engine.marketCart.bad).toBe(8);
    assignAll(engine, { kind: 'idle' });
    endWeek(engine);
    expect(engine.coffeeStock).toBe(0);
    expect(engine.coins).toBe(coins + 8);
  });

  it('sells coffee only from stock and rejects invalid amounts', () => {
    const engine = setup(create());
    expect(engine.execute({ type: 'sellCoffee', grade: 'medium', amount: 1 })).toEqual({
      ok: false,
      reason: 'no-stock',
    });
    engine.coffeeStock = 5;
    engine.coffeeGrades.medium = 5;
    expect(engine.execute({ type: 'sellCoffee', grade: 'medium', amount: 0 })).toEqual({
      ok: false,
      reason: 'invalid-amount',
    });
    expect(engine.execute({ type: 'sellCoffee', grade: 'medium', amount: 1.5 })).toEqual({
      ok: false,
      reason: 'invalid-amount',
    });
    expect(engine.execute({ type: 'sellCoffee', grade: 'medium', amount: 6 })).toEqual({
      ok: false,
      reason: 'no-stock',
    });
    const coins = engine.coins;
    expect(engine.execute({ type: 'sellCoffee', grade: 'medium', amount: 2 })).toEqual({ ok: true });
    expect(engine.marketCart.medium).toBe(2);
    assignAll(engine, { kind: 'idle' });
    const report = endWeek(engine);
    expect(engine.coffeeStock).toBe(3);
    expect(engine.coins).toBe(coins + 4);
    expect(report.sold).toBe(2);
    expect(report.revenue).toBe(4);
    expect(engine.totals.revenueTotal).toBe(4);
  });

  it('caps coffee at the terreiro and tulha capacity', () => {
    const engine = setup(create());
    engine.coffeeStock = 14;
    engine.coffeeGrades.bad = 14;
    engine.turn = 8;
    for (let x = 6; x < 10; x++) {
      for (let y = 6; y < 8; y++) engine.coffee[engine.index(x, y)] = COFFEE_MATURE;
    }
    assignAll(engine, { kind: 'coffee' });
    const report = endWeek(engine);
    expect(report.harvest).toBe(16);
    expect(report.lost).toBe(14);
    expect(report.stock).toBe(16);
    expect(engine.coffeeStock).toBe(16);

    addBuilding(engine, 'tulha', 12, 10, 3, 3);
    expect(engine.coffeeCapacity()).toBe(22);
  });

  it('adds the venda bonus to the coffee price', () => {
    const engine = setup(create());
    addBuilding(engine, 'venda', 1, 9, 2, 1);
    assignAll(engine, { kind: 'coffee' });
    endWeek(engine);
    for (let week = 0; week < 7; week++) {
      assignAll(engine, { kind: 'yard' });
      endWeek(engine);
    }
    const lot = engine.coffeeLots[0];
    if (lot) lot.limed = true;
    assignAll(engine, { kind: 'coffee' });
    const report = endWeek(engine);
    expect(report.price).toBe(3);
    expect(report.stock).toBe(16);
    expect(report.revenue).toBe(0);
    expect(engine.execute({ type: 'sellCoffee', grade: 'medium', amount: 16 })).toEqual({ ok: true });
    expect(engine.marketCart.medium).toBe(16);
    const next = endWeek(engine);
    expect(engine.coffeeStock).toBe(0);
    expect(next.sold).toBe(16);
    expect(next.revenue).toBe(48);
    expect(next.price).toBe(3);
  });

  it('uses a 24x24 farm', () => {
    const engine = create();
    expect(SITIO_SIZE).toBe(24);
    expect(engine.terrain).toHaveLength(SITIO_SIZE * SITIO_SIZE);
    expect(engine.index(SITIO_SIZE - 1, SITIO_SIZE - 1)).toBe(SITIO_SIZE * SITIO_SIZE - 1);
  });

  it('builds a house with work periods and keeps the site progress', () => {
    const engine = setup(create());
    const built = engine.execute({ type: 'build', kind: 'house', x: 12, y: 1 });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(engine.coins).toBe(8);
    expect(engine.wood).toBe(2);
    expect(engine.sites).toHaveLength(1);
    expect(engine.sites[0]?.required).toBe(2);

    const people = adults(engine);
    const first = people[0];
    const second = people[1];
    if (!first || !second) throw new Error('missing adults');
    engine.execute({
      type: 'assign',
      personId: first.id,
      period: 'morning',
      task: { kind: 'build', siteId: built.siteId ?? 0 },
    });
    engine.execute({
      type: 'assign',
      personId: first.id,
      period: 'afternoon',
      task: { kind: 'build', siteId: built.siteId ?? 0 },
    });
    engine.execute({ type: 'assign', personId: second.id, period: 'morning', task: { kind: 'yard' } });
    engine.execute({ type: 'assign', personId: second.id, period: 'afternoon', task: { kind: 'yard' } });
    const report = endWeek(engine);

    expect(engine.sites).toHaveLength(0);
    expect(engine.buildingAt(12, 1)).toBe(BUILDING_HOUSE);
    expect(engine.buildingAt(13, 1)).toBe(BUILDING_HOUSE);
    expect(engine.buildingAt(12, 2)).toBe(BUILDING_HOUSE);
    expect(engine.buildingAt(13, 2)).toBe(BUILDING_HOUSE);
    expect(engine.countHouses()).toBe(2);
    expect(report.completed).toEqual(['house']);
    expect(engine.coins).toBe(8);
  });

  it('lets children work only in the yard', () => {
    const engine = setup(create());
    const child = engine.people.find((person) => person.age < 16);
    expect(child).toBeDefined();
    if (!child) return;
    expect(
      engine.execute({
        type: 'assign',
        personId: child.id,
        period: 'morning',
        task: { kind: 'coffee' },
      }),
    ).toEqual({ ok: false, reason: 'not-adult' });
    expect(
      engine.execute({
        type: 'assign',
        personId: child.id,
        period: 'morning',
        task: { kind: 'yard' },
      }).ok,
    ).toBe(true);
    expect(
      engine.execute({
        type: 'assign',
        personId: child.id,
        period: 'afternoon',
        task: { kind: 'yard' },
      }).ok,
    ).toBe(true);
  });

  it('gives children half yard output and no sellable surplus', () => {
    const engine = setup(create());
    assignAll(engine, { kind: 'idle' });
    const child = engine.people.find((person) => person.age < 16);
    if (!child) throw new Error('missing child');
    for (const period of ['morning', 'afternoon'] as Period[]) {
      expect(
        engine.execute({
          type: 'assign',
          personId: child.id,
          period,
          task: { kind: 'yard' },
        }).ok,
      ).toBe(true);
    }
    const report = endWeek(engine);
    expect(report.foodProduced).toBe(2);
    expect(report.foodConsumed).toBe(2);
    expect(report.foodSold).toBe(0);
    expect(engine.food).toBe(4);
    expect(engine.coins).toBe(12);
  });

  it('lets children study only after a school exists and graduate after four periods', () => {
    const engine = setup(create());
    const child = engine.people.find((person) => person.age < 16);
    expect(child).toBeDefined();
    if (!child) return;
    expect(
      engine.execute({
        type: 'assign',
        personId: child.id,
        period: 'morning',
        task: { kind: 'study' },
      }),
    ).toEqual({ ok: false, reason: 'no-school' });

    addBuilding(engine, 'escola', 20, 5, 2, 2);
    for (const period of ['morning', 'afternoon'] as Period[]) {
      expect(
        engine.execute({
          type: 'assign',
          personId: child.id,
          period,
          task: { kind: 'study' },
        }).ok,
      ).toBe(true);
    }
    const first = endWeek(engine);
    expect(first.studied).toBe(2);
    expect(child.education).toBe(false);
    expect(child.educationProgress).toBe(2);

    const second = endWeek(engine);
    expect(second.studied).toBe(2);
    expect(second.educated).toBe(1);
    expect(child.education).toBe(true);
    expect(child.educationProgress).toBe(4);
  });

  it('does not let adults study', () => {
    const engine = setup(create());
    const adult = adults(engine)[0];
    if (!adult) throw new Error('missing adult');
    addBuilding(engine, 'escola', 20, 5, 2, 2);
    expect(
      engine.execute({
        type: 'assign',
        personId: adult.id,
        period: 'morning',
        task: { kind: 'study' },
      }),
    ).toEqual({ ok: false, reason: 'invalid-task' });
  });

  it('gives educated workers double coffee and build output', () => {
    const engine = setup(create());
    engine.turn = 8;
    for (let x = 6; x < 10; x++) {
      for (let y = 6; y < 8; y++) engine.coffee[engine.index(x, y)] = COFFEE_MATURE;
    }
    const people = adults(engine);
    const educated = people[0];
    const other = people[1];
    if (!educated || !other) throw new Error('missing adults');
    educated.education = true;
    engine.execute({
      type: 'assign',
      personId: educated.id,
      period: 'morning',
      task: { kind: 'coffee' },
    });
    engine.execute({
      type: 'assign',
      personId: educated.id,
      period: 'afternoon',
      task: { kind: 'yard' },
    });
    engine.execute({
      type: 'assign',
      personId: other.id,
      period: 'morning',
      task: { kind: 'yard' },
    });
    engine.execute({
      type: 'assign',
      personId: other.id,
      period: 'afternoon',
      task: { kind: 'yard' },
    });
    const report = endWeek(engine);
    expect(report.harvest).toBe(16);
    expect(report.foodProduced).toBe(7);
  });

  it('ages people at the end of the year and turns a 16-year-old into a worker', () => {
    const engine = setup(create());
    const child = engine.people.find((person) => person.age === 15);
    expect(child).toBeDefined();
    if (!child) return;
    engine.turn = 15;
    endWeek(engine);
    const grown = engine.people.find((person) => person.id === child.id);
    expect(grown?.age).toBe(16);
    expect(grown?.morning).toEqual({ kind: 'yard' });
    expect(grown?.afternoon).toEqual({ kind: 'yard' });
  });

  it('collects wood when a forest tile is cleared', () => {
    const engine = setup(create());
    engine.wood = 0;
    const person = adults(engine)[0];
    if (!person) throw new Error('missing adult');
    expect(
      engine.execute({
        type: 'assign',
        personId: person.id,
        period: 'morning',
        task: { kind: 'clear', x: 1, y: 0 },
      }).ok,
    ).toBe(true);
    const report = endWeek(engine);
    expect(report.cleared).toBe(1);
    expect(engine.wood).toBe(2);
    expect(engine.terrain[engine.index(1, 0)]).toBe(TERRAIN_TERRA);
  });

  it('buys wood with coins and rejects invalid purchases', () => {
    const engine = setup(create());
    expect(engine.execute({ type: 'buyWood', amount: 3 })).toEqual({ ok: true });
    expect(engine.marketCart.wood).toBe(3);
    expect(engine.wood).toBe(4);
    expect(engine.coins).toBe(12);
    expect(engine.execute({ type: 'buyWood', amount: 0 })).toEqual({
      ok: false,
      reason: 'invalid-amount',
    });
    assignAll(engine, { kind: 'idle' });
    endWeek(engine);
    expect(engine.wood).toBe(7);
    expect(engine.coins).toBe(9);
    engine.coins = 0;
    expect(engine.execute({ type: 'buyWood', amount: 1 })).toEqual({
      ok: false,
      reason: 'no-coins',
    });
  });

  it('buys and applies fertilizer and limestone for a good graded harvest', () => {
    const engine = setup(create());
    expect(engine.execute({ type: 'buyInput', kind: 'fertilizer', amount: 2 })).toEqual({
      ok: true,
    });
    expect(engine.execute({ type: 'buyInput', kind: 'limestone', amount: 2 })).toEqual({
      ok: true,
    });
    expect(engine.marketCart.fertilizer).toBe(2);
    expect(engine.marketCart.limestone).toBe(2);
    expect(engine.coins).toBe(12);

    const people = adults(engine);
    const first = people[0];
    const second = people[1];
    if (!first || !second) throw new Error('missing adults');
    expect(
      engine.execute({
        type: 'assign',
        personId: first.id,
        period: 'morning',
        task: { kind: 'fertilize', x: 6, y: 6 },
      }).ok,
    ).toBe(true);
    expect(
      engine.execute({
        type: 'assign',
        personId: first.id,
        period: 'afternoon',
        task: { kind: 'limestone', x: 6, y: 6 },
      }).ok,
    ).toBe(true);
    const applied = endWeek(engine);
    expect(applied.fertilized).toBe(1);
    expect(applied.limed).toBe(1);
    expect(engine.inputStock).toEqual({ fertilizer: 1, limestone: 1 });
    expect(engine.coins).toBe(2);
    const lot = engine.coffeeLots[0];
    expect(lot?.fertilized).toBe(true);
    expect(lot?.limed).toBe(true);
    if (lot) expect(engine.lotQuality(lot)).toBe(80);

    engine.turn = 8;
    for (let x = 6; x < 10; x++) {
      for (let y = 6; y < 8; y++) engine.coffee[engine.index(x, y)] = COFFEE_MATURE;
    }
    assignAll(engine, { kind: 'coffee' });
    const harvest = endWeek(engine);
    expect(harvest.harvest).toBe(24);
    expect(harvest.harvestGrades.good).toBe(24);
    expect(harvest.lost).toBe(8);
    expect(engine.coffeeGrades.good).toBe(16);
    expect(lot?.fertilized).toBe(false);
    expect(lot?.limed).toBe(false);
  });

  it('reserves queued market purchases when paying for a building', () => {
    const engine = setup(create());
    expect(engine.execute({ type: 'buyInput', kind: 'fertilizer', amount: 2 })).toEqual({
      ok: true,
    });
    expect(engine.execute({ type: 'buyInput', kind: 'limestone', amount: 2 })).toEqual({
      ok: true,
    });
    expect(engine.coins).toBe(12);
    expect(engine.fullState().availableCoins).toBe(2);

    expect(engine.execute({ type: 'build', kind: 'house', x: 12, y: 1 })).toEqual({
      ok: false,
      reason: 'no-coins',
    });

    assignAll(engine, { kind: 'idle' });
    endWeek(engine);
    expect(engine.coins).toBe(2);
    expect(engine.inputStock).toEqual({ fertilizer: 2, limestone: 2 });
  });

  it('reserves queued market purchases when inviting a family', () => {
    const engine = setup(create());
    addBuilding(engine, 'house', 1, 9, 2, 2);
    expect(engine.execute({ type: 'buyInput', kind: 'fertilizer', amount: 2 })).toEqual({
      ok: true,
    });
    expect(engine.execute({ type: 'buyInput', kind: 'limestone', amount: 2 })).toEqual({
      ok: true,
    });

    expect(engine.execute({ type: 'inviteFamily' })).toEqual({
      ok: false,
      reason: 'no-coins',
    });
    assignAll(engine, { kind: 'idle' });
    endWeek(engine);
    expect(engine.coins).toBe(2);
    expect(engine.families).toHaveLength(1);
    expect(engine.inputStock).toEqual({ fertilizer: 2, limestone: 2 });
  });

  it('buys seedlings and plants a coffee lot with two adult periods', () => {
    const engine = setup(create());
    expect(engine.execute({ type: 'plantCoffeeLot', x: 10, y: 2 })).toEqual({
      ok: false,
      reason: 'no-seedlings',
    });
    expect(engine.execute({ type: 'buySeedlings', amount: 16 })).toEqual({ ok: true });
    expect(engine.marketCart.seedlings).toBe(16);
    expect(engine.coins).toBe(12);
    assignAll(engine, { kind: 'idle' });
    endWeek(engine);
    expect(engine.seedlings).toBe(16);
    expect(engine.coins).toBe(8);
    expect(engine.execute({ type: 'plantCoffeeLot', x: 10, y: 2 })).toEqual({ ok: true });
    expect(engine.seedlings).toBe(0);
    expect(engine.plantOrders).toHaveLength(1);
    const order = engine.plantOrders[0];
    if (!order) throw new Error('missing order');
    const person = adults(engine)[0];
    if (!person) throw new Error('missing adult');
    for (const period of ['morning', 'afternoon'] as Period[]) {
      expect(
        engine.execute({
          type: 'assign',
          personId: person.id,
          period,
          task: { kind: 'plantLot', orderId: order.id },
        }).ok,
      ).toBe(true);
    }
    const report = endWeek(engine);
    expect(report.planted).toBe(8);
    expect(engine.plantOrders).toHaveLength(0);
    expect(engine.coffeeLots).toHaveLength(2);
    expect(engine.coffee.filter((stage) => stage === COFFEE_MUDA)).toHaveLength(8);
  });

  it('records weekly income and expenses in history', () => {
    const engine = setup(create());
    expect(engine.execute({ type: 'buySeedlings', amount: 16 })).toEqual({ ok: true });
    expect(engine.execute({ type: 'buyWood', amount: 1 })).toEqual({ ok: true });
    endWeek(engine);
    expect(engine.history).toHaveLength(1);
    expect(engine.history[0]?.expenses).toBe(5);
    expect(engine.history[0]?.coins).toBe(engine.coins);
  });

  it('builds up to four planned roads per adult per week without cost', () => {
    const engine = setup(create());
    const coins = engine.coins;
    for (let x = 0; x < 5; x++) {
      expect(engine.execute({ type: 'planRoad', x, y: 1 })).toEqual({ ok: true });
    }
    expect(engine.roadPlan).toHaveLength(5);
    const person = adults(engine)[0];
    if (!person) throw new Error('missing adult');
    expect(
      engine.execute({
        type: 'assign',
        personId: person.id,
        period: 'morning',
        task: { kind: 'road' },
      }).ok,
    ).toBe(true);
    const report = endWeek(engine);
    expect(report.roads).toBe(4);
    expect(engine.roadPlan).toHaveLength(1);
    expect(engine.coins).toBe(coins);
    expect(engine.terrain[engine.index(0, 1)]).toBe(2);
    expect(engine.terrain[engine.index(3, 1)]).toBe(2);
    expect(engine.terrain[engine.index(4, 1)]).toBe(0);
  });

  it('requires wood, prerequisites and unique buildings', () => {
    const engine = setup(create());
    expect(engine.execute({ type: 'build', kind: 'venda', x: 1, y: 9 })).toEqual({
      ok: false,
      reason: 'prereq',
    });
    addBuilding(engine, 'tulha', 1, 1, 3, 3);
    const venda = engine.execute({ type: 'build', kind: 'venda', x: 1, y: 9 });
    expect(venda.ok).toBe(true);
    expect(engine.wood).toBe(2);
    expect(engine.coins).toBe(8);
    expect(engine.execute({ type: 'build', kind: 'venda', x: 4, y: 9 })).toEqual({
      ok: false,
      reason: 'unique',
    });

    engine.wood = 1;
    expect(engine.execute({ type: 'build', kind: 'house', x: 12, y: 1 })).toEqual({
      ok: false,
      reason: 'no-wood',
    });
  });

  it('previews building placement without mutating the farm', () => {
    const engine = setup(create());
    const coins = engine.coins;
    const wood = engine.wood;
    expect(engine.canPlaceBuilding('house', 12, 1)).toEqual({ ok: true });
    expect(engine.coins).toBe(coins);
    expect(engine.wood).toBe(wood);
    expect(engine.sites).toHaveLength(0);
    expect(engine.canPlaceBuilding('house', 12, 12)).toEqual({
      ok: false,
      reason: 'road',
    });
  });

  it('invites an unrelated family into an empty house', () => {
    const engine = setup(create());
    expect(engine.execute({ type: 'inviteFamily' })).toEqual({
      ok: false,
      reason: 'no-house',
    });
    addBuilding(engine, 'house', 12, 1, 2, 2);
    expect(engine.emptyHouseCount()).toBe(1);
    const family = engine.execute({ type: 'inviteFamily' });
    expect(family).toEqual({ ok: true });
    expect(engine.families).toHaveLength(2);
    expect(engine.people).toHaveLength(8);
    expect(engine.coins).toBe(8);
    expect(engine.emptyHouseCount()).toBe(0);
    expect(engine.execute({ type: 'inviteFamily' })).toEqual({
      ok: false,
      reason: 'no-house',
    });
  });

  it('welcomes one family per season when a house is empty and reputation is three', () => {
    const engine = setup(create());
    addBuilding(engine, 'venda', 1, 9, 2, 1);
    addBuilding(engine, 'escola', 11, 9, 2, 2);
    addBuilding(engine, 'capela', 13, 7, 1, 2);
    addBuilding(engine, 'house', 12, 1, 2, 2);
    expect(engine.reputation()).toBe(4);

    for (let week = 0; week < 4; week++) {
      assignAll(engine, { kind: 'yard' });
      endWeek(engine);
    }

    expect(engine.families).toHaveLength(2);
    expect(engine.people).toHaveLength(8);
    const newcomer = engine.families[1] as Family;
    expect(newcomer).toMatchObject({ houseX: 12, houseY: 1 });
    expect(engine.lastReport?.arrivals).toBe(1);
  });

  it('loses the farm when the last family leaves', () => {
    const engine = setup(create());
    engine.food = 0;
    engine.coins = 0;
    for (let week = 0; week < 3; week++) {
      assignAll(engine, { kind: 'idle' });
      endWeek(engine);
    }
    expect(engine.lastReport?.hunger).toBe(true);
    expect(engine.status).toBe('lost');
    expect(engine.families).toHaveLength(0);
    expect(engine.people).toHaveLength(0);
  });

  it('wins at the end of year three with six families and institutions', () => {
    const engine = setup(create());
    engine.turn = 47;
    addBuilding(engine, 'capela', 1, 1, 1, 2);
    addBuilding(engine, 'escola', 12, 1, 2, 2);
    addBuilding(engine, 'venda', 1, 9, 2, 1);
    engine.families = Array.from({ length: 6 }, (_, index) => ({
      id: 100 + index,
      name: `Família ${index + 1}`,
      houseX: index === 0 ? 3 : index === 1 ? 11 : 100 + index,
      houseY: index === 0 ? 5 : index === 1 ? 4 : 100 + index,
      morale: 3,
    }));
    engine.food = 100;
    engine.coins = 100;
    assignAll(engine, { kind: 'yard' });
    endWeek(engine);
    expect(engine.status).toBe('won');
  });

  it('preserves the setup state in a save', () => {
    const engine = create();
    place(engine, 'sede', 6, 2);
    place(engine, 'house', 3, 5);
    expect(engine.setup).toBe('terreiro');
    const text = stringifySave(
      encodeSitioSave(engine.serialize(), '2026-01-01T00:00:00.000Z'),
    );
    const decoded = decodeSitioSave(text);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.setup).toBe('terreiro');
    expect(decoded.snapshot.families).toHaveLength(1);
    expect(decoded.snapshot.people).toHaveLength(4);
    const restored = SitioEngine.fromSnapshot(decoded.snapshot);
    expect(restored.setup).toBe('terreiro');
    expect(restored.hash()).toBe(engine.hash());
  });

  it('round-trips the v22 save through the kernel envelope', () => {
    const engine = setup(create());
    assignAll(engine, { kind: 'coffee' });
    endWeek(engine);
    engine.coffeeStock = 4;
    engine.coffeeGrades.bad = 4;
    engine.wood = 7;
    engine.inputStock.fertilizer = 2;
    engine.seedlings = 8;
    const child = engine.people.find((person) => person.age < 16);
    if (child) child.educationProgress = 2;
    engine.execute({ type: 'sellCoffee', grade: 'bad', amount: 1 });
    const text = stringifySave(
      encodeSitioSave(engine.serialize(), '2026-01-01T00:00:00.000Z'),
    );
    const decoded = decodeSitioSave(text);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.meta.savedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(decoded.snapshot.setup).toBeNull();
    expect(decoded.snapshot.people).toHaveLength(4);
    expect(decoded.snapshot.people.some((person) => person.educationProgress === 2)).toBe(true);
    expect(decoded.snapshot.inputStock.fertilizer).toBe(2);
    expect(decoded.snapshot.seedlings).toBe(8);
    expect(decoded.snapshot.history).toHaveLength(1);
    expect(decoded.snapshot.coffeeStock).toBe(4);
    expect(decoded.snapshot.marketCart.bad).toBe(1);
    expect(decoded.snapshot.wood).toBe(7);
    expect(decoded.snapshot.weekSold).toBe(0);
    expect(decoded.snapshot.weekRevenue).toBe(0);
    const restored = SitioEngine.fromSnapshot(decoded.snapshot);
    expect(restored.hash()).toBe(engine.hash());
  });

  it('is deterministic for the same seed and commands', () => {
    const a = play('same');
    const b = play('same');
    expect(a.hash()).toBe(b.hash());
    expect(a.lastReport?.revenue).toBe(b.lastReport?.revenue);
  });
});

function play(seed: string): SitioEngine {
  const engine = setup(create(seed));
  assignAll(engine, { kind: 'coffee' });
  endWeek(engine);
  for (let week = 0; week < 7; week++) {
    assignAll(engine, { kind: 'yard' });
    endWeek(engine);
  }
  assignAll(engine, { kind: 'coffee' });
  endWeek(engine);
  return engine;
}
