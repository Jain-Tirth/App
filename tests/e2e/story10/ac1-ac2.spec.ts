/**
 * Phase 1 story 10, AC1 (manifest, installability) and AC2 (service worker active, offline shell).
 * App under test: the BUILT UserWeb served on 5191 (service workers register only in production builds).
 * Installability is checked with Chromium's own check through CDP (Page.getInstallabilityErrors); Lighthouse is not used.
 */
import { expect, test } from '@playwright/test';
import { BASE, attachShot, ctl, firstVisit, serverLog, stubFonts } from './support10';

test.beforeEach(async ({ context }) => {
  await ctl('reset');
  await stubFonts(context);
});

test.describe('AC1 manifest and installability', () => {
  test('AC1 manifest has every required member and the page links it', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/site.webmanifest');
    const res = await page.request.get(`${BASE}/site.webmanifest`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/manifest\+json|application\/json/);
    const m = await res.json();
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBeTruthy();
    expect(m.display).toBe('standalone');
    expect(m.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(m.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    const sizes = m.icons.map((i: any) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(m.icons.some((i: any) => String(i.purpose ?? '').split(/\s+/).includes('maskable'))).toBe(true);
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe(m.theme_color);
  });

  test('AC1 every icon URL answers 200 with an image type and the pixel size matches the declared size', async ({ page }) => {
    await page.goto('/');
    const m = await (await page.request.get(`${BASE}/site.webmanifest`)).json();
    for (const icon of m.icons) {
      const r = await page.request.get(new URL(icon.src, BASE).toString());
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()['content-type'], icon.src).toMatch(/^image\//);
      const dims = await page.evaluate(async (src) => {
        const bmp = await createImageBitmap(await (await fetch(src)).blob());
        return `${bmp.width}x${bmp.height}`;
      }, icon.src);
      expect(dims, `declared ${icon.sizes} for ${icon.src}`).toBe(icon.sizes);
    }
  });

  test('AC1 Chromium reports no installability errors for the built app on localhost (CDP Page.getInstallabilityErrors)', async ({ page, context }) => {
    await firstVisit(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    const manifest: any = await cdp.send('Page.getAppManifest');
    expect(manifest.errors, 'manifest parse errors').toEqual([]);
    expect(manifest.url).toBe(`${BASE}/site.webmanifest`);
    const result: any = await cdp.send('Page.getInstallabilityErrors');
    test.info().annotations.push({ type: 'installabilityErrors', description: JSON.stringify(result.installabilityErrors) });
    expect(result.installabilityErrors).toEqual([]);
  });

  test('AC1 edge: a page without the manifest link has no app manifest in CDP (getAppManifest is not vacuous)', async ({ page, context }) => {
    await context.route(`${BASE}/`, async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace(/<link rel="manifest"[^>]*>/, '');
      await route.fulfill({ response: res, body: html });
    });
    await page.goto('/');
    expect(await page.locator('link[rel="manifest"]').count()).toBe(0);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    // Finding: in this headless Chromium Page.getInstallabilityErrors answers [] even here (it is not informative), so the
    // positive AC1 check above leans on Page.getAppManifest (url, parse errors) plus the explicit manifest assertions.
    const m: any = await cdp.send('Page.getAppManifest');
    expect(m.url).toBe('');
    const errs: any = await cdp.send('Page.getInstallabilityErrors');
    test.info().annotations.push({ type: 'installabilityErrors-without-manifest', description: JSON.stringify(errs.installabilityErrors) });
  });
});

test.describe('AC2 service worker and offline shell', () => {
  test('AC2 after the first visit the worker is registered, active and controlling', async ({ page }) => {
    await firstVisit(page);
    const info = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return { scope: reg?.scope, state: reg?.active?.state, script: reg?.active?.scriptURL, controlled: Boolean(navigator.serviceWorker.controller) };
    });
    expect(info.scope).toBe(`${BASE}/`);
    expect(info.state).toBe('activated');
    expect(info.script).toBe(`${BASE}/sw.js`);
    expect(info.controlled).toBe(true);
    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames).toHaveLength(1);
    expect(cacheNames[0]).toMatch(/^dhobi-shell-[0-9a-f]{12}$/);
  });

  test('AC2 offline (context.setOffline) reload of / renders the app shell, not the browser error page', async ({ page, context }) => {
    await firstVisit(page);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await ctl('reset'); // clears the server request log
    await context.setOffline(true);
    await page.reload();
    expect(page.url()).toBe(`${BASE}/`);
    await expect(page.locator('#root')).not.toBeEmpty();
    expect(await page.title()).toBe('Dhobi Matrimony');
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    const seen = await serverLog();
    test.info().annotations.push({ type: 'server-requests-while-offline', description: JSON.stringify(seen) });
    expect(seen, 'the shell must come from the worker, not the network').toEqual([]);
    await attachShot(page, 'ac2-offline-shell');
  });

  test('AC2 server unreachable (sockets destroyed, navigator stays online) still serves / and a deep link from the shell cache', async ({ page }) => {
    await firstVisit(page);
    await ctl('down');
    await page.goto('/login');
    await expect(page.getByTestId('login-email')).toBeVisible();
    expect(await page.title()).toBe('Dhobi Matrimony');
    await page.goto('/');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('AC2 edge: a never-visited browser context offline gets the browser error page (no worker yet)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const page = await ctx.newPage();
    await ctx.setOffline(true);
    await expect(page.goto('/')).rejects.toThrow(/ERR_INTERNET_DISCONNECTED/);
    await ctx.close();
  });
});
