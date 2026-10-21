import { expect, test } from '@playwright/test';

/**
 * The lobby is the entry point of the static site: it must link every game, including Neo Urbe,
 * with its own mark. The spec runs against the built `site/` served by `pnpm preview:site`.
 */

const SITE_PORT = 4180;

test.use({ baseURL: `http://localhost:${SITE_PORT}/` });

test('links the five games with their marks', async ({ page }) => {
  await page.goto('/');
  for (const slug of ['urbe', 'horta', 'posto', 'mata', 'neon']) {
    const card = page.getByTestId(`lobby-${slug}`);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', `${slug}/`);
    const mark = card.locator('img');
    // BASE_PATH can prefix the mark, so only the tail is contractual.
    await expect(mark).toHaveAttribute('src', new RegExp(`marks/${slug}\\.svg$`));
  }
});

test('ships all five locales in the lobby', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('lobby-locale')).toBeVisible();
});
