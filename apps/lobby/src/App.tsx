import { LocaleSelect, Logo } from '@shell/chrome';
import { useState } from 'react';
import {
  applyDocumentLocale,
  catalog,
  persistLocale,
  resolveLocale,
  LOCALE_LABELS,
  LOCALES,
  type Locale,
} from './i18n';

const MARK_BASE = `${import.meta.env.BASE_URL}marks`;
const LOBBY_MARK = `${import.meta.env.BASE_URL}favicon.svg`;

const GAMES = [
  { slug: 'urbe', port: 5173, kind: 'urbe', title: 'urbeTitle', blurb: 'urbeBlurb' },
  { slug: 'horta', port: 5174, kind: 'horta', title: 'hortaTitle', blurb: 'hortaBlurb' },
  { slug: 'posto', port: 5175, kind: 'posto', title: 'postoTitle', blurb: 'postoBlurb' },
  { slug: 'mata', port: 5177, kind: 'mata', title: 'mataTitle', blurb: 'mataBlurb' },
  { slug: 'neon', port: 5178, kind: 'neon', title: 'neonTitle', blurb: 'neonBlurb' },
] as const;

function gameHref(slug: string, port: number): string {
  return import.meta.env.DEV ? `http://localhost:${port}/` : `${slug}/`;
}

export function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const next = resolveLocale();
    applyDocumentLocale(next);
    return next;
  });
  const t = catalog(locale);

  const changeLocale = (next: Locale) => {
    persistLocale(next);
    applyDocumentLocale(next);
    setLocale(next);
  };

  return (
    <div className="lobby">
      <div className="lobby-chrome">
        <LocaleSelect
          locales={LOCALES}
          labels={LOCALE_LABELS}
          value={locale}
          onChange={changeLocale}
          caption={t.language}
          className="menu-locale"
          testId="lobby-locale"
        />
      </div>
      <header className="masthead">
        <p className="eyebrow">Game Studio 42</p>
        <h1 className="menu-title">
          <Logo size={56} title={t.title} markUrl={LOBBY_MARK} />
        </h1>
        <p className="tagline">{t.tagline}</p>
      </header>
      <ul className="games">
        {GAMES.map((game) => (
          <li key={game.slug}>
            <a
              className={`card card-${game.kind}`}
              href={gameHref(game.slug, game.port)}
              data-testid={`lobby-${game.slug}`}
            >
              <span className="card-mark">
                <img src={`${MARK_BASE}/${game.kind}.svg`} width={48} height={48} alt="" />
              </span>
              <h2>{t[game.title]}</h2>
              <p>{t[game.blurb]}</p>
              <span className="play">{t.play}</span>
            </a>
          </li>
        ))}
      </ul>
      <footer>{t.footer}</footer>
    </div>
  );
}
