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

/** Urbe, Sítio and Neo Urbe ship from their own repositories. The lot only links to them. */
const PUBLISHED = {
  urbe: 'https://gamestudio42.github.io/urbe/',
  sitio: 'https://gamestudio42.github.io/sitio/',
  neon: 'https://gamestudio42.github.io/neo-urbe/',
} as const;

const GAMES = [
  { slug: 'urbe', kind: 'urbe', title: 'urbeTitle', blurb: 'urbeBlurb', href: PUBLISHED.urbe },
  { slug: 'horta', port: 5174, kind: 'horta', title: 'hortaTitle', blurb: 'hortaBlurb' },
  { slug: 'posto', port: 5175, kind: 'posto', title: 'postoTitle', blurb: 'postoBlurb' },
  { slug: 'mata', port: 5177, kind: 'mata', title: 'mataTitle', blurb: 'mataBlurb' },
  { slug: 'sitio', kind: 'sitio', title: 'sitioTitle', blurb: 'sitioBlurb', href: PUBLISHED.sitio },
  { slug: 'neon', kind: 'neon', title: 'neonTitle', blurb: 'neonBlurb', href: PUBLISHED.neon },
] as const;

function gameHref(game: (typeof GAMES)[number]): string {
  if ('href' in game) return game.href;
  return import.meta.env.DEV ? `http://localhost:${game.port}/` : `${game.slug}/`;
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
              href={gameHref(game)}
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
