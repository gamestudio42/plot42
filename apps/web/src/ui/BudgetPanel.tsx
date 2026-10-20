import { BALANCE, DEPARTMENTS, EXPENSE_CATEGORIES, type ZoneBuildingKind } from '@city/shared';
import { formatMoney, t } from '../i18n/pt-BR';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { Panel } from './Panel';

const ZONES: ZoneBuildingKind[] = ['residential', 'commercial', 'industrial'];

export function BudgetPanel({ session }: { session: GameSession }) {
  const stats = useStore(session.ui, (s) => s.stats);
  if (!stats) return null;
  const b = t.budget;
  const report = stats.lastMonth;
  const revenue = ZONES.reduce((sum, z) => sum + report.revenue[z], 0);
  const expenses = EXPENSE_CATEGORIES.reduce((sum, c) => sum + report.expenses[c], 0);

  return (
    <Panel
      title={b.title}
      testId="budget-panel"
      onClose={() => session.closePanel()}
      className="budget-panel"
    >
      {stats.bankrupt && <p className="alert bad">{b.bankrupt}</p>}
      {!stats.bankrupt && stats.monthsInDebt > 0 && (
        <p className="alert warn">{b.debtWarning(stats.monthsInDebt)}</p>
      )}
      <h3>{b.taxes}</h3>
      <p className="muted small">{b.taxHint}</p>
      {ZONES.map((zone) => (
        <label key={zone} className="slider-row">
          <span>{t.zones[zone]}</span>
          <input
            type="range"
            min={0}
            max={BALANCE.economy.taxMax}
            step={1}
            value={stats.taxes[zone]}
            onChange={(e) =>
              void session.command({ type: 'setTax', zone, rate: Number(e.target.value) })
            }
            data-testid={`tax-${zone}`}
          />
          <output>{stats.taxes[zone]}%</output>
        </label>
      ))}
      <h3>{b.funding}</h3>
      {DEPARTMENTS.map((department) => (
        <label key={department} className="slider-row">
          <span>{t.departments[department]}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={stats.funding[department]}
            onChange={(e) =>
              void session.command({
                type: 'setFunding',
                department,
                value: Number(e.target.value),
              })
            }
            data-testid={`funding-${department}`}
          />
          <output>{stats.funding[department]}%</output>
        </label>
      ))}
      <div className="budget-columns">
        <table className="ledger">
          <caption>{b.revenue}</caption>
          <tbody>
            {ZONES.map((z) => (
              <tr key={z}>
                <th>{t.zones[z]}</th>
                <td>{formatMoney(report.revenue[z])}</td>
              </tr>
            ))}
            <tr className="total">
              <th>Total</th>
              <td>{formatMoney(revenue)}</td>
            </tr>
          </tbody>
        </table>
        <table className="ledger">
          <caption>{b.expenses}</caption>
          <tbody>
            {EXPENSE_CATEGORIES.map((c) => (
              <tr key={c}>
                <th>{t.expenses[c]}</th>
                <td>{formatMoney(report.expenses[c])}</td>
              </tr>
            ))}
            <tr className="total">
              <th>Total</th>
              <td>{formatMoney(expenses)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <dl className="budget-summary">
        <dt>{b.construction}</dt>
        <dd>{formatMoney(report.construction)}</dd>
        <dt>{b.net}</dt>
        <dd className={report.net < 0 ? 'bad' : 'good'} data-testid="budget-net">
          {formatMoney(report.net)}
        </dd>
        <dt>{b.yearly}</dt>
        <dd className={report.net < 0 ? 'bad' : 'good'}>{formatMoney(report.net * 12)}</dd>
      </dl>
    </Panel>
  );
}
