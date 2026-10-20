import { useEffect, useRef, useState } from 'react';
import { t } from './i18n/pt-BR';
import { GameSession } from './state/session';
import { useStore } from './state/store';
import { BudgetPanel } from './ui/BudgetPanel';
import { ChartsPanel } from './ui/ChartsPanel';
import { Hud } from './ui/Hud';
import { Inspector } from './ui/Inspector';
import { MainMenu } from './ui/MainMenu';
import { Minimap } from './ui/Minimap';
import { OverlayPanel } from './ui/OverlayPanel';
import { SaveControls, SavedCities } from './ui/Saves';
import { SystemPanel } from './ui/SystemPanel';
import { Toasts } from './ui/Toasts';
import { Toolbar } from './ui/Toolbar';
import { ToolTooltip } from './ui/ToolTooltip';
import { Tutorial } from './ui/Tutorial';

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const s = new GameSession();
    let cancelled = false;
    void s.mount(host).then(() => {
      if (!cancelled) setSession(s);
    });
    return () => {
      cancelled = true;
      s.dispose();
    };
  }, []);

  return (
    <div className="app">
      <div ref={hostRef} className="viewport" />
      {session && <Screens session={session} />}
    </div>
  );
}

function Screens({ session }: { session: GameSession }) {
  const screen = useStore(session.ui, (s) => s.screen);
  const panel = useStore(session.ui, (s) => s.panel);
  if (screen === 'menu') {
    return (
      <>
        <MainMenu session={session} extra={<SavedCities session={session} />} />
        <Toasts session={session} />
      </>
    );
  }
  return (
    <>
      <Hud session={session} />
      <Toolbar session={session} />
      <Minimap session={session} />
      <TileReadout session={session} />
      <ToolTooltip session={session} />
      <div className="side-panels">
        <Inspector session={session} />
        {panel === 'budget' && <BudgetPanel session={session} />}
        {panel === 'charts' && <ChartsPanel session={session} />}
        {panel === 'overlays' && <OverlayPanel session={session} />}
        {panel === 'system' && (
          <SystemPanel session={session}>
            <SaveControls session={session} />
          </SystemPanel>
        )}
      </div>
      <Tutorial session={session} />
      <Toasts session={session} />
    </>
  );
}

function TileReadout({ session }: { session: GameSession }) {
  const hover = useStore(session.ui, (s) => s.hover);
  const selected = useStore(session.ui, (s) => s.selected);
  return (
    <div className="readout" data-testid="readout">
      <span>
        {t.ui.cursor}: {hover ? `${hover.x}, ${hover.y}` : t.ui.none}
      </span>
      <span data-testid="selected-tile">
        {t.ui.selected}: {selected ? `${selected.x}, ${selected.y}` : t.ui.none}
      </span>
    </div>
  );
}
