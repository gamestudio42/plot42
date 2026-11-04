import { BootView, Logo, prefersReducedMotion, useStore } from '@shell/chrome';
import { useEffect, useState } from 'react';
import { catalog } from './i18n';
import type { PostoSession } from './session';

const MARK = `${import.meta.env.BASE_URL}favicon.svg`;
const FADE_MS = 300;

export function BootScreen({ session }: { session: PostoSession }) {
  const locale = useStore(session.ui, (s) => s.locale);
  const boot = useStore(session.ui, (s) => s.boot);
  const failed = useStore(session.ui, (s) => s.bootError);
  const [gone, setGone] = useState(false);
  const done = boot.step === 'done';

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setGone(true), prefersReducedMotion() ? 0 : FADE_MS);
    return () => clearTimeout(timer);
  }, [done]);

  const t = catalog(locale);
  if (failed)
    return (
      <div className="boot-screen" role="alert">
        <Logo size={64} title={t.title} markUrl={MARK} />
        <p>{t.bootFailed}</p>
        <button type="button" className="button primary" onClick={() => window.location.reload()}>
          {t.reload}
        </button>
      </div>
    );
  if (gone) return null;
  return (
    <BootView
      stepLabel={t.boot[boot.step]}
      progress={boot.progress}
      leaving={done}
      step={boot.step}
    >
      <Logo size={96} title={t.title} markUrl={MARK} />
    </BootView>
  );
}
