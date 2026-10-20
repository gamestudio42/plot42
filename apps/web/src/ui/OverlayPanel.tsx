import { t } from '../i18n/pt-BR';
import {
  isGoodOverlay,
  POWER_ON_COLOR,
  UNSERVED_COLOR,
  WATER_ON_COLOR,
  type OverlayMode,
} from '../renderer/chunkDraw';
import { goodColor, heatColor } from '../renderer/palette';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { Panel } from './Panel';

const MODES: OverlayMode[] = [
  'none',
  'power',
  'water',
  'traffic',
  'pollution',
  'crime',
  'landValue',
  'access',
  'police',
  'fireCover',
  'health',
  'education',
];

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function gradient(scale: (v: number) => number): string {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((v) => `${cssColor(scale(v))} ${v * 100}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function Legend({ mode }: { mode: OverlayMode }) {
  const o = t.overlayPanel;
  if (mode === 'none') return null;
  if (mode === 'power' || mode === 'water') {
    const on = mode === 'power' ? POWER_ON_COLOR : WATER_ON_COLOR;
    return (
      <div className="legend" data-testid="overlay-legend">
        <span className="swatch" style={{ background: cssColor(on) }} /> {o.served}
        <span className="swatch" style={{ background: cssColor(UNSERVED_COLOR) }} /> {o.unserved}
      </div>
    );
  }
  return (
    <div className="legend" data-testid="overlay-legend">
      <span>{o.low}</span>
      <span
        className="legend-bar"
        style={{ background: gradient(isGoodOverlay(mode) ? goodColor : heatColor) }}
      />
      <span>{o.high}</span>
    </div>
  );
}

export function OverlayPanel({ session }: { session: GameSession }) {
  const overlay = useStore(session.ui, (s) => s.overlay);
  return (
    <Panel
      title={t.overlayPanel.title}
      testId="overlay-panel"
      onClose={() => session.closePanel()}
      className="overlay-panel"
    >
      <div className="overlay-grid">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`button ${overlay === mode ? 'active' : ''}`}
            onClick={() => session.setOverlay(mode)}
            aria-pressed={overlay === mode}
            data-testid={`overlay-${mode}`}
          >
            {t.overlays[mode]}
          </button>
        ))}
      </div>
      <Legend mode={overlay} />
    </Panel>
  );
}
