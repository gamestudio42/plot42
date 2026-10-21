import {
  MATA_OVERLAYS,
  MATA_TOOLS,
  SPECIES_KEY,
  isPlantSpecies,
  type MataOverlay,
  type MataTool,
} from '@mata/sim';
import { LocaleSelect, Logo, PauseOverlay, SoundToggle, Toasts, useStore } from '@shell/chrome';
import { useEffect, useRef, useState } from 'react';
import { BootScreen } from './BootScreen';
import { LOCALES, LOCALE_LABELS, useStrings } from './i18n';
import { lobbyHref } from './platform';
import { MataSession } from './session';

const MARK = `${import.meta.env.BASE_URL}favicon.svg`;

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<MataSession | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const next = new MataSession();
    setSession(next);
    void next.boot(host);
    return () => next.dispose();
  }, []);

  return (
    <div className="app">
      <div ref={hostRef} className="viewport" />
      {session ? <Screens session={session} /> : null}
    </div>
  );
}

function Screens({ session }: { session: MataSession }) {
  const screen = useStore(session.ui, (s) => s.screen);
  const toasts = useStore(session.ui, (s) => s.toasts);
  return (
    <>
      {screen === 'menu' ? <Menu session={session} /> : <GameHud session={session} />}
      <Toasts toasts={toasts} onDismiss={(id) => session.dismissToast(id)} />
      <BootScreen session={session} />
    </>
  );
}

function Menu({ session }: { session: MataSession }) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const name = useStore(session.ui, (s) => s.name);
  const seed = useStore(session.ui, (s) => s.seed);
  const muted = useStore(session.ui, (s) => s.muted);
  const saves = useStore(session.ui, (s) => s.saves ?? []);
  const boot = useStore(session.ui, (s) => s.boot);
  const latest = saves[0] ?? null;
  if (boot.step !== 'done') return null;
  return (
    <div className="main-menu" data-testid="mata-menu">
      <div className="menu-chrome">
        <LocaleSelect
          locales={LOCALES}
          labels={LOCALE_LABELS}
          value={locale}
          onChange={(code) => session.setLocale(code)}
          caption={t.language}
          className="menu-locale"
        />
        <SoundToggle
          muted={muted}
          onToggle={() => session.setMuted(!muted)}
          soundOn={t.soundOn}
          soundOff={t.soundOff}
        />
      </div>
      <div className="menu-card">
        <h1 className="menu-title">
          <Logo size={56} title={t.title} markUrl={MARK} />
        </h1>
        <p className="muted">{t.subtitle}</p>
        <label className="field">
          <span>{t.name}</span>
          <input value={name} onChange={(e) => session.setName(e.target.value)} />
        </label>
        <label className="field">
          <span>{t.seed}</span>
          <input value={seed} onChange={(e) => session.setSeed(e.target.value)} />
        </label>
        <div className="menu-actions">
          <button
            type="button"
            className="button primary"
            data-testid="mata-new"
            onClick={() => void session.newGame()}
          >
            {t.newGame}
          </button>
          {latest && (
            <button
              type="button"
              className="button"
              data-testid="mata-continue"
              onClick={() => void session.continueLatest()}
            >
              {t.continue}: {latest.name}
            </button>
          )}
        </div>
        <section className="saved-cities">
          <div className="menu-actions">
            <label className="button file-button">
              {t.loadFile}
              <input
                type="file"
                accept=".json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void file.text().then((text) => session.loadFile(text));
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <h3>{t.savedGroves}</h3>
          {saves.length === 0 ? (
            <p className="muted small">{t.noSaves}</p>
          ) : (
            <ul className="save-list">
              {saves.map((slot) => (
                <li key={slot.id}>
                  <div className="save-info">
                    <strong>{slot.name}</strong>
                    <div className="muted small">{slot.savedAt.slice(0, 10)}</div>
                  </div>
                  <button type="button" className="button small" onClick={() => void session.loadSlot(slot.id)}>
                    {t.continue}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="muted small">
          <a className="plot42-link" href={lobbyHref()} data-testid="plot42-link">
            {t.plot42}
          </a>
        </p>
        <p className="muted small">{t.credits}</p>
      </div>
    </div>
  );
}

function GameHud({ session }: { session: MataSession }) {
  const t = useStrings(session.ui);
  const stats = useStore(session.ui, (s) => s.stats);
  const speed = useStore(session.ui, (s) => s.speed);
  const muted = useStore(session.ui, (s) => s.muted);
  const tool = useStore(session.ui, (s) => s.tool);
  const overlay = useStore(session.ui, (s) => s.overlay);
  const inspect = useStore(session.ui, (s) => s.inspect);
  const cells = stats ? stats.size * stats.size : 1;
  const cover = stats ? Math.round((stats.planted * 100) / cells) : 0;
  return (
    <>
      <PauseOverlay
        paused={speed === 0 && (!stats || stats.outcome === 'playing')}
        title={t.paused}
        hint={t.pausedHint}
      />
      <div className="hud" data-testid="mata-hud">
        <div className="hud-city">
          <strong>{stats?.name ?? t.title}</strong>
          {stats?.outcome === 'won' ? <span className="badge-restored">{t.won}</span> : null}
          {stats?.phase === 'warned' || stats?.phase === 'drought' ? (
            <span className="badge-drought">{t.drought}</span>
          ) : null}
        </div>
        <div className="hud-stat hud-balance" data-testid="mata-balance">
          <span className="hud-label">{t.balance}</span>
          <span className={`balance-value ${balanceClass(stats?.balance ?? 0)}`}>{stats?.balance ?? 0}</span>
          <span className="balance-bar" aria-hidden>
            <span style={{ width: `${stats?.balance ?? 0}%` }} />
          </span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">{t.soil}</span>
          <span>{stats?.soil ?? 0}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">{t.moisture}</span>
          <span>{stats?.moisture ?? 0}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">{t.fauna}</span>
          <span>{stats?.fauna ?? 0}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">{t.unique}</span>
          <span>{stats?.unique ?? 0}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">{t.planted}</span>
          <span>{cover}%</span>
        </div>
        <div className="hud-stat" data-testid="mata-cistern">
          <span className="hud-label">{t.cistern}</span>
          <span>{stats?.cistern ?? 0}</span>
        </div>
        <div className="speeds">
          {([0, 1, 2, 3] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`button ${speed === value ? 'active' : ''}`}
              onClick={() => session.setSpeed(value)}
            >
              {value === 0 ? '❚❚' : `${value}×`}
            </button>
          ))}
        </div>
        <SoundToggle
          muted={muted}
          onToggle={() => session.setMuted(!muted)}
          soundOn={t.soundOn}
          soundOff={t.soundOff}
        />
        <button type="button" className="button" onClick={() => void session.save()}>
          {t.save}
        </button>
        <button type="button" className="button" onClick={() => session.exportFile()}>
          .json
        </button>
        <button type="button" className="button" onClick={() => session.backToMenu()}>
          {t.menu}
        </button>
      </div>
      <div className="desk">
        <div className="toolbar" data-testid="mata-tools">
          {MATA_TOOLS.map((id) => (
            <button
              key={id}
              type="button"
              className={`button tool tool-${id} ${tool === id ? 'active' : ''}`}
              data-testid={`mata-tool-${id}`}
              title={t.toolHint[id]}
              onClick={() => session.setTool(id as MataTool)}
            >
              {t.tools[id]}
              {id !== 'water' && id !== 'clear' ? (
                <span className="seed-count">{stats?.seeds[id] ?? 0}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="overlays" data-testid="mata-overlays">
          {MATA_OVERLAYS.map((id) => (
            <button
              key={id}
              type="button"
              className={`button small ${overlay === id ? 'active' : ''}`}
              data-testid={`mata-overlay-${id}`}
              onClick={() => session.setOverlay(id as MataOverlay)}
            >
              {t.overlays[id]}
            </button>
          ))}
        </div>
      </div>
      {inspect ? (
        <aside className="inspector" data-testid="mata-inspector">
          <h3>
            {t.inspector} {inspect.x},{inspect.y}
          </h3>
          <dl>
            <div>
              <dt>{t.kind}</dt>
              <dd>
                {isPlantSpecies(inspect.species)
                  ? t.tools[SPECIES_KEY[inspect.species]]
                  : t.problems.bare}
              </dd>
            </div>
            <div>
              <dt>{t.health}</dt>
              <dd>{inspect.health}</dd>
            </div>
            <div>
              <dt>{t.age}</dt>
              <dd>{inspect.age}</dd>
            </div>
            <div>
              <dt>{t.moisture}</dt>
              <dd>{inspect.moisture}</dd>
            </div>
            <div>
              <dt>{t.nutrients}</dt>
              <dd>{inspect.nutrients}</dd>
            </div>
            <div>
              <dt>{t.soil}</dt>
              <dd>{inspect.soil}</dd>
            </div>
            <div>
              <dt>{t.shade}</dt>
              <dd>{inspect.shade}</dd>
            </div>
            <div>
              <dt>{t.fauna}</dt>
              <dd>{inspect.fauna}</dd>
            </div>
          </dl>
          <ul>
            {inspect.problems.map((problem) => (
              <li key={problem.code} className={`sev-${problem.severity}`}>
                {t.problems[problem.code]}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
      <p className="hint">
        {stats?.phase === 'warned'
          ? t.droughtWarn.replace('{n}', String(stats.droughtIn))
          : stats?.phase === 'drought'
            ? t.droughtNow.replace('{n}', String(stats.droughtLeft))
            : t.toolHint[tool]}
      </p>
      {stats && stats.outcome !== 'playing' ? (
        <div className="outcome" data-testid="mata-outcome">
          <strong>{stats.outcome === 'won' ? t.won : t.lost}</strong>
          <p>{stats.outcome === 'won' ? t.wonHint : t.lostHint}</p>
          <button type="button" className="button primary" onClick={() => session.backToMenu()}>
            {t.menu}
          </button>
        </div>
      ) : null}
    </>
  );
}

function balanceClass(value: number): string {
  if (value >= 70) return 'good';
  if (value >= 40) return 'mid';
  return 'bad';
}
