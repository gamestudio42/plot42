/**
 * The Plot 42 store shelf.
 *
 * `sandbox` games are built into this site (`tools/build-site.ts`) and play on the lot.
 * `web` games ship from their own repositories; the lobby only links to their Pages sites.
 */

export const TAGS = [
  'cityBuilder',
  'simulation',
  'farming',
  'management',
  'tactics',
  'turnBased',
  'ecology',
  'cyberpunk',
  'desert',
  'rts',
  'zombies',
  'casual',
] as const;
export type Tag = (typeof TAGS)[number];

export const GAME_SLUGS = [
  'vazante',
  'urbe-oasis',
  'urbe',
  'neon',
  'sitio',
  'horta',
  'posto',
  'mata',
] as const;
export type GameSlug = (typeof GAME_SLUGS)[number];

interface BaseGame {
  slug: GameSlug;
  tags: readonly Tag[];
  /** Placeholder gradient behind the cover screenshot (`public/covers/<slug>.webp`). */
  cover: readonly [string, string];
  accent: string;
  isNew?: boolean;
  /** Snap Store package name, when the game also ships as a Linux snap (snapcraft.io/<snap>). */
  snap?: string;
}

export interface SandboxGame extends BaseGame {
  kind: 'sandbox';
  /** Vite dev port; the built site serves the game at `<slug>/`. */
  port: number;
}

export interface WebGame extends BaseGame {
  kind: 'web';
  href: string;
}

export type Game = SandboxGame | WebGame;

const PAGES = 'https://gamestudio42.github.io';

export const GAMES: readonly Game[] = [
  {
    slug: 'vazante',
    kind: 'web',
    href: `${PAGES}/vazante/`,
    tags: ['rts', 'zombies'],
    cover: ['#3b1d1a', '#0f1a12'],
    accent: '#ff5a45',
    isNew: true,
    snap: 'vazante',
  },
  {
    slug: 'urbe-oasis',
    kind: 'web',
    href: `${PAGES}/urbe-oasis/`,
    tags: ['cityBuilder', 'desert'],
    cover: ['#e0a14e', '#1c8a94'],
    accent: '#f2b84b',
    isNew: true,
  },
  {
    slug: 'urbe',
    kind: 'web',
    href: `${PAGES}/urbe/`,
    tags: ['cityBuilder', 'simulation'],
    cover: ['#2f63b3', '#1d4d2a'],
    accent: '#5b8def',
  },
  {
    slug: 'neon',
    kind: 'web',
    href: `${PAGES}/neo-urbe/`,
    tags: ['cityBuilder', 'cyberpunk'],
    cover: ['#3a0d3d', '#05222e'],
    accent: '#22d3ee',
  },
  {
    slug: 'sitio',
    kind: 'web',
    href: `${PAGES}/sitio/`,
    tags: ['farming', 'management'],
    cover: ['#9a5a2c', '#3d5a22'],
    accent: '#e09a52',
  },
  {
    slug: 'horta',
    kind: 'sandbox',
    port: 5174,
    tags: ['farming', 'casual'],
    cover: ['#3d8f4a', '#4a3824'],
    accent: '#4ade80',
  },
  {
    slug: 'posto',
    kind: 'sandbox',
    port: 5175,
    tags: ['tactics', 'turnBased'],
    cover: ['#b8662a', '#2a2f3a'],
    accent: '#f0a14a',
  },
  {
    slug: 'mata',
    kind: 'sandbox',
    port: 5177,
    tags: ['ecology', 'simulation'],
    cover: ['#6b8a2c', '#1f3a2a'],
    accent: '#c4d44a',
  },
];

export const FEATURED: GameSlug = 'vazante';

export function snapHref(snap: string): string {
  return `https://snapcraft.io/${snap}`;
}

export function gameHref(game: Game, dev: boolean = import.meta.env.DEV): string {
  if (game.kind === 'web') return game.href;
  return dev ? `http://localhost:${game.port}/` : `${game.slug}/`;
}

/** Host and path shown under an external card, e.g. `gamestudio42.github.io/urbe`. */
export function displayHost(href: string): string {
  const url = new URL(href);
  return `${url.host}${url.pathname.replace(/\/$/, '')}`;
}
