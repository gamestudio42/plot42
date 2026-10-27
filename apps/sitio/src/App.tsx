import {
  BUILDING_SPECS,
  BUILDING_VENDA,
  COFFEE_GRADES,
  EDUCATION_PERIODS,
  INPUT_PRICES,
  STARTER_FOOTPRINTS,
  WOOD_BUY_PRICE,
  type BuildingKind,
  type CoffeeGrade,
  type Family,
  type InputKind,
  type Period,
  type Person,
  type SetupStep,
  type SitioFullState,
  type WorkTask,
} from '@sitio/sim';
import {
  BootView,
  LocaleSelect,
  Logo,
  Toasts,
  useStore,
} from '@shell/chrome';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LOCALES, LOCALE_LABELS, useStrings, type Strings } from './i18n';
import { lobbyHref } from './platform';
import { SitioSession } from './session';

const MARK = `${import.meta.env.BASE_URL}favicon.svg`;

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<SitioSession | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const next = new SitioSession();
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

function Screens({ session }: { session: SitioSession }) {
  const screen = useStore(session.ui, (state) => state.screen);
  const toasts = useStore(session.ui, (state) => state.toasts);
  const boot = useStore(session.ui, (state) => state.boot);
  return (
    <>
      {screen === 'menu' ? <Menu session={session} /> : <Game session={session} />}
      <Toasts toasts={toasts} onDismiss={(id) => session.dismissToast(id)} />
      {boot.step !== 'done' ? <Boot session={session} /> : null}
    </>
  );
}

function Boot({ session }: { session: SitioSession }) {
  const boot = useStore(session.ui, (state) => state.boot);
  const t = useStrings(session.ui);
  return (
    <BootView
      stepLabel={t.boot[boot.step]}
      progress={boot.progress}
      leaving={boot.step === 'done'}
      step={boot.step}
    >
      <Logo size={96} title={t.title} markUrl={MARK} />
    </BootView>
  );
}

function LocalePicker({ session }: { session: SitioSession }) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (state) => state.locale);
  return (
    <LocaleSelect
      locales={LOCALES}
      labels={LOCALE_LABELS}
      value={locale}
      onChange={(code) => session.setLocale(code)}
      caption={t.language}
      className="locale-select"
      testId="sitio-locale"
    />
  );
}

function Menu({ session }: { session: SitioSession }) {
  const t = useStrings(session.ui);
  const name = useStore(session.ui, (state) => state.name);
  const seed = useStore(session.ui, (state) => state.seed);
  const saves = useStore(session.ui, (state) => state.saves);
  const latest = saves[0] ?? null;
  return (
    <div className="menu" data-testid="sitio-menu">
      <div className="menu-top">
        <a className="quiet-link" href={lobbyHref()}>
          ← {t.plot42}
        </a>
        <LocalePicker session={session} />
      </div>
      <div className="menu-card">
        <h1>
          <Logo size={56} title={t.title} markUrl={MARK} />
        </h1>
        <p className="subtitle">{t.subtitle}</p>
        <p className="tagline">{t.tagline}</p>
        <label className="field">
          <span>{t.name}</span>
          <input value={name} onChange={(event) => session.setName(event.target.value)} />
        </label>
        <label className="field">
          <span>{t.seed}</span>
          <input value={seed} onChange={(event) => session.setSeed(event.target.value)} />
        </label>
        <div className="menu-actions">
          <button
            type="button"
            className="button primary"
            data-testid="sitio-new"
            onClick={() => void session.newGame()}
          >
            {t.newGame}
          </button>
          {latest ? (
            <button
              type="button"
              className="button"
              data-testid="sitio-continue"
              onClick={() => void session.continueLatest()}
            >
              {t.continue}: {latest.name}
            </button>
          ) : null}
          <button
            type="button"
            className="button"
            data-testid="sitio-test"
            onClick={() => void session.loadTestFarm()}
          >
            {t.testFarm}
          </button>
        </div>
        <label className="button file-button">
          {t.loadFile}
          <input
            type="file"
            accept=".json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => session.loadFile(text));
              event.target.value = '';
            }}
          />
        </label>
        <section className="saves">
          <h2>{t.savedFarms}</h2>
          {saves.length === 0 ? (
            <p className="muted">{t.noSaves}</p>
          ) : (
            <ul className="save-list">
              {saves.map((slot) => (
                <li key={slot.id}>
                  <div>
                    <strong>{slot.name}</strong>
                    <span className="muted">
                      {t.year} {slot.turn === 0 ? 1 : Math.floor(slot.turn / 16) + 1} ·{' '}
                      {slot.families} {t.families.toLowerCase()}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button small"
                    onClick={() => void session.loadSlot(slot.id)}
                  >
                    {t.continue}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="credits">{t.credits}</p>
      </div>
    </div>
  );
}

function Game({ session }: { session: SitioSession }) {
  const t = useStrings(session.ui);
  const state = useStore(session.ui, (ui) => ui.state);
  const tool = useStore(session.ui, (ui) => ui.tool);
  const pendingLand = useStore(session.ui, (ui) => ui.pendingLand);
  const reportOpen = useStore(session.ui, (ui) => ui.reportOpen);
  const endingOpen = useStore(session.ui, (ui) => ui.endingOpen);
  if (!state) return null;

  const salePrice =
    state.coffeePrice +
    (state.buildings.includes(BUILDING_VENDA) ? 1 : 0);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <Logo size={30} title={t.title} markUrl={MARK} />
        </div>
        <div className="clock">
          <strong>{t.season[state.season]}</strong>
          <span>
            {t.week} {state.weekOfSeason} · {t.year} {state.year}
          </span>
        </div>
        <Resource icon="families" label={t.families} value={state.families.length} />
        <Resource icon="coins" label={t.coins} value={state.coins} />
        <Resource icon="food" label={t.food} value={state.food} />
        <Resource icon="wood" label={t.wood} value={state.wood} />
        <Resource icon="fertilizer" label={t.fertilizer} value={state.inputStock.fertilizer} />
        <Resource icon="limestone" label={t.limestone} value={state.inputStock.limestone} />
        <Resource
          icon="stock"
          label={t.stock}
          value={`${state.coffeeStock}/${state.coffeeCapacity}`}
        />
        <Resource icon="price" label={t.price} value={salePrice} />
        <Resource icon="reputation" label={t.reputation} value={state.reputation} />
        <span className={`status status-${state.status}`}>{t.status[state.status]}</span>
        <div className="top-actions">
          <button type="button" className="button small" onClick={() => void session.save()}>
            {t.save}
          </button>
          <button type="button" className="button small" onClick={() => session.exportFile()}>
            {t.export}
          </button>
          <label className="button small file-button">
            {t.import}
            <input
              type="file"
              accept=".json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then((text) => session.loadFile(text));
                event.target.value = '';
              }}
            />
          </label>
          <button type="button" className="button small" onClick={() => session.backToMenu()}>
            {t.menu}
          </button>
          <LocalePicker session={session} />
        </div>
      </header>

      <aside className="side-panel">
        {state.setup ? (
          <SetupPanel session={session} state={state} t={t} />
        ) : (
          <>
            {state.yearEvent === 'frost' || state.yearEvent === 'drought' ? (
              <p className={`forecast forecast-${state.yearEvent}`}>
                {t.forecast[state.yearEvent]}
              </p>
            ) : null}

            {pendingLand ? (
              <p className="hint">
                {t.landHint[pendingLand.kind]}{' '}
                <button type="button" className="button small" onClick={() => session.cancelLand()}>
                  {t.cancel}
                </button>
              </p>
            ) : null}

            <MarketPanel session={session} state={state} t={t} salePrice={salePrice} />
            <InputMarket session={session} state={state} t={t} />
            <WoodMarket session={session} state={state} t={t} />

            <section>
              <h2>
                {t.families} <span className="count">{state.families.length}</span>
              </h2>
              <div className="family-list">
                {state.families.map((family) => (
                  <FamilyCard
                    key={family.id}
                    family={family}
                    people={state.people.filter((person) => person.familyId === family.id)}
                    sites={state.sites}
                    hasSchool={state.structures.some((structure) => structure.kind === 'escola')}
                    fertilizer={state.inputStock.fertilizer}
                    limestone={state.inputStock.limestone}
                    t={t}
                    onAssign={(personId, period, task) =>
                      void session.assignTask(personId, period, task)
                    }
                    onLand={(personId, period, kind) =>
                      session.beginLand(kind, personId, period)
                    }
                    onCancelLand={() => session.cancelLand()}
                  />
                ))}
                {state.families.length === 0 ? <p className="muted">{t.noFamilies}</p> : null}
              </div>
            </section>

            <section>
              <h2>{t.tools.title}</h2>
              <div className="tool-grid">
                <button
                  type="button"
                  className={`button small ${tool === 'select' ? 'active' : ''}`}
                  onClick={() => session.setTool('select')}
                >
                  {t.tools.select}
                </button>
                <button
                  type="button"
                  className={`button small ${tool === 'road' ? 'active' : ''}`}
                  onClick={() => session.setTool('road')}
                >
                  <Icon name="road" /> {t.road}
                </button>
              </div>
              {state.roadPlan.length > 0 ? (
                <p className="hint">
                  {t.roadQueue}: {state.roadPlan.length}{' '}
                  <button
                    type="button"
                    className="button small"
                    onClick={() => void session.clearRoadPlan()}
                  >
                    {t.clear}
                  </button>
                </p>
              ) : null}
              <div className="build-list">
                {(Object.keys(BUILDING_SPECS) as BuildingKind[]).map((kind) => {
                  const spec = BUILDING_SPECS[kind];
                  const lock = buildLock(kind, state);
                  return (
                    <button
                      key={kind}
                      type="button"
                      className={`button build ${tool === kind ? 'active' : ''}`}
                      disabled={lock !== null}
                      onClick={() => session.setTool(kind)}
                    >
                      <span className="build-title">
                        <Icon name={kind} />
                        {t.tools[kind]}
                      </span>
                      <small>
                        {spec.coins} {t.coins.toLowerCase()} · {spec.wood}{' '}
                        {t.wood.toLowerCase()} · {spec.days} {t.periods.toLowerCase()}
                      </small>
                      {lock ? (
                        <em>
                          {lock === 'unique'
                            ? t.unique
                            : `${t.requires} ${(spec.prereq ?? [])
                                .map((entry) => t.tools[entry])
                                .join(', ')}`}
                        </em>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="hint">{tool === 'select' ? t.hint : t.hintBuild}</p>
            </section>

            <section>
              <h2>{t.sites.title}</h2>
              {state.sites.length === 0 ? (
                <p className="muted">{t.sites.none}</p>
              ) : (
                <ul className="site-list">
                  {state.sites.map((site) => (
                    <li key={site.id}>
                      <div>
                        <strong>{t.tools[site.kind]}</strong>
                        <span className="muted">
                          {site.progress}/{site.required} {t.sites.progress}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <button
              type="button"
              className="button primary end-season"
              disabled={state.status !== 'playing'}
              onClick={() => void session.endWeek()}
            >
              {t.endSeason}
            </button>
          </>
        )}
      </aside>

      {reportOpen ? (
        <ReportModal session={session} state={state} t={t} />
      ) : endingOpen ? (
        <EndingModal session={session} state={state} t={t} />
      ) : null}
    </>
  );
}

function Resource({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: number | string;
}) {
  return (
    <div className="resource">
      <span className="resource-label">
        <Icon name={icon} />
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

type IconName =
  | 'families'
  | 'coins'
  | 'food'
  | 'wood'
  | 'fertilizer'
  | 'limestone'
  | 'road'
  | 'canteiro'
  | 'stock'
  | 'price'
  | 'reputation'
  | 'market'
  | 'house'
  | 'terreiro'
  | 'tulha'
  | 'capela'
  | 'venda'
  | 'escola'
  | 'chevron';

const ICON_PATHS: Record<Exclude<IconName, 'chevron'>, ReactNode> = {
  families: (
    <>
      <circle cx="9" cy="8" r="2.6" />
      <path d="M4 19c0-3 2.2-5 5-5s5 2 5 5" />
      <circle cx="17" cy="9" r="2" />
      <path d="M15 19c0-2.2 1.5-3.8 3.5-3.8S22 16.8 22 19" />
    </>
  ),
  coins: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 12h6M12 9v6" />
    </>
  ),
  food: (
    <>
      <path d="M12 21V8" />
      <path d="M12 13c-4 0-6-2-6-6 4 0 6 2 6 6Z" />
      <path d="M12 10c4 0 6-2 6-6-4 0-6 2-6 6Z" />
    </>
  ),
  wood: (
    <>
      <path d="M5 7h11l3 5-3 5H5Z" />
      <path d="M9 7v10M13 7v10" />
    </>
  ),
  fertilizer: (
    <>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V5h6v3M10 12h4M10 16h4" />
    </>
  ),
  limestone: (
    <>
      <path d="m4 12 4-6h8l4 6-8 8-8-8Z" />
      <path d="m8 6 4 6 4-6M12 12v8" />
    </>
  ),
  road: (
    <>
      <path d="M5 21 8 3M19 21l-3-18" />
      <path d="M12 5v3M12 12v3M12 19v2" />
    </>
  ),
  canteiro: (
    <>
      <path d="M4 20h16M6 20V9l6-4 6 4v11" />
      <path d="M9 20v-5h6v5M9 11h6" />
    </>
  ),
  stock: (
    <>
      <ellipse cx="12" cy="12" rx="6" ry="8" transform="rotate(35 12 12)" />
      <path d="M8.5 15.5c2.5-2.5 4.5-4.5 7-7" />
    </>
  ),
  price: (
    <>
      <path d="M4 12V5h7l9 9-6 6-10-8Z" />
      <circle cx="8" cy="9" r="1.2" />
    </>
  ),
  reputation: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z" />,
  market: (
    <>
      <path d="M4 10h16l-1 10H5L4 10Z" />
      <path d="M7 10V7l2-3h6l2 3v3" />
      <path d="M4 10c0 1.5 1 2.5 2.3 2.5S9 11.5 9 10c0 1.5 1 2.5 2.3 2.5s2.4-1 2.4-2.5c0 1.5 1 2.5 2.3 2.5S18 11.5 18 10c0 1.5 1 2.5 2 2.5" />
    </>
  ),
  house: (
    <>
      <path d="m3 11 9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  terreiro: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M4 12h16M12 4v16M8 4v4M16 4v4M8 16v4M16 16v4" />
    </>
  ),
  tulha: (
    <>
      <path d="M4 8h16v12H4z" />
      <path d="M4 8l4-4h8l4 4M9 12h6v8H9z" />
    </>
  ),
  capela: (
    <>
      <path d="M5 21V10l7-5 7 5v11H5Z" />
      <path d="M12 9v6M9 12h6" />
      <path d="M10 21v-5h4v5" />
    </>
  ),
  venda: (
    <>
      <path d="M4 10h16l-1 10H5L4 10Z" />
      <path d="M7 10V7h10v3M8 10v10M16 10v10" />
    </>
  ),
  escola: (
    <>
      <path d="M4 5h7v14H4zM13 5h7v14h-7z" />
      <path d="M8 8h1M17 8h1M8 11h1M17 11h1" />
    </>
  ),
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'chevron' ? (
        <path d="m6 9 6 6 6-6" />
      ) : (
        ICON_PATHS[name]
      )}
    </svg>
  );
}

function buildLock(kind: BuildingKind, state: SitioFullState): 'unique' | 'prereq' | null {
  const spec = BUILDING_SPECS[kind];
  if (
    spec.unique &&
    (state.structures.some((structure) => structure.kind === kind) ||
      state.sites.some((site) => site.kind === kind))
  ) {
    return 'unique';
  }
  if (
    (spec.prereq ?? []).some(
      (required) => !state.structures.some((structure) => structure.kind === required),
    )
  ) {
    return 'prereq';
  }
  return null;
}

function MarketPanel({
  session,
  state,
  t,
  salePrice,
}: {
  session: SitioSession;
  state: SitioFullState;
  t: Strings;
  salePrice: number;
}) {
  const priceFor = (grade: CoffeeGrade) =>
    grade === 'bad' ? Math.max(1, salePrice - 1) : grade === 'good' ? salePrice + 1 : salePrice;
  return (
    <section>
      <h2>
        <Icon name="stock" />
        {t.marketCoffee} <span className="count">{state.coffeeStock}/{state.coffeeCapacity}</span>
      </h2>
      <ul className="grade-list">
        {COFFEE_GRADES.map((grade) => (
          <li key={grade}>
            <span className={`grade grade-${grade}`}>{t.grade[grade]}</span>
            <span className="muted small">{state.coffeeGrades[grade]} {t.sacks}</span>
            <strong>{priceFor(grade)} {t.coins.toLowerCase()}</strong>
            <button
              type="button"
              className="button small"
              disabled={state.coffeeGrades[grade] < 1}
              onClick={() => void session.sellCoffee(grade, state.coffeeGrades[grade])}
            >
              {t.sellAll}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InputMarket({
  session,
  state,
  t,
}: {
  session: SitioSession;
  state: SitioFullState;
  t: Strings;
}) {
  const inputRow = (kind: InputKind) => (
    <li key={kind}>
      <span>
        <Icon name={kind} /> {kind === 'fertilizer' ? t.fertilizer : t.limestone}
      </span>
      <span className="muted small">
        {state.inputStock[kind]} · {INPUT_PRICES[kind]} {t.coins.toLowerCase()}
      </span>
      <button
        type="button"
        className="button small"
        disabled={state.coins < INPUT_PRICES[kind]}
        onClick={() => void session.buyInput(kind, 1)}
      >
        {t.buy}
      </button>
    </li>
  );
  return (
    <section>
      <h2>
        <Icon name="market" />
        {t.inputMarket}
      </h2>
      <ul className="input-list">
        {inputRow('fertilizer')}
        {inputRow('limestone')}
      </ul>
    </section>
  );
}

function WoodMarket({
  session,
  state,
  t,
}: {
  session: SitioSession;
  state: SitioFullState;
  t: Strings;
}) {
  const [amount, setAmount] = useState(1);
  const maximum = Math.max(1, Math.floor(state.coins / WOOD_BUY_PRICE));
  const value = Math.min(amount, maximum);
  const disabled = state.coins < WOOD_BUY_PRICE;
  return (
    <section>
      <h2>
        <Icon name="wood" />
        {t.woodMarket} <span className="count">{state.wood}</span>
      </h2>
      <p className="muted small">
        {t.woodPrice}: {WOOD_BUY_PRICE} {t.coins.toLowerCase()} / {t.wood.toLowerCase()}
      </p>
      <div className="market-row">
        <input
          type="number"
          min={1}
          max={maximum}
          value={value}
          disabled={disabled}
          aria-label={t.wood}
          onChange={(event) => {
            const next = Number(event.target.value);
            setAmount(Number.isFinite(next) ? Math.max(1, Math.min(next, maximum)) : 1);
          }}
        />
        <button
          type="button"
          className="button small"
          disabled={disabled}
          onClick={() => void session.buyWood(value)}
        >
          {t.buy}
        </button>
      </div>
    </section>
  );
}

function FamilyCard({
  family,
  people,
  sites,
  hasSchool,
  fertilizer,
  limestone,
  t,
  onAssign,
  onLand,
  onCancelLand,
}: {
  family: Family;
  people: Person[];
  sites: { id: number; kind: BuildingKind; progress: number; required: number }[];
  hasSchool: boolean;
  fertilizer: number;
  limestone: number;
  t: Strings;
  onAssign: (personId: number, period: Period, task: WorkTask) => void;
  onLand: (
    personId: number,
    period: Period,
    kind: 'plant' | 'clear' | 'fertilize' | 'limestone',
  ) => void;
  onCancelLand: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <article className={`family ${collapsed ? 'collapsed' : ''}`}>
      <header>
        <button
          type="button"
          className="family-toggle"
          aria-expanded={!collapsed}
          title={collapsed ? t.expand : t.collapse}
          onClick={() => setCollapsed((value) => !value)}
        >
          <Icon name="chevron" />
          <strong>{family.name}</strong>
        </button>
        <span className="morale" title={t.morale}>
          {[0, 1, 2, 3].map((index) => (
            <i key={index} className={index < family.morale ? 'on' : ''} />
          ))}
        </span>
      </header>
      {collapsed ? (
        <p className="muted small">
          {people.length} {t.people}
        </p>
      ) : (
        <ul className="people">
        {people.map((person) => (
          <li key={person.id} className="person">
            <div className="person-name">
              <strong>{person.name}</strong>
              <span className="muted small">
                {person.age >= 16 ? t.adult : t.child} · {person.age}
                {person.education ? ` · ${t.educated}` : ''}
              </span>
            </div>
            {person.age >= 16 ? (
              <div className="routine">
                {(['morning', 'afternoon'] as Period[]).map((period) => (
                  <label key={period}>
                    <span>{t.period[period]}</span>
                    <select
                      value={taskValue(person[period])}
                      onChange={(event) => {
                        onCancelLand();
                        onAssign(person.id, period, taskFromValue(event.target.value));
                      }}
                    >
                      <option value="idle">{t.task.idle}</option>
                      <option value="yard">{t.task.quintal}</option>
                      <option value="coffee">{t.task.coffee}</option>
                      <option value="road">{t.task.road}</option>
                      {sites.map((site) => (
                        <option key={site.id} value={`build:${site.id}`}>
                          {t.task.build} {t.tools[site.kind]} ({site.progress}/{site.required})
                        </option>
                      ))}
                    </select>
                    <span className="land-actions">
                      <button
                        type="button"
                        className="mini"
                        onClick={() => onLand(person.id, period, 'clear')}
                      >
                        {t.task.clear}
                      </button>
                      <button
                        type="button"
                        className="mini"
                        onClick={() => onLand(person.id, period, 'plant')}
                      >
                        {t.task.plant}
                      </button>
                      <button
                        type="button"
                        className="mini"
                        disabled={fertilizer < 1}
                        onClick={() => onLand(person.id, period, 'fertilize')}
                      >
                        {t.task.fertilize}
                      </button>
                      <button
                        type="button"
                        className="mini"
                        disabled={limestone < 1}
                        onClick={() => onLand(person.id, period, 'limestone')}
                      >
                        {t.task.limestone}
                      </button>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <>
                <div className="routine">
                  {(['morning', 'afternoon'] as Period[]).map((period) => (
                    <label key={period}>
                      <span>{t.period[period]}</span>
                      <select
                        value={taskValue(person[period])}
                        onChange={(event) => {
                          onCancelLand();
                          onAssign(person.id, period, taskFromValue(event.target.value));
                        }}
                      >
                        <option value="idle">{t.task.idle}</option>
                        <option value="yard">{t.task.quintal}</option>
                        <option value="study" disabled={!hasSchool || person.education}>
                          {t.task.study}
                        </option>
                      </select>
                    </label>
                  ))}
                </div>
                <span className="muted small">
                  {person.education
                    ? t.educated
                    : `${t.study} ${person.educationProgress}/${EDUCATION_PERIODS}`}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      )}
    </article>
  );
}

function taskValue(task: WorkTask): string {
  if (task.kind === 'build') return `build:${task.siteId}`;
  if (task.kind === 'rest') return 'idle';
  return task.kind;
}

function taskFromValue(value: string): WorkTask {
  if (value.startsWith('build:')) {
    return { kind: 'build', siteId: Number(value.slice(6)) };
  }
  return { kind: value as 'idle' | 'rest' | 'yard' | 'coffee' | 'study' | 'road' };
}

const SETUP_STEPS: SetupStep[] = ['sede', 'house', 'terreiro', 'coffee'];

function SetupPanel({
  session,
  state,
  t,
}: {
  session: SitioSession;
  state: SitioFullState;
  t: Strings;
}) {
  const preview = useStore(session.ui, (ui) => ui.setupPreview);
  const pinned = useStore(session.ui, (ui) => ui.setupPinned);
  const step = state.setup;
  if (!step) return null;
  const current = SETUP_STEPS.indexOf(step);
  const footprint = STARTER_FOOTPRINTS[step];
  return (
    <section className={`setup-panel ${pinned ? 'pinned' : ''}`}>
      <h2>{t.setup.title}</h2>
      <p className="muted small">{t.setup.hint}</p>
      <ol className="setup-steps">
        {SETUP_STEPS.map((entry, index) => (
          <li
            key={entry}
            className={index === current ? 'current' : index < current ? 'done' : ''}
          >
            {t.setup.step[entry]}
          </li>
        ))}
      </ol>
      <p>
        <strong>{t.setup.step[step]}</strong> · {footprint.w}×{footprint.h}
      </p>
      <p className={preview?.ok ? 'muted small' : 'warning small'}>
        {preview
          ? preview.ok
            ? pinned
              ? t.setup.blueprint
              : t.setup.fix
            : `${t.setup.invalid} ${t.command[preview.reason ?? 'occupied']}`
          : t.setup.click}
      </p>
      <div className="setup-actions">
        <button
          type="button"
          className="button primary"
          disabled={!preview?.ok || !pinned}
          onClick={() => void session.confirmStarter()}
        >
          {t.setup.confirm}
        </button>
        <button type="button" className="button" onClick={() => session.cancelStarter()}>
          {t.setup.cancel}
        </button>
      </div>
    </section>
  );
}

function ReportModal({
  session,
  state,
  t,
}: {
  session: SitioSession;
  state: SitioFullState;
  t: Strings;
}) {
  const report = state.lastReport;
  if (!report) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{t.report.title}</h2>
        <p className="muted">
          {t.season[report.season]} · {t.week} {report.week} · {t.year} {report.year}
        </p>
        <dl className="report-grid">
          <Row label={t.report.harvest} value={report.harvest} />
          <Row label={`${t.report.harvest} · ${t.grade.bad}`} value={report.harvestGrades.bad} />
          <Row label={`${t.report.harvest} · ${t.grade.medium}`} value={report.harvestGrades.medium} />
          <Row label={`${t.report.harvest} · ${t.grade.good}`} value={report.harvestGrades.good} />
          <Row label={t.report.lost} value={report.lost} />
          <Row label={t.report.sold} value={report.sold} />
          <Row label={t.report.stock} value={`${report.stock}/${state.coffeeCapacity}`} />
          <Row label={t.report.revenue} value={report.revenue} />
          <Row label={t.report.price} value={report.price} />
          <Row label={t.report.foodProduced} value={report.foodProduced} />
          <Row label={t.report.foodConsumed} value={report.foodConsumed} />
          <Row label={t.report.foodBought} value={report.foodBought} />
          <Row label={t.report.foodSold} value={report.foodSold} />
          <Row label={t.report.planted} value={report.planted} />
          <Row label={t.report.cleared} value={report.cleared} />
          <Row label={t.report.studied} value={report.studied} />
          <Row label={t.report.educated} value={report.educated} />
          <Row label={t.report.roads} value={report.roads} />
          <Row label={t.report.fertilized} value={report.fertilized} />
          <Row label={t.report.limed} value={report.limed} />
          <Row label={t.report.arrivals} value={report.arrivals} />
          <Row label={t.report.departures} value={report.departures} />
          <Row label={t.report.completed} value={
            report.completed.length > 0
              ? report.completed.map((kind) => t.tools[kind]).join(', ')
              : t.report.none
          } />
          <Row label={t.report.event} value={
            report.event === 'none' ? t.report.none : t.report[report.event]
          } />
        </dl>
        {report.hunger ? <p className="warning">{t.report.hunger}</p> : null}
        {report.stalledCoffee > 0 ? (
          <p className="warning">
            {t.report.stalled}: {report.stalledCoffee}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="button primary" onClick={() => session.closeReport()}>
            {t.report.close}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function EndingModal({
  session,
  state,
  t,
}: {
  session: SitioSession;
  state: SitioFullState;
  t: Strings;
}) {
  const title =
    state.status === 'won'
      ? t.ending.wonTitle
      : state.status === 'lost'
        ? t.ending.lostTitle
        : t.ending.endedTitle;
  const body =
    state.status === 'won'
      ? t.ending.wonBody
      : state.status === 'lost'
        ? t.ending.lostBody
        : t.ending.endedBody;
  return (
    <div className="modal-backdrop">
      <div className={`modal ending ending-${state.status}`}>
        <h2>{title}</h2>
        <p>{body}</p>
        <dl className="report-grid">
          <Row label={t.families} value={state.families.length} />
          <Row label={t.report.revenue} value={state.stats.revenueTotal} />
          <Row label={t.report.harvest} value={state.stats.harvestTotal} />
          <Row label={t.report.completed} value={state.stats.builtTotal} />
        </dl>
        <div className="modal-actions">
          <button
            type="button"
            className="button primary"
            onClick={() => {
              session.closeEnding();
              void session.newGame();
            }}
          >
            {t.ending.again}
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              session.closeEnding();
              session.backToMenu();
            }}
          >
            {t.ending.menu}
          </button>
        </div>
      </div>
    </div>
  );
}
