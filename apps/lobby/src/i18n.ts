import type { GameSlug, Tag } from './games';

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
  pageTitle: 'Plot 42 — Game Studio 42',
  title: 'Plot 42',
  tagline: 'Every Game Studio 42 game, on one shelf.',
  language: 'Language',
  footer: 'Game Studio 42 · open-source browser games',
  search: 'Search games',
  searchPlaceholder: 'Search by name or genre…',
  filterAll: 'All',
  filterSandbox: 'Play here',
  filterWeb: 'Studio sites',
  featured: 'Featured',
  newBadge: 'New',
  sandboxBadge: 'Plot 42',
  webBadge: 'External site',
  sandboxTitle: 'Play here on Plot 42',
  sandboxSubtitle: 'Sandbox games built into this lot. They open right here, no install.',
  webTitle: 'Studio games',
  webSubtitle: 'Full games with their own sites. The card opens the game’s page.',
  playHere: 'Play',
  openSite: 'Open site',
  count: '{n} games',
  noResults: 'No game matches “{q}”.',
  games: {
    vazante: {
      title: 'Vazante',
      blurb: 'The river rose, the dead walked out of it. Hold the town in a real-time zombie RTS.',
    },
    'urbe-oasis': {
      title: 'Urbe Oasis',
      blurb: 'Raise a city in the dunes. Every drop of water decides where the next block goes.',
    },
    urbe: {
      title: 'Urbe',
      blurb: 'Zone the land, keep the lights on, and let the city grow — or fail — on its own.',
    },
    neon: {
      title: 'Neo Urbe',
      blurb:
        'Megacorps buy the blocks, hackers sell the dark, drones own the sky. Keep the grid up.',
    },
    sitio: {
      title: 'Sítio',
      blurb: 'Grow coffee, keep the families, and turn a farm into a village.',
    },
    horta: { title: 'Horta', blurb: 'Plant a plot, wait for it to ripen, then harvest.' },
    posto: {
      title: 'Posto',
      blurb: 'Three units, a 10×10 grid. Move, strike, and hold the outpost.',
    },
    mata: {
      title: 'Mata',
      blurb: 'Restore a scar. Plants shade, drink and feed each other — the grove decides.',
    },
  },
  tags: {
    cityBuilder: 'City builder',
    simulation: 'Simulation',
    farming: 'Farming',
    management: 'Management',
    tactics: 'Tactics',
    turnBased: 'Turn-based',
    ecology: 'Ecology',
    cyberpunk: 'Cyberpunk',
    desert: 'Desert',
    rts: 'Real-time strategy',
    zombies: 'Zombies',
    casual: 'Casual',
  },
} satisfies {
  [key: string]: unknown;
  games: Record<GameSlug, { title: string; blurb: string }>;
  tags: Record<Tag, string>;
};

const ptBR: typeof en = {
  pageTitle: 'Plot 42 — Game Studio 42',
  title: 'Plot 42',
  tagline: 'Todos os jogos da Game Studio 42 numa só vitrine.',
  language: 'Idioma',
  footer: 'Game Studio 42 · jogos de navegador de código aberto',
  search: 'Buscar jogos',
  searchPlaceholder: 'Busque por nome ou gênero…',
  filterAll: 'Todos',
  filterSandbox: 'Jogar aqui',
  filterWeb: 'Sites do estúdio',
  featured: 'Destaque',
  newBadge: 'Novo',
  sandboxBadge: 'Plot 42',
  webBadge: 'Site externo',
  sandboxTitle: 'Jogue aqui na Plot 42',
  sandboxSubtitle: 'Jogos sandbox construídos neste lote. Abrem aqui mesmo, sem instalar nada.',
  webTitle: 'Jogos do estúdio',
  webSubtitle: 'Jogos completos com site próprio. O card abre a página do jogo.',
  playHere: 'Jogar',
  openSite: 'Abrir site',
  count: '{n} jogos',
  noResults: 'Nenhum jogo encontrado para “{q}”.',
  games: {
    vazante: {
      title: 'Vazante',
      blurb:
        'O rio subiu e os mortos saíram dele. Segure a cidade num RTS de zumbis em tempo real.',
    },
    'urbe-oasis': {
      title: 'Urbe Oasis',
      blurb: 'Erga uma cidade nas dunas. Cada gota d’água decide onde nasce o próximo quarteirão.',
    },
    urbe: {
      title: 'Urbe',
      blurb:
        'Zoneie o terreno, mantenha a luz acesa e deixe a cidade crescer — ou falhar — sozinha.',
    },
    neon: {
      title: 'Neo Urbe',
      blurb:
        'Megacorps compram os quarteirões, hackers vendem o escuro, drones dominam o céu. Mantenha a rede de pé.',
    },
    sitio: {
      title: 'Sítio',
      blurb: 'Plante café, segure as famílias e transforme a fazenda numa vila.',
    },
    horta: { title: 'Horta', blurb: 'Plante num lote, espere amadurecer e colha.' },
    posto: {
      title: 'Posto',
      blurb: 'Três unidades, um grid 10×10. Mova, ataque e segure o posto.',
    },
    mata: {
      title: 'Mata',
      blurb:
        'Restaure uma cicatriz. As plantas se sombreiam, bebem e se alimentam — a mata decide.',
    },
  },
  tags: {
    cityBuilder: 'Construção de cidade',
    simulation: 'Simulação',
    farming: 'Fazenda',
    management: 'Gestão',
    tactics: 'Tática',
    turnBased: 'Por turnos',
    ecology: 'Ecologia',
    cyberpunk: 'Cyberpunk',
    desert: 'Deserto',
    rts: 'Estratégia em tempo real',
    zombies: 'Zumbis',
    casual: 'Casual',
  },
};

const es: typeof en = {
  pageTitle: 'Plot 42 — Game Studio 42',
  title: 'Plot 42',
  tagline: 'Todos los juegos de Game Studio 42 en un solo escaparate.',
  language: 'Idioma',
  footer: 'Game Studio 42 · juegos de navegador de código abierto',
  search: 'Buscar juegos',
  searchPlaceholder: 'Busca por nombre o género…',
  filterAll: 'Todos',
  filterSandbox: 'Jugar aquí',
  filterWeb: 'Sitios del estudio',
  featured: 'Destacado',
  newBadge: 'Nuevo',
  sandboxBadge: 'Plot 42',
  webBadge: 'Sitio externo',
  sandboxTitle: 'Juega aquí en Plot 42',
  sandboxSubtitle: 'Juegos sandbox construidos en este lote. Se abren aquí mismo, sin instalar.',
  webTitle: 'Juegos del estudio',
  webSubtitle: 'Juegos completos con sitio propio. La tarjeta abre la página del juego.',
  playHere: 'Jugar',
  openSite: 'Abrir sitio',
  count: '{n} juegos',
  noResults: 'Ningún juego coincide con “{q}”.',
  games: {
    vazante: {
      title: 'Vazante',
      blurb:
        'El río creció y los muertos salieron de él. Defiende el pueblo en un RTS de zombis en tiempo real.',
    },
    'urbe-oasis': {
      title: 'Urbe Oasis',
      blurb:
        'Levanta una ciudad en las dunas. Cada gota de agua decide dónde nace la próxima manzana.',
    },
    urbe: {
      title: 'Urbe',
      blurb: 'Zonifica el terreno, mantén la luz y deja que la ciudad crezca — o falle — sola.',
    },
    neon: {
      title: 'Neo Urbe',
      blurb:
        'Las megacorporaciones compran las manzanas, los hackers venden la oscuridad, los drones dominan el cielo. Mantén la red en pie.',
    },
    sitio: {
      title: 'Sítio',
      blurb: 'Cultiva café, retén a las familias y convierte la finca en un pueblo.',
    },
    horta: { title: 'Horta', blurb: 'Siembra un lote, espera a que madure y cosecha.' },
    posto: {
      title: 'Posto',
      blurb: 'Tres unidades, una cuadrícula 10×10. Muévete, ataca y sostén el puesto.',
    },
    mata: {
      title: 'Mata',
      blurb:
        'Restaura una cicatriz. Las plantas se sombrean, beben y se alimentan — el bosque decide.',
    },
  },
  tags: {
    cityBuilder: 'Construcción de ciudades',
    simulation: 'Simulación',
    farming: 'Granja',
    management: 'Gestión',
    tactics: 'Táctica',
    turnBased: 'Por turnos',
    ecology: 'Ecología',
    cyberpunk: 'Cyberpunk',
    desert: 'Desierto',
    rts: 'Estrategia en tiempo real',
    zombies: 'Zombis',
    casual: 'Casual',
  },
};

const fr: typeof en = {
  pageTitle: 'Plot 42 — Game Studio 42',
  title: 'Plot 42',
  tagline: 'Tous les jeux de Game Studio 42, sur une seule vitrine.',
  language: 'Langue',
  footer: 'Game Studio 42 · jeux de navigateur open source',
  search: 'Rechercher des jeux',
  searchPlaceholder: 'Cherchez par nom ou genre…',
  filterAll: 'Tous',
  filterSandbox: 'Jouer ici',
  filterWeb: 'Sites du studio',
  featured: 'À la une',
  newBadge: 'Nouveau',
  sandboxBadge: 'Plot 42',
  webBadge: 'Site externe',
  sandboxTitle: 'Jouez ici sur Plot 42',
  sandboxSubtitle:
    'Des jeux bac à sable construits sur ce lot. Ils s’ouvrent ici, sans installation.',
  webTitle: 'Jeux du studio',
  webSubtitle: 'Des jeux complets avec leur propre site. La carte ouvre la page du jeu.',
  playHere: 'Jouer',
  openSite: 'Ouvrir le site',
  count: '{n} jeux',
  noResults: 'Aucun jeu ne correspond à « {q} ».',
  games: {
    vazante: {
      title: 'Vazante',
      blurb:
        'La rivière a monté, les morts en sont sortis. Tenez la ville dans un RTS de zombies en temps réel.',
    },
    'urbe-oasis': {
      title: 'Urbe Oasis',
      blurb:
        'Bâtissez une ville dans les dunes. Chaque goutte d’eau décide où naît le prochain quartier.',
    },
    urbe: {
      title: 'Urbe',
      blurb:
        'Zonez le terrain, gardez la lumière, et laissez la ville grandir — ou échouer — seule.',
    },
    neon: {
      title: 'Neo Urbe',
      blurb:
        'Les megacorps achètent les pâtés de maisons, les hackers vendent le noir, les drones règnent sur le ciel. Gardez le réseau debout.',
    },
    sitio: {
      title: 'Sítio',
      blurb: 'Cultivez le café, gardez les familles et transformez la ferme en village.',
    },
    horta: { title: 'Horta', blurb: 'Semez une parcelle, attendez qu’elle mûrisse, récoltez.' },
    posto: {
      title: 'Posto',
      blurb: 'Trois unités, une grille 10×10. Déplacez, frappez, tenez le poste.',
    },
    mata: {
      title: 'Mata',
      blurb:
        'Réparez une cicatrice. Les plantes s’ombragent, boivent et se nourrissent — le bosquet décide.',
    },
  },
  tags: {
    cityBuilder: 'Construction de ville',
    simulation: 'Simulation',
    farming: 'Ferme',
    management: 'Gestion',
    tactics: 'Tactique',
    turnBased: 'Tour par tour',
    ecology: 'Écologie',
    cyberpunk: 'Cyberpunk',
    desert: 'Désert',
    rts: 'Stratégie en temps réel',
    zombies: 'Zombies',
    casual: 'Casual',
  },
};

const de: typeof en = {
  pageTitle: 'Plot 42 — Game Studio 42',
  title: 'Plot 42',
  tagline: 'Alle Spiele von Game Studio 42 in einem Regal.',
  language: 'Sprache',
  footer: 'Game Studio 42 · Open-Source-Browserspiele',
  search: 'Spiele suchen',
  searchPlaceholder: 'Nach Name oder Genre suchen…',
  filterAll: 'Alle',
  filterSandbox: 'Hier spielen',
  filterWeb: 'Studio-Seiten',
  featured: 'Empfohlen',
  newBadge: 'Neu',
  sandboxBadge: 'Plot 42',
  webBadge: 'Externe Seite',
  sandboxTitle: 'Hier auf Plot 42 spielen',
  sandboxSubtitle:
    'Sandbox-Spiele, direkt auf diesem Grundstück gebaut. Sie starten hier, ohne Installation.',
  webTitle: 'Spiele des Studios',
  webSubtitle: 'Vollständige Spiele mit eigener Seite. Die Karte öffnet die Seite des Spiels.',
  playHere: 'Spielen',
  openSite: 'Seite öffnen',
  count: '{n} Spiele',
  noResults: 'Kein Spiel passt zu „{q}“.',
  games: {
    vazante: {
      title: 'Vazante',
      blurb:
        'Der Fluss stieg, die Toten kamen heraus. Halte die Stadt in einem Echtzeit-Zombie-RTS.',
    },
    'urbe-oasis': {
      title: 'Urbe Oasis',
      blurb:
        'Baue eine Stadt in den Dünen. Jeder Tropfen Wasser entscheidet, wo der nächste Block entsteht.',
    },
    urbe: {
      title: 'Urbe',
      blurb: 'Zoniere das Land, halte das Licht und lass die Stadt wachsen — oder scheitern.',
    },
    neon: {
      title: 'Neo Urbe',
      blurb:
        'Megakonzerne kaufen die Häuserblöcke, Hacker verkaufen das Dunkel, Drohnen beherrschen den Himmel. Halte das Netz am Leben.',
    },
    sitio: {
      title: 'Sítio',
      blurb: 'Kaffee anbauen, Familien halten und aus der Farm ein Dorf machen.',
    },
    horta: { title: 'Horta', blurb: 'Pflanze ein Feld, warte, bis es reif ist, ernte.' },
    posto: {
      title: 'Posto',
      blurb: 'Drei Einheiten, ein 10×10-Feld. Bewegen, angreifen, den Posten halten.',
    },
    mata: {
      title: 'Mata',
      blurb:
        'Heile eine Narbe. Pflanzen spenden Schatten, trinken und nähren einander — der Hain entscheidet.',
    },
  },
  tags: {
    cityBuilder: 'Städtebau',
    simulation: 'Simulation',
    farming: 'Landwirtschaft',
    management: 'Management',
    tactics: 'Taktik',
    turnBased: 'Rundenbasiert',
    ecology: 'Ökologie',
    cyberpunk: 'Cyberpunk',
    desert: 'Wüste',
    rts: 'Echtzeitstrategie',
    zombies: 'Zombies',
    casual: 'Casual',
  },
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
    if (
      stored === 'en' ||
      stored === 'pt-BR' ||
      stored === 'es' ||
      stored === 'fr' ||
      stored === 'de'
    ) {
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
