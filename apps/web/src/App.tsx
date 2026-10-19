import { useEffect, useRef, useState } from 'react';
import { formatMoney, t } from './i18n/pt-BR';
import { GameSession } from './state/session';
import { useStore } from './state/store';
import { Toasts } from './ui/Toasts';
import { Toolbar } from './ui/Toolbar';
import { ToolTooltip } from './ui/ToolTooltip';

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const s = new GameSession();
    let cancelled = false;
    void s.mount(host).then(() => {
      if (cancelled) return;
      setSession(s);
      void s.newCity({
        name: 'Nova Cidade',
        seed: '1',
        size: 128,
        terrain: { water: 0.14, hills: 0.5, forest: 0.35, rivers: 1 },
      });
    });
    return () => {
      cancelled = true;
      s.dispose();
    };
  }, []);

  return (
    <div className="app">
      <div ref={hostRef} className="viewport" />
      {session && (
        <>
          <Toolbar session={session} />
          <TileReadout session={session} />
          <ToolTooltip session={session} />
          <Toasts session={session} />
        </>
      )}
    </div>
  );
}

function TileReadout({ session }: { session: GameSession }) {
  const hover = useStore(session.ui, (s) => s.hover);
  const selected = useStore(session.ui, (s) => s.selected);
  const funds = useStore(session.ui, (s) => s.stats?.funds ?? 0);
  return (
    <div className="readout" data-testid="readout">
      <span data-testid="funds">{formatMoney(funds)}</span>
      <span>
        {t.ui.cursor}: {hover ? `${hover.x}, ${hover.y}` : t.ui.none}
      </span>
      <span data-testid="selected-tile">
        {t.ui.selected}: {selected ? `${selected.x}, ${selected.y}` : t.ui.none}
      </span>
    </div>
  );
}
