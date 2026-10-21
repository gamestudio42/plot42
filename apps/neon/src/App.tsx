import type { MusicFactory } from '@neon/web/audio/sound';
import { App as UrbeApp } from '@neon/web/App';
import { neon } from '@theme/neon';
import { useEffect, useState } from 'react';
import { neonMusicFactory } from './audio/adapter';
import { applyNeonCopy } from './i18n';

/** Synthwave instead of the Urbe lo-fi player; the shared board keeps mute and the bus. */
const music: MusicFactory = (ctx, bus, noise) => neonMusicFactory(ctx, bus, noise);

/**
 * Neo Urbe shell: the Urbe app with the neon theme, a neon ruleset and cyberpunk copy.
 *
 * The panels, the toolbar, the inspector and every `data-testid` stay identical to Urbe, so the
 * shared E2E helpers keep working. Only the art direction, the copy and the ruleset change.
 */
export function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Copy is applied before the first render so the menu never flashes the Urbe wording.
    for (const locale of ['en', 'pt-BR', 'es', 'fr', 'de'] as const) applyNeonCopy(locale);
    setReady(true);
  }, []);
  if (!ready) return null;
  return <UrbeApp theme={neon} menuSeed="neon-menu" ruleset="neon" music={music} />;
}
