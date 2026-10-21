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

export const LOCALE_KEY = 'horta.locale';

const en = {
  pageTitle: 'Horta',
  title: 'Horta',
  subtitle: 'Plant, wait, harvest.',
  plot42: 'Plot 42',
  name: 'Name',
  seed: 'Seed',
  newGame: 'New Horta',
  continue: 'Continue',
  loadFile: 'Open file…',
  savedGardens: 'Saved gardens',
  noSaves: 'No saved gardens yet.',
  language: 'Language',
  planted: 'Planted',
  ripe: 'Ripe',
  harvested: 'Harvested',
  hint: 'Click to plant. Click a ripe plot to harvest. Shift-click to clear.',
  paused: 'Paused',
  pausedHint: 'Press a speed to resume.',
  saved: 'Horta saved.',
  loaded: 'Horta loaded.',
  save: 'Save',
  menu: 'Menu',
  credits: 'A Plot 42 garden. Original code and art.',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  boot: {
    graphics: 'Preparing the graphics…',
    garden: 'Turning the soil…',
    done: 'Ready',
  },
};

const ptBR: typeof en = {
  pageTitle: 'Horta',
  title: 'Horta',
  subtitle: 'Plante, espere, colha.',
  plot42: 'Plot 42',
  name: 'Nome',
  seed: 'Semente',
  newGame: 'Nova horta',
  continue: 'Continuar',
  loadFile: 'Abrir arquivo…',
  savedGardens: 'Hortas salvas',
  noSaves: 'Nenhuma horta salva ainda.',
  language: 'Idioma',
  planted: 'Plantado',
  ripe: 'Maduro',
  harvested: 'Colhido',
  hint: 'Clique para plantar. Clique num lote maduro para colher. Shift+clique para limpar.',
  paused: 'Pausado',
  pausedHint: 'Escolha uma velocidade para continuar.',
  saved: 'Horta salva.',
  loaded: 'Horta carregada.',
  save: 'Salvar',
  menu: 'Menu',
  credits: 'Uma horta Plot 42. Código e arte originais.',
  soundOn: 'Som ligado',
  soundOff: 'Som desligado',
  boot: {
    graphics: 'Preparando os gráficos…',
    garden: 'Revolvendo a terra…',
    done: 'Pronto',
  },
};

const es: typeof en = {
  pageTitle: 'Horta',
  title: 'Horta',
  subtitle: 'Siembra, espera, cosecha.',
  plot42: 'Plot 42',
  name: 'Nombre',
  seed: 'Semilla',
  newGame: 'Nueva huerta',
  continue: 'Continuar',
  loadFile: 'Abrir archivo…',
  savedGardens: 'Huertas guardadas',
  noSaves: 'Aún no hay huertas guardadas.',
  language: 'Idioma',
  planted: 'Sembrado',
  ripe: 'Maduro',
  harvested: 'Cosechado',
  hint: 'Clic para sembrar. Clic en un lote maduro para cosechar. Mayús+clic para limpiar.',
  paused: 'En pausa',
  pausedHint: 'Elige una velocidad para seguir.',
  saved: 'Horta guardada.',
  loaded: 'Horta cargada.',
  save: 'Guardar',
  menu: 'Menú',
  credits: 'Una huerta de Plot 42. Código y arte originales.',
  soundOn: 'Sonido activado',
  soundOff: 'Sonido desactivado',
  boot: {
    graphics: 'Preparando los gráficos…',
    garden: 'Removiendo la tierra…',
    done: 'Listo',
  },
};

const fr: typeof en = {
  pageTitle: 'Horta',
  title: 'Horta',
  subtitle: 'Semez, attendez, récoltez.',
  plot42: 'Plot 42',
  name: 'Nom',
  seed: 'Graine',
  newGame: 'Nouveau jardin',
  continue: 'Continuer',
  loadFile: 'Ouvrir un fichier…',
  savedGardens: 'Jardins enregistrés',
  noSaves: 'Aucun jardin enregistré pour l’instant.',
  language: 'Langue',
  planted: 'Semé',
  ripe: 'Mûr',
  harvested: 'Récolté',
  hint: 'Cliquez pour semer. Cliquez un lot mûr pour récolter. Maj+clic pour vider.',
  paused: 'En pause',
  pausedHint: 'Choisissez une vitesse pour reprendre.',
  saved: 'Horta enregistrée.',
  loaded: 'Horta chargée.',
  save: 'Enregistrer',
  menu: 'Menu',
  credits: 'Un jardin Plot 42. Code et art originaux.',
  soundOn: 'Son activé',
  soundOff: 'Son coupé',
  boot: {
    graphics: 'Préparation des graphismes…',
    garden: 'Préparation du sol…',
    done: 'Prêt',
  },
};

const de: typeof en = {
  pageTitle: 'Horta',
  title: 'Horta',
  subtitle: 'Pflanzen, warten, ernten.',
  plot42: 'Plot 42',
  name: 'Name',
  seed: 'Samen',
  newGame: 'Neuer Garten',
  continue: 'Fortsetzen',
  loadFile: 'Datei öffnen…',
  savedGardens: 'Gespeicherte Gärten',
  noSaves: 'Noch keine gespeicherten Gärten.',
  language: 'Sprache',
  planted: 'Gepflanzt',
  ripe: 'Reif',
  harvested: 'Geerntet',
  hint: 'Klicken zum Pflanzen. Reifes Feld anklicken zum Ernten. Umschalt+Klick zum Leeren.',
  paused: 'Pausiert',
  pausedHint: 'Wähle eine Geschwindigkeit, um weiterzumachen.',
  saved: 'Horta gespeichert.',
  loaded: 'Horta geladen.',
  save: 'Speichern',
  menu: 'Menü',
  credits: 'Ein Plot-42-Garten. Eigener Code und eigene Kunst.',
  soundOn: 'Ton an',
  soundOff: 'Ton aus',
  boot: {
    graphics: 'Grafik wird vorbereitet…',
    garden: 'Erde wird gewendet…',
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
