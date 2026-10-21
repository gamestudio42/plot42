import { setCatalogOverride, type Locale } from '@neon/web/i18n';

/**
 * Neo Urbe copy. Rather than forking five catalogs, each locale overrides only the strings that
 * change with the cyberpunk setting: the title, the menu pitch, the city name and the vocabulary
 * of the new systems. Everything else keeps the Urbe wording, so the two games stay in sync.
 */

type Copy = {
  pageTitle: string;
  subtitle: string;
  defaultCityName: string;
  tagline: string;
  grid: string;
  corps: string;
  ice: string;
  drones: string;
  vertical: string;
  overload: string;
  battery: string;
  firewall: string;
  hacked: string;
  corpOwned: string;
  droneLane: string;
};

const EN: Copy = {
  pageTitle: 'Neo Urbe — jack into the city',
  subtitle: 'Raise a neon skyline, keep the grid alive and sell nothing to the corps.',
  defaultCityName: 'Neon City',
  tagline: 'The grid is unstable. So is everything else.',
  grid: 'Power grid',
  corps: 'Megacorps',
  ice: 'ICE',
  drones: 'Drones',
  vertical: 'Spires',
  overload: 'Grid overload',
  battery: 'Battery charge',
  firewall: 'ICE cover',
  hacked: 'Hacked',
  corpOwned: 'Corporate lot',
  droneLane: 'Drone lane',
};

const PT: Copy = {
  pageTitle: 'Neo Urbe — conecte-se à cidade',
  subtitle: 'Erga um horizonte de neon, mantenha a rede viva e não venda nada às corporações.',
  defaultCityName: 'Cidade Neon',
  tagline: 'A rede é instável. O resto também.',
  grid: 'Rede elétrica',
  corps: 'Megacorporações',
  ice: 'ICE',
  drones: 'Drones',
  vertical: 'Torres',
  overload: 'Sobrecarga da rede',
  battery: 'Carga das baterias',
  firewall: 'Cobertura de ICE',
  hacked: 'Invadido',
  corpOwned: 'Lote corporativo',
  droneLane: 'Rota de drones',
};

const ES: Copy = {
  pageTitle: 'Neo Urbe — conéctate a la ciudad',
  subtitle: 'Levanta un horizonte de neón, mantén la red viva y no le vendas nada a las corporaciones.',
  defaultCityName: 'Ciudad Neón',
  tagline: 'La red es inestable. Todo lo demás también.',
  grid: 'Red eléctrica',
  corps: 'Megacorporaciones',
  ice: 'ICE',
  drones: 'Drones',
  vertical: 'Torres',
  overload: 'Sobrecarga de red',
  battery: 'Carga de baterías',
  firewall: 'Cobertura de ICE',
  hacked: 'Hackeado',
  corpOwned: 'Solar corporativo',
  droneLane: 'Ruta de drones',
};

const FR: Copy = {
  pageTitle: 'Neo Urbe — connecte-toi à la ville',
  subtitle: 'Dresse un horizon de néon, garde le réseau en vie et ne vends rien aux corporations.',
  defaultCityName: 'Ville Néon',
  tagline: 'Le réseau est instable. Le reste aussi.',
  grid: 'Réseau électrique',
  corps: 'Megacorporations',
  ice: 'ICE',
  drones: 'Drones',
  vertical: 'Tours',
  overload: 'Surcharge du réseau',
  battery: 'Charge des batteries',
  firewall: 'Couverture ICE',
  hacked: 'Piraté',
  corpOwned: 'Lot corporatif',
  droneLane: 'Couloir de drones',
};

const DE: Copy = {
  pageTitle: 'Neo Urbe — steig in die Stadt ein',
  subtitle: 'Baue eine Neon-Skyline, halte das Netz am Leben und verkaufe nichts an die Konzerne.',
  defaultCityName: 'Neonstadt',
  tagline: 'Das Netz ist instabil. Alles andere auch.',
  grid: 'Stromnetz',
  corps: 'Megakonzerne',
  ice: 'ICE',
  drones: 'Drohnen',
  vertical: 'Türme',
  overload: 'Netzüberlastung',
  battery: 'Batterieladung',
  firewall: 'ICE-Abdeckung',
  hacked: 'Gehackt',
  corpOwned: 'Konzerngrundstück',
  droneLane: 'Drohnenroute',
};

const COPY: Record<Locale, Copy> = {
  en: EN,
  'pt-BR': PT,
  es: ES,
  fr: FR,
  de: DE,
};

/** Applies the Neo copy on top of the Urbe catalog for one locale. */
export function applyNeonCopy(locale: Locale): void {
  const copy = COPY[locale] ?? EN;
  setCatalogOverride(locale, {
    brand: 'NEO URBE',
    pageTitle: copy.pageTitle,
    menu: {
      subtitle: copy.subtitle,
      defaultCityName: copy.defaultCityName,
    },
  });
}

/** Vocabulary used by the Neo panels, resolved per locale. */
export function neonCopy(locale: Locale): Copy {
  return COPY[locale] ?? EN;
}
