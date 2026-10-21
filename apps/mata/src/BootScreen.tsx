import { BootView, Logo, prefersReducedMotion, useStore } from '@shell/chrome';
import { useEffect, useState } from 'react';
import { catalog } from './i18n';
import type { MataSession } from './session';

const MARK = `${import.meta.env.BASE_URL}favicon.svg`;
const FADE_MS = 300;

export function BootScreen({ session }: { session: MataSession }) {
  const locale = useStore(session.ui, (s) => s.locale);
  const boot = useStore(session.ui, (s) => s.boot);
  const [gone, setGone] = useState(false);
  const done = boot.step === 'done';

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setGone(true), prefersReducedMotion() ? 0 : FADE_MS);
    return () => clearTimeout(timer);
  }, [done]);

  if (gone) return null;
  const t = catalog(locale);
  return (
    <BootView stepLabel={t.boot[boot.step]} progress={boot.progress} leaving={done} step={boot.step}>
      <Logo size={96} title={t.title} markUrl={MARK} />
    </BootView>
  );
}
