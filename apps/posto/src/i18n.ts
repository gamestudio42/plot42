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
