import { expect, type Page } from '@playwright/test';

export async function waitForCity(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__cityDebug?.isReady() === true, null, { timeout: 30_000 });
  // Give the renderer a few frames to draw the visible chunks.
  await page.waitForTimeout(500);
}

/** Starts a new city from the main menu with a fixed seed. */
export async function startCity(page: Page, seed = 'e2e'): Promise<void> {
  await page.goto('/');
  const menu = page.getByTestId('main-menu');
  if (await menu.isVisible().catch(() => false)) {
    await page.getByTestId('seed-input').fill(seed);
    await page.getByTestId('start-city').click();
  }
  await waitForCity(page);
}

export async function clientPointOf(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  await page.evaluate(([tx, ty]) => window.__cityDebug?.centerOnTile(tx as number, ty as number), [x, y]);
  await page.waitForTimeout(100);
  const point = await page.evaluate(([tx, ty]) => window.__cityDebug?.tileToClient(tx as number, ty as number), [x, y]);
  expect(point).toBeTruthy();
  return point as { x: number; y: number };
}
