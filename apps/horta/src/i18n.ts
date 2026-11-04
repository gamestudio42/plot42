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
  resume: 'Resume session',
  loadSaved: 'Load checkpoint',
  exportSave: 'Export save',
  storageUnavailable:
    'Progress could not be saved in this browser. Keep this tab open and export a file before leaving. Saving must succeed before switching worlds.',
  operationFailed: 'The action could not be completed. Your current session is still available.',
  invalidSave:
    'This file is not a valid save for this game. Your current session has not been replaced.',
  bootFailed:
    'The game could not start or stopped responding. Reload to recover your last checkpoint.',
  reload: 'Reload game',
  retrySave: 'Retry saving',
  saving: 'Protecting your progress…',

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
  resume: 'Retomar partida',
  loadSaved: 'Carregar checkpoint',
  exportSave: 'Exportar partida',
  storageUnavailable:
    'Não foi possível salvar neste navegador. Mantenha esta aba aberta e exporte um arquivo antes de sair. É necessário salvar para trocar de mundo.',
  operationFailed: 'Não foi possível concluir a ação. Sua partida atual continua disponível.',
  invalidSave:
    'Este arquivo não é um save válido deste jogo. Sua partida atual não foi substituída.',
  bootFailed:
    'O jogo não iniciou ou parou de responder. Recarregue para recuperar o último checkpoint.',
  reload: 'Recarregar jogo',
  retrySave: 'Tentar salvar novamente',
  saving: 'Protegendo seu progresso…',

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
  resume: 'Reanudar partida',
  loadSaved: 'Cargar punto de guardado',
  exportSave: 'Exportar partida',
  storageUnavailable:
    'No se pudo guardar en este navegador. Mantén esta pestaña abierta y exporta un archivo antes de salir. Debes guardar antes de cambiar de mundo.',
  operationFailed: 'No se pudo completar la acción. Tu partida actual sigue disponible.',
  invalidSave:
    'Este archivo no es una partida válida para este juego. Tu partida actual no se ha reemplazado.',
  bootFailed:
    'El juego no pudo iniciarse o dejó de responder. Recarga para recuperar el último guardado.',
  reload: 'Recargar juego',
  retrySave: 'Reintentar guardado',
  saving: 'Protegiendo tu progreso…',

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
  resume: 'Reprendre la partie',
  loadSaved: 'Charger la sauvegarde',
  exportSave: 'Exporter la partie',
  storageUnavailable:
    'Impossible de sauvegarder dans ce navigateur. Gardez cet onglet ouvert et exportez un fichier avant de quitter. La sauvegarde doit réussir avant de changer de monde.',
  operationFailed: 'Cette action a échoué. Votre partie actuelle reste disponible.',
  invalidSave:
    'Ce fichier ne contient pas une sauvegarde valide pour ce jeu. Votre partie actuelle est conservée.',
  bootFailed:
    'Le jeu ne démarre pas ou ne répond plus. Rechargez pour récupérer la dernière sauvegarde.',
  reload: 'Recharger le jeu',
  retrySave: 'Réessayer la sauvegarde',
  saving: 'Protection de votre progression…',

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
  resume: 'Partie fortsetzen',
  loadSaved: 'Spielstand laden',
  exportSave: 'Spielstand exportieren',
  storageUnavailable:
    'Speichern in diesem Browser fehlgeschlagen. Lass diesen Tab geöffnet und exportiere eine Datei, bevor du ihn verlässt. Speichere erfolgreich, bevor du die Welt wechselst.',
  operationFailed: 'Die Aktion ist fehlgeschlagen. Deine aktuelle Partie ist weiterhin verfügbar.',
  invalidSave:
    'Diese Datei ist kein gültiger Spielstand für dieses Spiel. Deine aktuelle Partie wurde nicht ersetzt.',
  bootFailed:
    'Das Spiel konnte nicht starten oder reagiert nicht mehr. Lade neu, um den letzten Spielstand wiederherzustellen.',
  reload: 'Spiel neu laden',
  retrySave: 'Erneut speichern',
  saving: 'Dein Fortschritt wird gesichert…',

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
