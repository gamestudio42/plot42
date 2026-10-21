import {
  applyDocumentLang,
  bootLocale as bootStored,
  persistLocale as persistStored,
  readStoredLocale,
  resolveLocale as resolveCatalog,
  useCatalog,
  type Store,
} from '@shell/chrome';

export const LOCALES = ['en', 'pt-BR', 'es', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export const LOCALE_KEY = 'posto.locale';

const en = {
  pageTitle: 'Posto',
  title: 'Posto',
  subtitle: 'Hold the grid. Move, then strike.',
  plot42: 'Plot 42',
  name: 'Name',
  seed: 'Seed',
  newGame: 'New outpost',
  continue: 'Continue',
  loadFile: 'Open file…',
  savedOutposts: 'Saved outposts',
  noSaves: 'No saved outposts yet.',
  language: 'Language',
  turn: 'Turn',
  yours: 'Yours',
  theirs: 'Hostiles',
  selected: 'Selected',
  none: '—',
  roles: { scout: 'Scout', guard: 'Guard', raider: 'Raider' },
  hint: 'Select a unit. Gold tiles move, red tiles strike.',
  saved: 'Posto saved.',
  loaded: 'Posto loaded.',
  save: 'Save',
  menu: 'Menu',
  victory: 'The outpost holds.',
  defeat: 'The outpost has fallen.',
  outcomeHint: 'Return to the menu to try another seed.',
  credits: 'A Plot 42 outpost. Original code and art.',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  boot: {
    graphics: 'Preparing the graphics…',
    outpost: 'Raising the palisade…',
    done: 'Ready',
  },
};

const ptBR: typeof en = {
  pageTitle: 'Posto',
  title: 'Posto',
  subtitle: 'Segure o grid. Mova, depois ataque.',
  plot42: 'Plot 42',
  name: 'Nome',
  seed: 'Semente',
  newGame: 'Novo posto',
  continue: 'Continuar',
  loadFile: 'Abrir arquivo…',
  savedOutposts: 'Postos salvos',
  noSaves: 'Nenhum posto salvo ainda.',
  language: 'Idioma',
  turn: 'Turno',
  yours: 'Seus',
  theirs: 'Hostis',
  selected: 'Selecionado',
  none: '—',
  roles: { scout: 'Batedor', guard: 'Guarda', raider: 'Saqueador' },
  hint: 'Selecione uma unidade. Ouro move, vermelho ataca.',
  saved: 'Posto salvo.',
  loaded: 'Posto carregado.',
  save: 'Salvar',
  menu: 'Menu',
  victory: 'O posto resiste.',
  defeat: 'O posto caiu.',
  outcomeHint: 'Volte ao menu para tentar outra semente.',
  credits: 'Um posto Plot 42. Código e arte originais.',
  soundOn: 'Som ligado',
  soundOff: 'Som desligado',
  boot: {
    graphics: 'Preparando os gráficos…',
    outpost: 'Erguendo a paliçada…',
    done: 'Pronto',
  },
};

const es: typeof en = {
  pageTitle: 'Posto',
  title: 'Posto',
  subtitle: 'Sostén la cuadrícula. Muévete, luego golpea.',
  plot42: 'Plot 42',
  name: 'Nombre',
  seed: 'Semilla',
  newGame: 'Nuevo puesto',
  continue: 'Continuar',
  loadFile: 'Abrir archivo…',
  savedOutposts: 'Puestos guardados',
  noSaves: 'Aún no hay puestos guardados.',
  language: 'Idioma',
  turn: 'Turno',
  yours: 'Tuyos',
  theirs: 'Hostiles',
  selected: 'Seleccionado',
  none: '—',
  roles: { scout: 'Explorador', guard: 'Guardia', raider: 'Saqueador' },
  hint: 'Elige una unidad. Oro mueve, rojo ataca.',
  saved: 'Posto guardado.',
  loaded: 'Posto cargado.',
  save: 'Guardar',
  menu: 'Menú',
  victory: 'El puesto resiste.',
  defeat: 'El puesto ha caído.',
  outcomeHint: 'Vuelve al menú para probar otra semilla.',
  credits: 'Un puesto de Plot 42. Código y arte originales.',
  soundOn: 'Sonido activado',
  soundOff: 'Sonido desactivado',
  boot: {
    graphics: 'Preparando los gráficos…',
    outpost: 'Levantando la empalizada…',
    done: 'Listo',
  },
};

const fr: typeof en = {
  pageTitle: 'Posto',
  title: 'Posto',
  subtitle: 'Tenez la grille. Déplacez, puis frappez.',
  plot42: 'Plot 42',
  name: 'Nom',
  seed: 'Graine',
  newGame: 'Nouveau poste',
  continue: 'Continuer',
  loadFile: 'Ouvrir un fichier…',
  savedOutposts: 'Postes enregistrés',
  noSaves: 'Aucun poste enregistré pour l’instant.',
  language: 'Langue',
  turn: 'Tour',
  yours: 'Vôtres',
  theirs: 'Hostiles',
  selected: 'Sélection',
  none: '—',
  roles: { scout: 'Éclaireur', guard: 'Garde', raider: 'Pillard' },
  hint: 'Sélectionnez une unité. Or = déplacement, rouge = frappe.',
  saved: 'Posto enregistré.',
  loaded: 'Posto chargé.',
  save: 'Enregistrer',
  menu: 'Menu',
  victory: 'Le poste tient.',
  defeat: 'Le poste est tombé.',
  outcomeHint: 'Retournez au menu pour une autre graine.',
  credits: 'Un poste Plot 42. Code et art originaux.',
  soundOn: 'Son activé',
  soundOff: 'Son coupé',
  boot: {
    graphics: 'Préparation des graphismes…',
    outpost: 'Édification de la palissade…',
    done: 'Prêt',
  },
};

const de: typeof en = {
  pageTitle: 'Posto',
  title: 'Posto',
  subtitle: 'Halte das Feld. Bewege dich, dann schlage zu.',
  plot42: 'Plot 42',
  name: 'Name',
  seed: 'Samen',
  newGame: 'Neuer Posten',
  continue: 'Fortsetzen',
  loadFile: 'Datei öffnen…',
  savedOutposts: 'Gespeicherte Posten',
  noSaves: 'Noch keine gespeicherten Posten.',
  language: 'Sprache',
  turn: 'Zug',
  yours: 'Deine',
  theirs: 'Feinde',
  selected: 'Auswahl',
  none: '—',
  roles: { scout: 'Späher', guard: 'Wache', raider: 'Plünderer' },
  hint: 'Wähle eine Einheit. Gold bewegt, Rot greift an.',
  saved: 'Posto gespeichert.',
  loaded: 'Posto geladen.',
  save: 'Speichern',
  menu: 'Menü',
  victory: 'Der Posten hält.',
  defeat: 'Der Posten ist gefallen.',
  outcomeHint: 'Zurück zum Menü für einen anderen Samen.',
  credits: 'Ein Plot-42-Posten. Eigener Code und eigene Kunst.',
  soundOn: 'Ton an',
  soundOff: 'Ton aus',
  boot: {
    graphics: 'Grafik wird vorbereitet…',
    outpost: 'Palisade wird errichtet…',
    done: 'Fertig',
  },
};

const CATALOGS = { en, 'pt-BR': ptBR, es, fr, de } as const;
export type Strings = typeof en;

export function matchLocale(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase().replaceAll('_', '-');
  if (lower === 'pt' || lower.startsWith('pt-')) return 'pt-BR';
  const base = lower.split('-')[0];
  if (base === 'en') return 'en';
  if (base === 'es') return 'es';
  if (base === 'fr') return 'fr';
  if (base === 'de') return 'de';
  return null;
}

export function resolveLocale(options?: {
  stored?: string | null;
  languages?: readonly string[];
}): Locale {
  return resolveCatalog({
    locales: LOCALES,
    fallback: 'en',
    match: matchLocale,
    stored: options?.stored !== undefined ? options.stored : readStoredLocale(LOCALE_KEY),
    languages: options?.languages,
  });
}

export function persistLocale(locale: Locale): void {
  persistStored(LOCALE_KEY, locale);
}

export function bootLocale(): Locale {
  return bootStored(LOCALE_KEY, (stored) => resolveLocale({ stored }));
}

export function catalog(locale: Locale): Strings {
  return CATALOGS[locale] ?? en;
}

export function useStrings(ui: Store<{ locale: Locale }>): Strings {
  return useCatalog(ui, catalog);
}

export function applyDocumentLocale(locale: Locale): void {
  applyDocumentLang(locale, catalog(locale).pageTitle);
}
