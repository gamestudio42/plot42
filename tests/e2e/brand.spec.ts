import { expect, test, type Page } from '@playwright/test';

async function openMenu(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('cityBuilder.tutorialDone', '1'));
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
}

test('the page carries the Urbe name and icon, and boots before the menu', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page).toHaveTitle(/Urbe/);
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(icon).toBeTruthy();
  const response = await page.request.get(icon as string);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('<svg');

  await expect(page.getByTestId('boot-screen')).toBeVisible();
  // While booting the menu is not mounted (checked in one synchronous read).
  const booting = await page.evaluate(() => ({
    step: document.querySelector('[data-testid="boot-screen"]')?.getAttribute('data-step'),
    menu: document.querySelector('[data-testid="main-menu"]') !== null,
  }));
  if (booting.step !== 'done') expect(booting.menu).toBe(false);
  await page.screenshot({ path: 'test-results/brand-boot.png' });

  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByTestId('boot-screen')).toHaveCount(0);
  await expect(page.locator('.menu-title')).toHaveAccessibleName(/Urbe/);
});

test('the menu shows a live city behind it', async ({ page }) => {
  await openMenu(page);
  expect(await page.evaluate(() => window.__cityDebug?.bootStep())).toBe('done');
  const stats = await page.evaluate(() => window.__cityDebug?.getStats());
  expect(stats?.population ?? 0).toBeGreaterThan(1000);
  await expect
    .poll(async () => (await page.evaluate(() => window.__cityDebug?.animationStats()))?.cars ?? 0)
    .toBeGreaterThan(0);
  // The background city keeps simulating and the camera drifts.
  const tick = stats?.tick ?? 0;
  const before = await page.evaluate(() => window.__cityDebug?.tileToClient(32, 32));
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__cityDebug?.tileToClient(32, 32));
  expect((await page.evaluate(() => window.__cityDebug?.getStats()))?.tick ?? 0).toBeGreaterThan(
    tick,
  );
  expect(after).not.toEqual(before);
  // Events of the background city never reach the player.
  await expect(page.getByTestId('toasts').locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/brand-menu.png' });
});
