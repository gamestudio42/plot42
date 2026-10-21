export const LOCALES = ['en', 'pt-BR', 'es', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export const LOCALE_KEY = 'plot42.locale';

const en = {
  pageTitle: 'Plot 42',
  title: 'Plot 42',
  tagline: 'Five games. One studio lot.',
  language: 'Language',
  play: 'Play',
  footer: 'Game Studio 42',
  urbeTitle: 'Urbe',
  urbeBlurb: 'Zone the land, keep the lights on, and let the city grow — or fail — on its own.',
  hortaTitle: 'Horta',
  hortaBlurb: 'Plant a plot, wait for it to ripen, then harvest.',
  postoTitle: 'Posto',
  postoBlurb: 'Three units, a 10×10 grid. Move, strike, and hold the outpost.',
  mataTitle: 'Mata',
  mataBlurb: 'Restore a scar. Plants shade, drink and feed each other — the grove decides.',
  neonTitle: 'Neo Urbe',
  neonBlurb: 'Megacorps buy the blocks, hackers sell the dark, drones own the sky. Keep the grid up.',
};

const ptBR: typeof en = {
  pageTitle: 'Plot 42',
  title: 'Plot 42',
  tagline: 'Cinco jogos. Um lote do estúdio.',
  language: 'Idioma',
  play: 'Jogar',
  footer: 'Game Studio 42',
  urbeTitle: 'Urbe',
  urbeBlurb: 'Zoneie o terreno, mantenha a luz acesa e deixe a cidade crescer — ou falhar — sozinha.',
  hortaTitle: 'Horta',
  hortaBlurb: 'Plante num lote, espere amadurecer e colha.',
  postoTitle: 'Posto',
  postoBlurb: 'Três unidades, um grid 10×10. Mova, ataque e segure o posto.',
  mataTitle: 'Mata',
  mataBlurb: 'Restaure uma cicatriz. As plantas se sombreiam, bebem e se alimentam — a mata decide.',
  neonTitle: 'Neo Urbe',
  neonBlurb: 'Megacorps compram os quarteirões, hackers vendem o escuro, drones dominam o céu. Mantenha a rede de pé.',
};

const es: typeof en = {
  pageTitle: 'Plot 42',
  title: 'Plot 42',
  tagline: 'Cinco juegos. Un lote del estudio.',
  language: 'Idioma',
  play: 'Jugar',
  footer: 'Game Studio 42',
  urbeTitle: 'Urbe',
  urbeBlurb: 'Zonifica el terreno, mantén la luz y deja que la ciudad crezca — o falle — sola.',
  hortaTitle: 'Horta',
  hortaBlurb: 'Siembra un lote, espera a que madure y cosecha.',
  postoTitle: 'Posto',
  postoBlurb: 'Tres unidades, una cuadrícula 10×10. Muévete, ataca y sostén el puesto.',
  mataTitle: 'Mata',
  mataBlurb: 'Restaura una cicatriz. Las plantas se sombrean, beben y se alimentan — el bosque decide.',
  neonTitle: 'Neo Urbe',
  neonBlurb: 'Las megacorporaciones compran las manzanas, los hackers venden la oscuridad, los drones dominan el cielo. Mantén la red en pie.',
};

const fr: typeof en = {
  pageTitle: 'Plot 42',
  title: 'Plot 42',
  tagline: 'Cinq jeux. Un lot d’atelier.',
  language: 'Langue',
  play: 'Jouer',
  footer: 'Game Studio 42',
  urbeTitle: 'Urbe',
  urbeBlurb: 'Zonez le terrain, gardez la lumière, et laissez la ville grandir — ou échouer — seule.',
  hortaTitle: 'Horta',
  hortaBlurb: 'Semez une parcelle, attendez qu’elle mûrisse, récoltez.',
  postoTitle: 'Posto',
  postoBlurb: 'Trois unités, une grille 10×10. Déplacez, frappez, tenez le poste.',
  mataTitle: 'Mata',
  mataBlurb: 'Réparez une cicatrice. Les plantes s’ombragent, boivent et se nourrissent — le bosquet décide.',
  neonTitle: 'Neo Urbe',
  neonBlurb: 'Les megacorps achètent les pâtés de maisons, les hackers vendent le noir, les drones règnent sur le ciel. Gardez le réseau debout.',
};

const de: typeof en = {
  pageTitle: 'Plot 42',
  title: 'Plot 42',
  tagline: 'Fünf Spiele. Ein Studio-Grundstück.',
  language: 'Sprache',
  play: 'Spielen',
  footer: 'Game Studio 42',
  urbeTitle: 'Urbe',
  urbeBlurb: 'Zoniere das Land, halte das Licht und lass die Stadt wachsen — oder scheitern.',
  hortaTitle: 'Horta',
  hortaBlurb: 'Pflanze ein Feld, warte, bis es reif ist, ernte.',
  postoTitle: 'Posto',
  postoBlurb: 'Drei Einheiten, ein 10×10-Feld. Bewegen, angreifen, den Posten halten.',
  mataTitle: 'Mata',
  mataBlurb: 'Heile eine Narbe. Pflanzen spenden Schatten, trinken und nähren einander — der Hain entscheidet.',
  neonTitle: 'Neo Urbe',
  neonBlurb: 'Megakonzerne kaufen die Häuserblöcke, Hacker verkaufen das Dunkel, Drohnen beherrschen den Himmel. Halte das Netz am Leben.',
};

const CATALOGS = { en, 'pt-BR': ptBR, es, fr, de } as const;
export type Strings = typeof en;

function matchLocale(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase().replaceAll('_', '-');
  if (lower === 'pt' || lower.startsWith('pt-')) return 'pt-BR';
  const base = lower.split('-')[0];
  if (base === 'en') return 'en';
  if (base === 'es') return 'es';
  if (base === 'fr') return 'fr';
  if (base === 'de') return 'de';
  return null;
}

export function resolveLocale(languages: readonly string[] = navigator.languages): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === 'en' || stored === 'pt-BR' || stored === 'es' || stored === 'fr' || stored === 'de') {
      return stored;
    }
  } catch {
    /* private mode */
  }
  for (const tag of languages) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return 'en';
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* private mode */
  }
}

export function catalog(locale: Locale): Strings {
  return CATALOGS[locale] ?? en;
}

export function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.title = catalog(locale).pageTitle;
}
