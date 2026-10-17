import { expect, test } from '@playwright/test';
import { LEVELS } from '../src/levels';

type State = { won: boolean; time: number; falls: number; progress: number | null; level: string };

for (const level of LEVELS) {
  test(`autopilot finishes level ${level.id} with the real physics`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one browser is enough to prove a level can be finished');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/?autopilot`);
    await page.evaluate((id) => {
      // Unlock every level for the test.
      const records: Record<string, unknown> = {};
      for (const l of ['1-1', '1-2', '1-3']) if (l !== id) records[l] = { best: 99, gems: [false, false, false] };
      localStorage.setItem('wj2.progress', JSON.stringify(records));
    }, level.id);
    await page.reload();
    await page.getByRole('button', { name: 'Gioca' }).click();
    await page.getByRole('button', { name: new RegExp(level.id) }).click();
    // Desktop shows the intro card; the autopilot does not need pointer lock.
    const start = page.getByRole('button', { name: 'Clicca per giocare' });
    await start.click();
    await page.evaluate(() => document.dispatchEvent(new Event('pointerlockchange')));

    await expect
      .poll(async () => (await page.evaluate(() => (window as unknown as { __wj?: State }).__wj))?.won ?? false, {
        timeout: 90_000,
        intervals: [500],
      })
      .toBe(true);
    const state = (await page.evaluate(() => (window as unknown as { __wj: State }).__wj)) as State;
    await page.screenshot({ path: `test-results/finish-${level.id}.png` });
    expect(state.falls, 'the autopilot should not fall').toBe(0);
    expect(errors).toEqual([]);
  });
}

test('menu, level start and HUD work without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /World/ })).toBeVisible();
  await page.getByRole('button', { name: 'Gioca' }).click();
  await page.getByRole('button', { name: /1-1/ }).click();
  await expect(page.locator('#hud-time')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});
