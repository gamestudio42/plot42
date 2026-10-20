import { useEffect, useState } from 'react';
import { t } from '../i18n/pt-BR';
import { prefersReducedMotion } from '../motion';
import type { BootState, GameSession } from '../state/session';
import { useStore } from '../state/store';
import { Logo } from './Logo';

const FADE_MS = 300;

/** Loading screen shown until the renderer and the menu city are ready, then faded out. */
export function BootScreen({ session }: { session: GameSession }) {
  const boot = useStore(session.ui, (s) => s.boot);
  const [gone, setGone] = useState(false);
  const done = boot.step === 'done';

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setGone(true), prefersReducedMotion() ? 0 : FADE_MS);
    return () => clearTimeout(timer);
  }, [done]);

  if (gone) return null;
  return <BootView boot={boot} leaving={done} />;
}

export function BootView({ boot, leaving = false }: { boot: BootState; leaving?: boolean }) {
  const percent = Math.round(boot.progress * 100);
  return (
    <div
      className={`boot-screen${leaving ? ' leaving' : ''}`}
      data-testid="boot-screen"
      data-step={boot.step}
      aria-busy={!leaving}
    >
      <Logo size={96} />
      <p className="boot-step" data-testid="boot-step">
        {t.boot[boot.step]}
      </p>
      <div
        className="boot-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="boot-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
