import { useStore, type Store } from '../state/store';
import { de } from './de';
import { en, type Strings } from './en';
import { es } from './es';
import { fr } from './fr';
import { ptBR } from './pt-BR';

export type { Strings } from './en';

export const LOCALES = ['en', 'pt-BR', 'es', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export const LOCALE_KEY = 'cityBuilder.locale';

const CATALOGS: Record<Locale, Strings> = {
  en,
  'pt-BR': ptBR,
  es,
  fr,
  de,
};

const INTL: Record<Locale, string> = {
  en: 'en-US',
  'pt-BR': 'pt-BR',
  es: 'es',
  fr: 'fr-FR',
  de: 'de-DE',
};

const MONTHS: Record<Locale, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  'pt-BR': ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
};

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Maps a BCP 47 tag onto a catalog, ignoring unknown regions. */
export function matchLocale(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase().replaceAll('_', '-');
  if (lower === 'pt-br' || lower === 'pt' || lower.startsWith('pt-')) return 'pt-BR';
  const primary = lower.split('-')[0];
  if (primary === 'en') return 'en';
  if (primary === 'es') return 'es';
  if (primary === 'fr') return 'fr';
  if (primary === 'de') return 'de';
  return null;
}

export function resolveLocale(options?: {
  stored?: string | null;
  languages?: readonly string[];
}): Locale {
  const stored = options?.stored !== undefined ? options.stored : readStored();
  if (isLocale(stored)) return stored;
  const languages = options?.languages ?? readNavigator();
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
    // Private mode: the choice lasts for this session only.
  }
}

/** Resolves the locale and writes it so the next visit does not flip. */
export function bootLocale(): Locale {
  const locale = resolveLocale();
  persistLocale(locale);
  return locale;
}

export function catalog(locale: Locale): Strings {
  return CATALOGS[locale] ?? en;
}

export function useStrings(ui: Store<{ locale: Locale }>): Strings {
  const locale = useStore(ui, (s) => s.locale);
  return catalog(locale);
}

export function intlLocale(locale: Locale): string {
  return INTL[locale];
}

export function formatMoney(value: number, locale: Locale): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString(INTL[locale])}`;
}

export function formatNumber(value: number, locale: Locale): string {
  return Math.round(value).toLocaleString(INTL[locale]);
}

export function months(locale: Locale): readonly string[] {
  return MONTHS[locale];
}

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.title = catalog(locale).pageTitle;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}

function readNavigator(): string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages?.length) return [...navigator.languages];
  return navigator.language ? [navigator.language] : [];
}
