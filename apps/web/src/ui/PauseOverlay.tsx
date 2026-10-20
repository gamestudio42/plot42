import { t } from '../i18n/pt-BR';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';

/** Paused state: a soft vignette and a badge. Purely visual, the map stays interactive. */
export function PauseOverlay({ session }: { session: GameSession }) {
  const paused = useStore(session.ui, (s) => s.speed === 0);
  if (!paused) return null;
  return (
    <div className="pause-overlay" data-testid="pause-overlay" aria-live="polite">
      <div className="paused-banner" role="status">
        <strong>{t.hud.paused}</strong>
        <span>{t.hud.pausedHint}</span>
      </div>
    </div>
  );
}
