import { BALANCE, type HistoryEntry } from '@city/shared';
import { START_YEAR } from '@city/simulation';
import { useEffect, useRef, useState } from 'react';
import { formatMoney, formatNumber, MONTHS, t } from '../i18n/pt-BR';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { drawLineChart, type ChartSeries } from './lineChart';
import { Panel } from './Panel';

type Tab = keyof typeof t.charts.tabs;
type SeriesKey = keyof typeof t.charts.series;

const TABS: Record<
  Tab,
  { keys: SeriesKey[]; format: (v: number) => string; includeZero?: boolean }
> = {
  people: { keys: ['population', 'jobs'], format: formatNumber },
  money: { keys: ['funds', 'revenue', 'expenses'], format: formatMoney },
  demand: { keys: ['demandR', 'demandC', 'demandI'], format: (v) => `${Math.round(v * 100)}%` },
  environment: { keys: ['pollution', 'crime', 'landValue'], format: formatNumber },
};

const COLORS: Record<SeriesKey, string> = {
  population: '#4ade80',
  jobs: '#60a5fa',
  funds: '#f0b429',
  revenue: '#4ade80',
  expenses: '#f87171',
  demandR: '#3fbf4f',
  demandC: '#3f7fdf',
  demandI: '#e0b030',
  pollution: '#a3a3a3',
  crime: '#f87171',
  landValue: '#38bdf8',
};

const RANGES = [12, 60, 0] as const;

function monthLabel(entry: HistoryEntry | undefined): string {
  if (!entry) return '';
  const perYear = BALANCE.clock.monthsPerYear;
  return `${MONTHS[entry.month % perYear]}/${String(START_YEAR + Math.floor(entry.month / perYear)).slice(2)}`;
}

export function ChartsPanel({ session }: { session: GameSession }) {
  const history = useStore(session.ui, (s) => s.history);
  const [tab, setTab] = useState<Tab>('people');
  const [range, setRange] = useState<(typeof RANGES)[number]>(60);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rows = range === 0 ? history : history.slice(-range);
  const config = TABS[tab];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const series: ChartSeries[] = config.keys.map((key) => ({
      label: t.charts.series[key],
      color: COLORS[key],
      values: rows.map((r) => r[key]),
    }));
    const draw = () =>
      drawLineChart(canvas, series, {
        format: config.format,
        xLabel: (i) => monthLabel(rows[i]),
        ...(config.includeZero === undefined ? {} : { includeZero: config.includeZero }),
      });
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [rows, config]);

  return (
    <Panel
      title={t.charts.title}
      testId="charts-panel"
      onClose={() => session.closePanel()}
      className="charts-panel"
    >
      <div className="tabs" role="tablist">
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`button ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
            data-testid={`chart-tab-${key}`}
          >
            {t.charts.tabs[key]}
          </button>
        ))}
        <span className="spacer" />
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={`button small ${range === r ? 'active' : ''}`}
            onClick={() => setRange(r)}
          >
            {t.charts.ranges[r]}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="muted">{t.charts.empty}</p>
      ) : (
        <>
          <canvas ref={canvasRef} className="chart-canvas" data-testid="chart-canvas" />
          <ul className="chart-legend">
            {config.keys.map((key) => (
              <li key={key}>
                <span className="swatch" style={{ background: COLORS[key] }} />
                {t.charts.series[key]}: <strong>{config.format(rows.at(-1)?.[key] ?? 0)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
