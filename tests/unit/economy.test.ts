import { BALANCE, PLACEABLE_SPECS, RejectReason } from '@city/shared';
import { buildTown, demandTargets, flatCity, type CityTotals } from '@city/simulation';
import { describe, expect, it } from 'vitest';

const NEUTRAL_TAXES = { residential: 7, commercial: 7, industrial: 7 };

function totals(residents: number, commercialJobs: number, industrialJobs: number): CityTotals {
  return {
    residents,
    housing: residents,
    workforce: BALANCE.demand.laborRate * residents,
    commercialJobs,
    industrialJobs,
    commercialWorkers: 0,
    industrialWorkers: 0,
    residentialQuality: 0.3,
    developedResidential: residents > 0 ? 10 : 0,
  };
}

describe('demand', () => {
  it('starts with residential and industrial demand in an empty city', () => {
    const d = demandTargets({
      totals: totals(0, 0, 0),
      taxes: NEUTRAL_TAXES,
      edgeConnected: false,
      crisis: 1,
    });
    expect(d.residential).toBeGreaterThan(0.3);
    expect(d.industrial).toBeGreaterThan(0.5);
  });

  it('falls with higher taxes and rises with available jobs', () => {
    const base = { totals: totals(500, 50, 80), edgeConnected: true, crisis: 1 };
    const normal = demandTargets({ ...base, taxes: NEUTRAL_TAXES });
    const high = demandTargets({
      ...base,
      taxes: { residential: 20, commercial: 20, industrial: 20 },
    });
    expect(high.residential).toBeLessThan(normal.residential);
    expect(high.commercial).toBeLessThan(normal.commercial);
    expect(high.industrial).toBeLessThan(normal.industrial);
    const moreJobs = demandTargets({
      ...base,
      totals: totals(500, 200, 300),
      taxes: NEUTRAL_TAXES,
    });
    expect(moreJobs.residential).toBeGreaterThan(normal.residential);
  });

  it('weakens industry during an economic crisis', () => {
    const base = { totals: totals(200, 20, 20), taxes: NEUTRAL_TAXES, edgeConnected: false };
    expect(demandTargets({ ...base, crisis: 0.6 }).industrial).toBeLessThan(
      demandTargets({ ...base, crisis: 1 }).industrial,
    );
  });
});

describe('economy', () => {
  it('collects more taxes at higher rates', () => {
    const revenueAt = (rate: number) => {
      const e = flatCity('tax', 64);
      buildTown(e);
      e.runMonths(18);
      for (const zone of ['residential', 'commercial', 'industrial'] as const)
        e.execute({ type: 'setTax', zone, rate });
      e.runMonths(1);
      const r = e.economy.lastMonth.revenue;
      return r.residential + r.commercial + r.industrial;
    };
    expect(revenueAt(12)).toBeGreaterThan(revenueAt(4));
  });

  it('declares bankruptcy after twelve months in debt and blocks construction', () => {
    const e = flatCity('debt', 32);
    e.execute({ type: 'road', x0: 0, y0: 5, x1: 31, y1: 5 });
    e.execute({ type: 'place', kind: 'hospital', x: 4, y: 7 });
    e.economy.funds = -1;
    e.runMonths(11);
    expect(e.economy.monthsInDebt).toBe(11);
    expect(e.economy.bankrupt).toBe(false);
    e.runMonths(1);
    expect(e.economy.bankrupt).toBe(true);
    expect(e.execute({ type: 'road', x0: 0, y0: 9, x1: 3, y1: 9 }).reason).toBe(
      RejectReason.Bankrupt,
    );
    e.economy.funds = 5000;
    e.runMonths(1);
    expect(e.economy.bankrupt).toBe(false);
    expect(e.economy.monthsInDebt).toBe(0);
  });

  it('scales department upkeep with funding', () => {
    const e = flatCity('funding', 32);
    e.execute({ type: 'place', kind: 'policeStation', x: 4, y: 4 });
    e.runMonths(1);
    expect(e.economy.lastMonth.expenses.police).toBe(PLACEABLE_SPECS.policeStation.upkeep);
    e.execute({ type: 'setFunding', department: 'police', value: 50 });
    e.runMonths(1);
    expect(e.economy.lastMonth.expenses.police).toBe(PLACEABLE_SPECS.policeStation.upkeep / 2);
  });
});
