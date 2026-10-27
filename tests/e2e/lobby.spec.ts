import { expect, test } from '@playwright/test';

/**
 * The lobby is the entry point of the static site. Horta, Posto, Mata and Sítio are hosted here.
 * Urbe and Neo Urbe open the sites published from their own repositories.
 * The spec runs against the built `site/` served by `pnpm preview:site`.
 */

const SITE_PORT = 4180;

const HREFS: Record<string, string> = {
  urbe: 'https://gamestudio42.github.io/urbe/',
  horta: 'horta/',
  posto: 'posto/',
  mata: 'mata/',
  sitio: 'sitio/',
  neon: 'https://gamestudio42.github.io/neo-urbe/',
};

test.use({ baseURL: `http://localhost:${SITE_PORT}/` });

test('links the six games with their marks', async ({ page }) => {
  await page.goto('/');
  for (const slug of ['urbe', 'horta', 'posto', 'mata', 'sitio', 'neon']) {
    const card = page.getByTestId(`lobby-${slug}`);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', HREFS[slug]);
    const mark = card.locator('img');
    // BASE_PATH can prefix the mark, so only the tail is contractual.
    await expect(mark).toHaveAttribute('src', new RegExp(`marks/${slug}\\.svg$`));
  }
});

test('ships all five locales in the lobby', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('lobby-locale')).toBeVisible();
});
