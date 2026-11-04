import { LocaleSelect, Logo, PauseOverlay, SoundToggle, Toasts, useStore } from '@shell/chrome';
import { useEffect, useRef, useState } from 'react';
import { BootScreen } from './BootScreen';
import { LOCALES, LOCALE_LABELS, useStrings } from './i18n';
import { lobbyHref } from './platform';
import { PostoSession } from './session';
import { unitRole } from './sprites';

const MARK = `${import.meta.env.BASE_URL}favicon.svg`;

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<PostoSession | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const next = new PostoSession();
    setSession(next);
    void next.boot(host).catch(() => next.ui.set({ bootError: true }));
    return () => next.dispose();
  }, []);

  return (
    <div className="app">
      <div ref={hostRef} className="viewport" />
      {session ? <Screens session={session} /> : null}
    </div>
  );
}

function Screens({ session }: { session: PostoSession }) {
  const screen = useStore(session.ui, (s) => s.screen);
  const toasts = useStore(session.ui, (s) => s.toasts);
  const saveError = useStore(session.ui, (s) => s.saveError);
  const hasSession = useStore(session.ui, (s) => s.hasSession);
  const busy = useStore(session.ui, (s) => s.busy);
  const t = useStrings(session.ui);
  return (
    <>
      {screen === 'menu' ? <Menu session={session} /> : <GameHud session={session} />}
      <Toasts toasts={toasts} onDismiss={(id) => session.dismissToast(id)} />
      {saveError ? (
        <aside className="recovery-notice" role="alert" data-testid="storage-error">
          <p>{t.storageUnavailable}</p>
          {hasSession ? (
            <div className="menu-actions">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => void session.save()}
              >
                {t.retrySave}
              </button>
              <button
                type="button"
                className="button"
                data-testid="posto-export"
                onClick={() => session.exportFile()}
              >
                {t.exportSave}
              </button>
            </div>
          ) : null}
        </aside>
      ) : null}
      {busy ? (
        <div className="session-busy" role="status">
          {t.saving}
        </div>
      ) : null}
      <BootScreen session={session} />
    </>
  );
}

function Menu({ session }: { session: PostoSession }) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const name = useStore(session.ui, (s) => s.name);
  const seed = useStore(session.ui, (s) => s.seed);
  const muted = useStore(session.ui, (s) => s.muted);
  const saves = useStore(session.ui, (s) => s.saves ?? []);
  const boot = useStore(session.ui, (s) => s.boot);
  const latest = saves[0] ?? null;
  const hasSession = useStore(session.ui, (s) => s.hasSession);
  const activeName = useStore(session.ui, (s) => s.stats?.name);
  const busy = useStore(session.ui, (s) => s.busy);
  if (boot.step !== 'done') return null;
  return (
    <div className="main-menu" data-testid="posto-menu">
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
          <input disabled={busy} value={name} onChange={(e) => session.setName(e.target.value)} />
        </label>
        <label className="field">
          <span>{t.seed}</span>
          <input disabled={busy} value={seed} onChange={(e) => session.setSeed(e.target.value)} />
        </label>
        <div className="menu-actions">
          <button
            type="button"
            className="button primary"
            data-testid="posto-new"
            disabled={busy}
            onClick={() => void session.newGame()}
          >
            {t.newGame}
          </button>
          {(hasSession || latest) && (
            <button
              type="button"
              className="button"
              data-testid="posto-continue"
              disabled={busy}
              onClick={() => void session.continueLatest()}
            >
              {hasSession ? t.resume : t.continue}: {hasSession ? activeName : latest?.name}
            </button>
          )}
        </div>
        <section className="saved-cities">
          <div className="menu-actions">
            <label className="button file-button">
              {t.loadFile}
              <input
                type="file"
                disabled={busy}
                accept=".json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void session.openFile(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <h3>{t.savedOutposts}</h3>
          {saves.length === 0 ? (
            <p className="muted small">{t.noSaves}</p>
          ) : (
            <ul className="save-list">
              {saves.map((slot) => (
                <li key={slot.id}>
                  <div className="save-info" data-testid="save-slot">
                    <strong>{slot.name}</strong>
                    <div className="muted small">{slot.savedAt.slice(0, 10)}</div>
                  </div>
                  <button
                    type="button"
                    className="button small"
                    disabled={busy}
                    onClick={() => void session.loadSlot(slot.id)}
                  >
                    {t.loadSaved}
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

function GameHud({ session }: { session: PostoSession }) {
  const t = useStrings(session.ui);
  const stats = useStore(session.ui, (s) => s.stats);
  const selectedId = useStore(session.ui, (s) => s.selectedId);
  const muted = useStore(session.ui, (s) => s.muted);
  const outcome = stats?.outcome ?? 'playing';
  return (
    <>
      <PauseOverlay
        paused={outcome !== 'playing'}
        title={outcome === 'defeat' ? t.defeat : t.victory}
        hint={t.outcomeHint}
      />
      <div className="hud" data-testid="posto-hud">
        <div className="hud-city">
          <strong>{stats?.name ?? t.title}</strong>
        </div>
        <div className="hud-stat">
          <span className="hud-label">{t.turn}</span>
          <span>{stats?.turn ?? 0}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">{t.yours}</span>
          <span>{stats?.playerAlive ?? 0}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">{t.theirs}</span>
          <span>{stats?.enemyAlive ?? 0}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">{t.selected}</span>
          <span>{selectedId === null ? t.none : t.roles[unitRole(selectedId)]}</span>
        </div>
        <SoundToggle
          muted={muted}
          onToggle={() => session.setMuted(!muted)}
          soundOn={t.soundOn}
          soundOff={t.soundOff}
        />
        <button
          type="button"
          className="button"
          data-testid="posto-save"
          onClick={() => void session.save()}
        >
          {t.save}
        </button>
        <button
          type="button"
          className="button"
          data-testid="posto-export"
          onClick={() => session.exportFile()}
        >
          {t.exportSave}
        </button>
        <button
          type="button"
          className="button"
          data-testid="posto-menu-button"
          onClick={() => session.backToMenu()}
        >
          {t.menu}
        </button>
      </div>
      <p className="hint">{t.hint}</p>
    </>
  );
}
