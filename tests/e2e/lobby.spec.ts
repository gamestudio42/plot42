import { expect, test } from '@playwright/test';

/**
 * The lobby is the entry point of the static site, laid out as a store with two shelves.
 * Horta, Posto and Mata are sandbox games hosted here.
 * Urbe, Neo Urbe, Urbe Oasis, Vazante and Sítio open the sites published from their own repositories.
 * The spec runs against the built `site/` served by `pnpm preview:site`.
 */

const SITE_PORT = 4180;

const SANDBOX: Record<string, string> = {
  horta: 'horta/',
  posto: 'posto/',
  mata: 'mata/',
};

const WEB: Record<string, string> = {
  vazante: 'https://gamestudio42.github.io/vazante/',
  'urbe-oasis': 'https://gamestudio42.github.io/urbe-oasis/',
  urbe: 'https://gamestudio42.github.io/urbe/',
  neon: 'https://gamestudio42.github.io/neo-urbe/',
  sitio: 'https://gamestudio42.github.io/sitio/',
};

test.use({ baseURL: `http://localhost:${SITE_PORT}/` });

test('shelves sandbox and studio games apart, with their marks', async ({ page }) => {
  await page.goto('/');
  for (const [shelf, games] of [
    ['sandbox', SANDBOX],
    ['web', WEB],
  ] as const) {
    const section = page.getByTestId(`shelf-${shelf}`);
    await expect(section).toBeVisible();
    for (const [slug, href] of Object.entries(games)) {
      const card = section.getByTestId(`lobby-${slug}`);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('href', href);
      // BASE_PATH can prefix the mark, so only the tail is contractual.
      await expect(card.locator('img')).toHaveAttribute('src', new RegExp(`marks/${slug}\\.svg$`));
    }
  }
  await expect(page.getByTestId('lobby-featured')).toHaveAttribute('href', WEB.vazante);
});

test('filters by shelf and by search', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('filter-sandbox').click();
  await expect(page.getByTestId('shelf-web')).toHaveCount(0);
  await expect(page.getByTestId('shelf-sandbox').locator('.card')).toHaveCount(3);

  await page.getByTestId('filter-all').click();
  await page.getByTestId('lobby-search').fill('oasis');
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.getByTestId('lobby-urbe-oasis')).toBeVisible();
});

test('ships all five locales in the lobby', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('lobby-locale')).toBeVisible();
});
