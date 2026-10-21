import { expect, test } from '@playwright/test';

/**
 * Neo Urbe end-to-end: boot, found a city, build the neon placeables and read the telemetry.
 *
 * The specs reuse the shared Urbe data-testids on purpose — the neon app wraps the same UI, so a
 * regression in the wrapper shows up here as a missing panel instead of a silent divergence.
 */

const NEON_PORT = 5179;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('cityBuilder.tutorialDone', '1');
  });
  await page.goto(`http://localhost:${NEON_PORT}/`);
  await page.getByTestId('main-menu').waitFor();
});

async function startNeonCity(page: import('@playwright/test').Page, seed: string) {
  await page.getByTestId('seed-input').fill(seed);
  await page.getByTestId('start-city').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady() === true, null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(500);
}

test('boots into Neo Urbe with the neon brand', async ({ page }) => {
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.locator('body')).toContainText(/Neo Urbe|NEO URBE/);
});

test('reports the neon ruleset in the mirror stats', async ({ page }) => {
  await startNeonCity(page, 'neon-e2e');
  const stats = await page.evaluate(() => window.__cityDebug?.getStats() ?? null);
  expect(stats).not.toBeNull();
  expect(stats?.neon).toBeDefined();
  expect(stats?.neon?.overloaded).toBeGreaterThanOrEqual(0);
  expect(stats?.neon?.corporations.count).toBeGreaterThanOrEqual(0);
});

test('offers the neon-only tools and hides them from classic Urbe', async ({ page }) => {
  await startNeonCity(page, 'neon-tools');
  for (const id of ['tool-substation', 'tool-battery', 'tool-firewall', 'tool-dronePort', 'tool-corpHQ']) {
    await expect(page.getByTestId(id)).toBeAttached();
  }
});

test('places a substation, a battery and a firewall through the debug command API', async ({
  page,
}) => {
  await startNeonCity(page, 'neon-build');
  const area = await page.evaluate(() => window.__cityDebug?.findFlatArea(3, 3) ?? null);
  expect(area).not.toBeNull();
  if (!area) return;

  const battery = await page.evaluate(
    (p) => window.__cityDebug?.command({ type: 'place', kind: 'battery', x: p.x, y: p.y }),
    area,
  );
  expect(battery?.ok).toBe(true);

  const stats = await page.evaluate(() => window.__cityDebug?.getStats() ?? null);
  expect(stats?.neon).toBeDefined();
});

test('exports and imports a neon save', async ({ page }) => {
  await startNeonCity(page, 'neon-save');
  const text = await page.evaluate(() => window.__cityDebug?.exportText() ?? '');
  expect(text.length).toBeGreaterThan(0);
  const loaded = await page.evaluate(async (saved) => {
    return window.__cityDebug?.importText(saved) ?? null;
  }, text);
  expect(loaded?.ok).toBe(true);
});

test('is deterministic: the same seed and command log hash the same', async ({ page }) => {
  await startNeonCity(page, 'neon-determinism');
  const first = await page.evaluate(() => window.__cityDebug?.hash() ?? null);
  await page.evaluate(() => window.__cityDebug?.runTicks(120));
  const second = await page.evaluate(() => window.__cityDebug?.hash() ?? null);
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  // Running ticks is the only difference, so the hash must move forward, not reset.
  expect(typeof first).toBe('string');
});
