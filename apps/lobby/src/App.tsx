import { LocaleSelect, Logo } from '@shell/chrome';
import { useState, type CSSProperties } from 'react';
import { FEATURED, GAMES, displayHost, gameHref, type Game } from './games';
import {
  applyDocumentLocale,
  catalog,
  persistLocale,
  resolveLocale,
  LOCALE_LABELS,
  LOCALES,
  type Locale,
  type Strings,
} from './i18n';

const MARK_BASE = `${import.meta.env.BASE_URL}marks`;
const COVER_BASE = `${import.meta.env.BASE_URL}covers`;
const LOBBY_MARK = `${import.meta.env.BASE_URL}favicon.svg`;

type Filter = 'all' | 'sandbox' | 'web';

function markUrl(game: Game): string {
  return `${MARK_BASE}/${game.slug}.svg`;
}

/** Card art is a screenshot of the game; the featured banner uses a wider `-hero` crop. */
function coverStyle(game: Game, hero = false): CSSProperties {
  return {
    '--cover': `url("${COVER_BASE}/${game.slug}${hero ? '-hero' : ''}.webp")`,
    '--cover-a': game.cover[0],
    '--cover-b': game.cover[1],
    '--accent': game.accent,
  } as CSSProperties;
}

function matches(game: Game, t: Strings, query: string): boolean {
  if (!query) return true;
  const { title, blurb } = t.games[game.slug];
  const haystack = [title, blurb, ...game.tags.map((tag) => t.tags[tag])].join(' ');
  return haystack.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function KindBadge({ game, t }: { game: Game; t: Strings }) {
  return (
    <span className={`badge badge-${game.kind}`}>
      {game.kind === 'sandbox' ? t.sandboxBadge : t.webBadge}
    </span>
  );
}

function Tags({ game, t }: { game: Game; t: Strings }) {
  return (
    <ul className="tags">
      {game.tags.map((tag) => (
        <li key={tag}>{t.tags[tag]}</li>
      ))}
    </ul>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />
    </svg>
  );
}

function Cta({ t }: { t: Strings }) {
  return (
    <span className="cta">
      <PlayIcon />
      {t.play}
    </span>
  );
}

function Hero({ game, t }: { game: Game; t: Strings }) {
  const strings = t.games[game.slug];
  return (
    <a
      className={`hero kind-${game.kind}`}
      href={gameHref(game)}
      style={coverStyle(game, true)}
      data-testid="lobby-featured"
    >
      <span className="hero-art" aria-hidden="true" />
      <span className="hero-body">
        <span className="hero-labels">
          <span className="badge badge-featured">{t.featured}</span>
          {game.isNew ? <span className="badge badge-new">{t.newBadge}</span> : null}
          <KindBadge game={game} t={t} />
        </span>
        <span className="hero-title">
          <img className="hero-icon" src={markUrl(game)} width={64} height={64} alt="" />
          {strings.title}
        </span>
        <span className="hero-blurb">{strings.blurb}</span>
        <Tags game={game} t={t} />
        <Cta t={t} />
      </span>
    </a>
  );
}

function Card({ game, t }: { game: Game; t: Strings }) {
  const strings = t.games[game.slug];
  return (
    <li>
      <a
        className={`card kind-${game.kind}`}
        href={gameHref(game)}
        style={coverStyle(game)}
        data-testid={`lobby-${game.slug}`}
      >
        <span className="card-cover">
          <span className="card-cover-labels">
            <KindBadge game={game} t={t} />
            {game.isNew ? <span className="badge badge-new">{t.newBadge}</span> : null}
          </span>
        </span>
        <span className="card-body">
          <span className="card-head">
            <span className="card-icon">
              <img src={markUrl(game)} width={40} height={40} alt="" />
            </span>
            <span className="card-titles">
              <h3>{strings.title}</h3>
              <span className="card-host">
                {game.kind === 'web' ? displayHost(game.href) : 'plot42 / ' + game.slug}
              </span>
            </span>
          </span>
          <Tags game={game} t={t} />
          <span className="card-blurb">{strings.blurb}</span>
          <Cta t={t} />
        </span>
      </a>
    </li>
  );
}

function Shelf({
  id,
  title,
  subtitle,
  games,
  t,
}: {
  id: string;
  title: string;
  subtitle: string;
  games: readonly Game[];
  t: Strings;
}) {
  if (games.length === 0) return null;
  return (
    <section
      className={`shelf shelf-${id}`}
      aria-labelledby={`shelf-${id}`}
      data-testid={`shelf-${id}`}
    >
      <header className="shelf-head">
        <h2 id={`shelf-${id}`}>{title}</h2>
        <span className="shelf-count">{t.count.replace('{n}', String(games.length))}</span>
        <p>{subtitle}</p>
      </header>
      <ul className="cards">
        {games.map((game) => (
          <Card key={game.slug} game={game} t={t} />
        ))}
      </ul>
    </section>
  );
}

export function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const next = resolveLocale();
    applyDocumentLocale(next);
    return next;
  });
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const t = catalog(locale);

  const changeLocale = (next: Locale) => {
    persistLocale(next);
    applyDocumentLocale(next);
    setLocale(next);
  };

  const q = query.trim();
  const visible = GAMES.filter((game) => matches(game, t, q));
  const sandbox = visible.filter((game) => game.kind === 'sandbox');
  const web = visible.filter((game) => game.kind === 'web');
  const featured = GAMES.find((game) => game.slug === FEATURED);
  const shown = (filter !== 'web' ? sandbox.length : 0) + (filter !== 'sandbox' ? web.length : 0);
  const showHero = featured && filter === 'all' && !q;

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: t.filterAll, count: GAMES.length },
    { id: 'web', label: t.filterWeb, count: GAMES.filter((g) => g.kind === 'web').length },
    {
      id: 'sandbox',
      label: t.filterSandbox,
      count: GAMES.filter((g) => g.kind === 'sandbox').length,
    },
  ];

  return (
    <div className="lobby">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={import.meta.env.BASE_URL}>
            <Logo size={34} title={t.title} markUrl={LOBBY_MARK} />
          </a>
          <label className="search">
            <span className="visually-hidden">{t.search}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="m10.5 10.5 3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={query}
              placeholder={t.searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              data-testid="lobby-search"
            />
          </label>
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
      </header>

      <main className="store">
        <div className="intro">
          <p className="eyebrow">Game Studio 42</p>
          <h1>{t.tagline}</h1>
        </div>

        {showHero ? <Hero game={featured} t={t} /> : null}

        <nav className="filters" aria-label={t.search}>
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === filter ? 'chip active' : 'chip'}
              aria-pressed={item.id === filter}
              onClick={() => setFilter(item.id)}
              data-testid={`filter-${item.id}`}
            >
              {item.label}
              <span className="chip-count">{item.count}</span>
            </button>
          ))}
        </nav>

        {filter !== 'sandbox' ? (
          <Shelf id="web" title={t.webTitle} subtitle={t.webSubtitle} games={web} t={t} />
        ) : null}
        {filter !== 'web' ? (
          <Shelf
            id="sandbox"
            title={t.sandboxTitle}
            subtitle={t.sandboxSubtitle}
            games={sandbox}
            t={t}
          />
        ) : null}
        {shown === 0 ? <p className="empty">{t.noResults.replace('{q}', q)}</p> : null}
      </main>

      <footer className="footer">{t.footer}</footer>
    </div>
  );
}
