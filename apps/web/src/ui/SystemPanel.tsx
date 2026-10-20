import type { ReactNode } from 'react';
import { t } from '../i18n/pt-BR';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { Panel } from './Panel';

export function SystemPanel({ session, children }: { session: GameSession; children?: ReactNode }) {
  const grid = useStore(session.ui, (s) => s.grid);
  const underground = useStore(session.ui, (s) => s.underground);
  const s = t.system;
  return (
    <Panel
      title={s.title}
      testId="system-panel"
      onClose={() => session.closePanel()}
      className="system-panel"
    >
      {children}
      <h3>{s.settings}</h3>
      <label className="check-row">
        <input type="checkbox" checked={grid} onChange={(e) => session.setGrid(e.target.checked)} />
        {s.grid}
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={underground}
          onChange={(e) => session.setUnderground(e.target.checked)}
        />
        {s.underground}
      </label>
      <p className="muted small">{s.help}</p>
      <button
        type="button"
        className="button"
        onClick={() => {
          if (window.confirm(s.confirmLeave)) session.backToMenu();
        }}
        data-testid="back-to-menu"
      >
        {s.newGame}
      </button>
    </Panel>
  );
}
