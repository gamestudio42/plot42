import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PostoEngine } from '@posto/sim';

test.use({ locale: 'en-US', reducedMotion: 'reduce' });

type Game = 'horta' | 'posto' | 'mata';

async function start(page: Page, game: Game, name?: string) {
  await page.goto('./' + game + '/');
  await expect(page.getByTestId(game + '-menu')).toBeVisible();
  if (name) await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page.getByTestId(game + '-new').click();
  await expect(page.getByTestId(game + '-hud')).toBeVisible();
  await expect(page.locator('.session-busy')).toHaveCount(0);
  if (game === 'mata') await page.getByTestId('mata-guide-close').click();
  if (game === 'horta') await page.getByTestId('horta-speed-0').click();
}

/** Flat boards start centered on tile floor(size/2), with the default 64x32 projection. */
async function tile(page: Page, x: number, y: number, size = 16) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Missing game canvas');
  const center = Math.floor(size / 2);
  await page.mouse.click(
    box.x + box.width / 2 + (x - y) * 32,
    box.y + box.height / 2 + (x + y - center * 2) * 16,
  );
}

async function exported(
  page: Page,
  game: Game,
): Promise<{ checksum: string; state: Record<string, unknown> }> {
  const downloaded = page.waitForEvent('download');
  await page
    .getByTestId(game + '-hud')
    .getByTestId(game + '-export')
    .click();
  const path = await (await downloaded).path();
  if (!path) throw new Error('Missing save download');
  return JSON.parse(await readFile(path, 'utf8'));
}

async function checkpoint(page: Page, game: Game) {
  await page.getByTestId(game + '-save').click();
  await expect(page.getByTestId('toasts')).toContainText('saved.');
}

test('Horta preserves a harvested crop through Menu, resume and reload', async ({ page }) => {
  await start(page, 'horta');
  await tile(page, 8, 8);
  await page.getByTestId('horta-speed-3').click();
  await expect(page.getByTestId('horta-ripe')).toContainText('1');
  await page.getByTestId('horta-speed-0').click();
  await checkpoint(page, 'horta');
  await tile(page, 8, 8);
  await expect(page.getByTestId('horta-harvested')).toContainText('1');
  const before = await exported(page, 'horta');
  expect(before.state.harvested).toBe(1);

  await page.getByTestId('horta-menu-button').click();
  await expect(page.getByTestId('horta-continue')).toContainText('Resume session');
  await page.getByTestId('horta-continue').click();
  expect((await exported(page, 'horta')).checksum).toBe(before.checksum);

  await checkpoint(page, 'horta');
  await page.reload();
  await page.getByTestId('horta-continue').click();
  await expect(page.getByTestId('horta-harvested')).toContainText('1');
  expect((await exported(page, 'horta')).checksum).toBe(before.checksum);
});

for (const game of ['horta', 'posto', 'mata'] as const) {
  test(game + ' keeps separate worlds and restores the selected checkpoint', async ({ page }) => {
    await start(page, game, 'First');
    if (game === 'horta') await tile(page, 8, 8);
    if (game === 'mata') await tile(page, 8, 8);
    if (game === 'posto') {
      const engine = PostoEngine.create({ name: 'First', seed: 'posto' });
      const actor = engine.living('player')[0]!;
      const target = [
        [actor.x + 1, actor.y],
        [actor.x - 1, actor.y],
        [actor.x, actor.y + 1],
      ].find(([x, y]) => engine.inBounds(x!, y!) && !engine.unitAt(x!, y!))!;
      await tile(page, actor.x, actor.y, 10);
      await tile(page, target[0]!, target[1]!, 10);
    }
    const first = await exported(page, game);
    if (game === 'posto') expect(first.state.turn).toBe(1);
    await page.getByTestId(game + '-menu-button').click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Second');
    await page.getByTestId(game + '-new').click();
    await expect(page.locator('.session-busy')).toHaveCount(0);
    if (game === 'mata') await page.getByTestId('mata-guide-close').click();
    await page.getByTestId(game + '-menu-button').click();
    await expect(page.getByTestId('save-slot')).toHaveCount(2);
    await page.locator('.save-list li').filter({ hasText: 'First' }).getByRole('button').click();
    await expect(page.locator('.session-busy')).toHaveCount(0);
    if (game === 'mata') await page.getByTestId('mata-guide-close').click();
    expect((await exported(page, game)).checksum).toBe(first.checksum);
    await checkpoint(page, game);
    await page.reload();
    await page.getByTestId(game + '-continue').click();
    await expect(page.locator('.session-busy')).toHaveCount(0);
    if (game === 'mata') await page.getByTestId('mata-guide-close').click();
    expect((await exported(page, game)).checksum).toBe(first.checksum);
  });
}

test('a malformed save leaves the current Horta intact', async ({ page }) => {
  await start(page, 'horta');
  await tile(page, 8, 8);
  const before = await exported(page, 'horta');
  await page.getByTestId('horta-menu-button').click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"invalid":true}'),
  });
  await expect(page.getByTestId('toasts')).toContainText('not a valid save');
  await page.getByTestId('horta-continue').click();
  expect((await exported(page, 'horta')).checksum).toBe(before.checksum);
});

test('storage failure preserves the live world, blocks replacement and offers file export', async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('Blocked for recovery test', 'SecurityError');
    };
  });
  await start(page, 'horta', 'Keep me');
  await tile(page, 8, 8);
  await expect(page.getByTestId('storage-error')).toBeVisible();
  const before = await exported(page, 'horta');
  await page.getByTestId('horta-menu-button').click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Replacement');
  await page.getByTestId('horta-new').click();
  await expect(page.locator('.session-busy')).toHaveCount(0);
  await expect(page.getByTestId('horta-menu')).toBeVisible();
  await page.getByTestId('horta-continue').click();
  expect((await exported(page, 'horta')).checksum).toBe(before.checksum);
});

test('legacy autosave slots are still loadable without overwriting another world', async ({
  page,
}) => {
  await start(page, 'horta', 'Legacy');
  await tile(page, 8, 8);
  await checkpoint(page, 'horta');
  const before = await exported(page, 'horta');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('horta');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['meta', 'data'], 'readwrite');
      const request = tx.objectStore('meta').getAll();
      request.onsuccess = () => {
        const slot = request.result[0];
        const data = tx.objectStore('data').get(slot.id);
        data.onsuccess = () => {
          tx.objectStore('meta').delete(slot.id);
          tx.objectStore('data').delete(slot.id);
          tx.objectStore('meta').put({ ...slot, id: 'autosave' });
          tx.objectStore('data').put({ ...data.result, id: 'autosave' });
        };
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByTestId('horta-continue').click();
  expect((await exported(page, 'horta')).checksum).toBe(before.checksum);
});

test('worker startup failure has a recovery screen rather than an endless loader', async ({
  page,
}) => {
  await page.route(/horta\.worker.*\.js/, (route) => route.abort());
  await page.goto('./horta/');
  await expect(page.getByRole('alert')).toContainText('stopped responding');
  await expect(page.getByRole('button', { name: 'Reload game', exact: true })).toBeVisible();
});

test('Mata allows unhurried planning, exposes its objective and starts at the new pace', async ({
  page,
}) => {
  await page.goto('./mata/');
  await page.getByTestId('mata-new').click();
  await expect(page.getByRole('dialog')).toContainText('six minutes');
  await expect(page.getByRole('dialog')).toContainText('6 plants, 3 species and 16 balance');
  await page.waitForTimeout(6_000); // Regression: the former challenge was already over at this point.
  await expect(page.getByTestId('mata-day')).toHaveText('Day 0');
  await page.getByTestId('mata-guide-close').click();
  await tile(page, 8, 8);
  await expect(page.getByTestId('mata-tool-grass')).toContainText('27');
  await expect(page.getByTestId('mata-day')).toHaveText('Day 0');
  await page.getByTestId('mata-speed-1').click();
  await expect(page.getByTestId('mata-day')).toHaveText('Day 1', { timeout: 12_000 });
  await expect(page.getByTestId('mata-outcome')).toHaveCount(0);
});

test('Mata can win a full season through normal UI actions and resources', async ({ page }) => {
  test.setTimeout(210_000);
  await start(page, 'mata');
  const trees = [
    [7, 7],
    [9, 7],
    [8, 9],
  ] as const;
  const grass = [
    [8, 7],
    [7, 8],
    [9, 8],
  ] as const;
  const cactus = [
    [6, 6],
    [10, 6],
    [8, 10],
  ] as const;
  for (const [kind, spots] of [
    ['inga', trees],
    ['grass', grass],
    ['cactus', cactus],
  ] as const) {
    await page.getByTestId('mata-tool-' + kind).click();
    for (const [x, y] of spots) await tile(page, x, y);
  }
  const water = async (spots: readonly (readonly [number, number])[]) => {
    await page.getByTestId('mata-tool-water').click();
    for (const [x, y] of spots) await tile(page, x, y);
  };
  await water(trees);
  for (const [day, spots] of [
    [8, trees],
    [24, trees],
    [28, grass],
    [32, trees],
  ] as const) {
    await page.getByTestId('mata-speed-3').click();
    await expect(page.getByTestId('mata-day')).toHaveText('Day ' + day, { timeout: 55_000 });
    await page.getByTestId('mata-speed-0').click();
    await water(spots);
  }
  await page.getByTestId('mata-speed-3').click();
  await expect(page.getByTestId('mata-outcome')).toContainText('The grove held.', {
    timeout: 40_000,
  });
  await expect(page.getByTestId('mata-cistern')).toContainText('8');
});

test('Mata guide and critical HUD regions remain usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, 'mata');
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Field guide', exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('mata-guide-narrow.png') });
  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByTestId('mata-speed-1').click();
  await page.getByTestId('mata-speed-0').click();
  const hud = await page.getByTestId('mata-hud').boundingBox();
  const pause = await page.locator('.paused-banner').boundingBox();
  expect(pause!.y).toBeGreaterThanOrEqual(hud!.y + hud!.height);
  await page.screenshot({ path: test.info().outputPath('mata-hud-narrow.png') });
  await page.getByTestId('mata-menu-button').click();
  await expect(page.getByTestId('mata-continue')).toBeVisible();
});
