import { useEffect, useRef, useState } from 'react';
import { GameSession } from './state/session';
import { useStore } from './state/store';

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
      void s.newCity({ name: 'Nova Cidade', seed: '1', size: 128, terrain: { water: 0.14, hills: 0.5, forest: 0.35, rivers: 1 } });
    });
    return () => {
      cancelled = true;
      s.dispose();
    };
  }, []);

  return (
    <div className="app">
      <div ref={hostRef} className="viewport" />
      {session && <TileReadout session={session} />}
    </div>
  );
}

function TileReadout({ session }: { session: GameSession }) {
  const hover = useStore(session.ui, (s) => s.hover);
  const selected = useStore(session.ui, (s) => s.selected);
  return (
    <div className="readout" data-testid="readout">
      <span>Cursor: {hover ? `${hover.x}, ${hover.y}` : '—'}</span>
      <span data-testid="selected-tile">Selecionado: {selected ? `${selected.x}, ${selected.y}` : '—'}</span>
    </div>
  );
}
