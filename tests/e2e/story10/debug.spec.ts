/** Supplementary AC2/AC5 check (file name is historical): a first visit leaves no waiting worker and shows no update prompt. */
import { expect, test } from '@playwright/test';
import { ctl, firstVisit, stubFonts } from './support10';

test('AC2/AC5 first visit: worker active, nothing waiting, no update prompt, no reload from the first install', async ({ page, context }) => {
  await ctl('reset');
  await stubFonts(context);
  let loads = 0;
  page.on('load', () => loads++);
  await firstVisit(page);
  const info = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { active: reg?.active?.state, installing: Boolean(reg?.installing), waiting: Boolean(reg?.waiting) };
  });
  expect(info).toEqual({ active: 'activated', installing: false, waiting: false });
  await expect(page.getByTestId('update-prompt')).toHaveCount(0);
  await page.waitForTimeout(1500); // bounded negative check: the first install must not cause a reload
  expect(loads).toBe(1);
});
