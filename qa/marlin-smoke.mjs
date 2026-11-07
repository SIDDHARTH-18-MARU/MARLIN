import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startStaticServer } from './static-server.mjs';

const [engine = 'chromium', directory = 'dist', mount = '/', decisionMode = 'approve'] = process.argv.slice(2);
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
assert.ok(['approve', 'reject'].includes(decisionMode));
const server = await startStaticServer(directory, mount);
const { base, origin } = server;
const output = path.resolve('.private', 'phase2-qa', engine + (mount === '/' ? '-root-' : '-subpath-') + decisionMode);
await fs.mkdir(output, { recursive: true });
const results = { checks: [], axe: [], externalRequests: [], failedLocalRequests: [], pageErrors: [], consoleErrors: [] };
const check = async (name, run) => {
  try {
    const details = await run();
    results.checks.push({ name, passed: true, details });
    console.log('PASS', name, details ?? '');
  } catch (error) {
    results.checks.push({ name, passed: false, error: String(error.message).slice(0, 1200) });
    console.log('FAIL', name, error.message);
    throw error;
  }
};
const pageFor = async (browser, viewport, disableWebgl = false) => {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
    results.externalRequests.push(url.origin);
    return route.abort();
  });
  await context.addInitScript(disable => {
    // Use a common small runner budget for Cesium worker pools.
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    if (disable) {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type.startsWith('webgl') || type === 'experimental-webgl' ? null : getContext.call(this, type, ...args);
      };
    }
  }, disableWebgl);
  const page = await context.newPage();
  page.on('console', message => {
    if (message.type() === 'error') results.consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('pageerror', error => results.pageErrors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(origin) && response.status() >= 400) results.failedLocalRequests.push({ status: response.status(), path: new URL(response.url()).pathname });
  });
  return { page, context };
};
const runAxe = async (page, name) => {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  results.axe.push({ name, violations: violations.map(v => ({ id: v.id, targets: v.nodes.slice(0, 8).map(n => n.target) })) });
};

let browser;
try {
  await check('Plain static server: module MIME, cache revalidation and private paths', async () => {
    const shell = await fetch(base);
    assert.equal(shell.status, 200);
    assert.equal(shell.headers.get('cache-control'), 'no-cache');
    const document = await shell.text();
    const modulePath = document.match(/<script[^>]+src="([^"]+)"/)[1];
    assert.ok(modulePath.startsWith(mount + 'assets/'));
    const module = await fetch(origin + modulePath, { method: 'HEAD' });
    assert.match(module.headers.get('content-type'), /javascript/);
    assert.match(module.headers.get('cache-control'), /immutable/);
    const hull = await fetch(base + 'assets/vessels/container-ship.glb', { method: 'HEAD' });
    assert.equal(hull.status, 200);
    assert.equal(hull.headers.get('content-type'), 'model/gltf-binary');
    assert.match(hull.headers.get('cache-control'), /must-revalidate/);
    const again = await fetch(base + 'assets/vessels/container-ship.glb', { headers: { 'if-none-match': hull.headers.get('etag') } });
    assert.equal(again.status, 304);
    const notices = await fetch(base + 'THIRD-PARTY-NOTICES.txt');
    assert.equal(notices.status, 200);
    const noticeText = await notices.text();
    assert.match(noticeText, /cesium@1\.144\.0/);
    assert.match(noticeText, /bitmap-sdf@1\.0\.4 \(MIT\)\s+[\s\S]*?\(c\) 2017 Dima Yv\. MIT License/);
    assert.doesNotMatch(noticeText, /^Bundled package notice needs review:/m);
    for (const file of ['.private/source-provenance.json', 'src/App.tsx', 'unknown-page']) {
      assert.equal((await fetch(base + file)).status, 404);
    }
  });
  browser = await { chromium, firefox, webkit }[engine].launch(engine === 'chromium'
    ? { channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  results.browser = browser.version();
  const { page, context } = await pageFor(browser, { width: 1440, height: 960 });
  let arrivedReport;
  const assetRequests = [];
  page.on('request', request => assetRequests.push(new URL(request.url()).pathname));
  const start = async (target) => {
    await target.goto(base);
    await target.getByRole('button', { name: 'Run Full Demo' }).click();
    assert.equal(await target.getByLabel('Departure Date', { exact: true }).inputValue(), '2026-08-17');
    assert.equal(await target.getByLabel('Departure Time (UTC)', { exact: true }).inputValue(), '08:00');
  };
  await check('Landing is usable without downloading any globe or bridge code', async () => {
    await page.goto(base);
    await page.getByRole('button', { name: 'Run Full Demo' }).waitFor();
    assert.ok(!assetRequests.some(p => /Cesium|\/cesium\/|BridgeScene/.test(p)), assetRequests.join('\n'));
    assert.ok(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
    const routeHash = new URL(page.url()).hash;
    const skip = page.getByRole('link', { name: 'Skip to control room content' });
    await page.keyboard.press('Tab');
    results.skipLinkFirstTab = await skip.evaluate(el => el === document.activeElement);
    if (engine === 'webkit' && !results.skipLinkFirstTab) {
      // This WebKit runner can use the OS policy that skips links on Tab.
      await skip.focus();
    } else {
      assert.ok(results.skipLinkFirstTab);
    }
    await skip.press('Enter');
    assert.ok(await page.locator('#control-main').evaluate(el => el === document.activeElement));
    assert.equal(new URL(page.url()).hash, routeHash, 'Skip link changed the SPA route');
    await runAxe(page, 'landing');
  });
  await check('Deterministic plan, labeled inputs and validation recovery', async () => {
    await start(page);
    const date = page.getByLabel('Departure Date', { exact: true });
    await date.fill('');
    await page.getByRole('alert').filter({ hasText: 'Enter a valid departure' }).waitFor();
    await date.fill('2026-08-17');
    await runAxe(page, 'desktop plan');
  });
  await check('Three candidates and local Cesium imagery or named schematic fallback', async () => {
    const tileResponse = page.waitForResponse(response => /NaturalEarthII.*\.jpg/i.test(response.url()) && response.ok(), { timeout: 45000 });
    tileResponse.catch(() => {});
    await page.getByRole('button', { name: 'Generate Routes' }).click();
    await page.getByText('Route Comparison', { exact: true }).waitFor();
    assert.equal(await page.locator('button[aria-pressed]').filter({ hasText: /Recommended|Fastest Alternative|Trade-off Alternative/ }).count(), 3);
    const globe = page.locator('.cesium-widget canvas');
    const fallback = page.getByText(/3D globe unavailable. Showing a schematic/);
    const offscreen = await page.evaluate(() => typeof OffscreenCanvas !== 'undefined');
    if (engine !== 'chromium') {
      await globe.or(fallback).first().waitFor({ timeout: 45000 });
      if (await fallback.isVisible()) {
        await page.getByRole('img', { name: /Schematic of the simulated voyage routes/ }).waitFor();
        if (!offscreen) {
          assert.ok(!assetRequests.some(p => /CesiumScene|\/cesium\//.test(p)));
          return 'OffscreenCanvas unavailable; schematic shown without downloading Cesium';
        }
        return 'WebGL scene unavailable in this runner; schematic shown';
      }
    }
    await globe.waitFor({ timeout: 20000 });
    const tile = new URL((await tileResponse).url()).pathname;
    assert.ok(tile.startsWith(mount + 'cesium/Assets/'));
    return tile;
  });
  await check('Captain playback advances the same voyage and remains in sync', async () => {
    await page.getByRole('button', { name: 'Select Route & Enter Command Center' }).click();
    const hull = page.waitForResponse(response => /\/assets\/vessels\/container-ship\.glb$/.test(response.url()) && response.ok(), { timeout: 30000 });
    hull.catch(() => {});
    await page.getByRole('link', { name: 'Captain Bridge', exact: true }).click();
    const bridge = page.locator('#captain-main canvas');
    const fallback = page.getByText('3D navigation view unavailable', { exact: true });
    if (engine === 'chromium') {
      await bridge.waitFor({ timeout: 30000 });
      assert.ok(new URL((await hull).url()).pathname.startsWith(mount));
    } else {
      await bridge.or(fallback).first().waitFor({ timeout: 30000 });
      if (await bridge.isVisible()) await hull;
    }
    const progress = page.getByRole('progressbar', { name: 'Voyage progress' });
    const before = Number(await progress.getAttribute('value'));
    await page.getByRole('button', { name: 'Play voyage playback' }).click();
    await page.waitForFunction(value => Number(document.querySelector('progress')?.value) > value, before);
    await page.getByRole('button', { name: 'Pause voyage playback' }).click();
    await page.getByRole('link', { name: 'Route', exact: true }).click();
    await page.getByText(/Assigned route/).waitFor();
    await page.getByRole('link', { name: 'Comms', exact: true }).click();
    const message = 'Simulated bridge report: clear visibility on the current heading.';
    await page.getByLabel('Message Control Room').fill(message);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('link', { name: 'Control Room', exact: true }).click();
    await page.getByRole('button', { name: 'Simulate Weather Event' }).waitFor();
    await page.getByText(message, { exact: true }).waitFor();
    const camera = page.getByRole('group', { name: '3D globe camera mode' });
    const free = camera.getByRole('button', { name: 'Free', exact: true });
    const global = camera.getByRole('button', { name: 'Global', exact: true });
    await free.press('Enter');
    await camera.getByRole('button', { name: 'Free', exact: true, pressed: true }).waitFor({ timeout: 5000 });
    await global.press('Enter');
    await camera.getByRole('button', { name: 'Global', exact: true, pressed: true }).waitFor({ timeout: 5000 });
    await runAxe(page, 'desktop command');
    if (engine === 'chromium' && mount === '/') {
      await page.screenshot({ path: path.join(output, 'command.png') });
    }
  });
  await check('Weather, security, human decision and complete voyage', async () => {
    const proposal = page.getByRole('dialog', { name: 'Route change recommendation' });
    const feedback = page.getByRole('status').filter({ hasText: 'No lower-risk detour found' });
    const dispositions = [];
    let approved = false;
    let checkedDialog = false;
    const makeDecision = async (choice) => {
      if (!checkedDialog) {
        const keep = proposal.getByRole('button', { name: 'Keep Current' });
        assert.ok(await keep.evaluate(el => el === document.activeElement));
        await page.keyboard.press('Tab');
        assert.ok(await proposal.evaluate(el => el.contains(document.activeElement)));
        await runAxe(page, 'reroute dialog');
        await page.keyboard.press('Escape');
        await proposal.waitFor({ state: 'hidden' });
        const review = page.getByRole('button', { name: 'Review pending reroute' });
        await page.waitForFunction(() => document.activeElement?.textContent === 'Review pending reroute');
        await page.keyboard.press('Enter');
        await proposal.getByRole('button', { name: 'View map' }).press('Enter');
        await proposal.waitFor({ state: 'hidden' });
        await review.press('Enter');
        assert.ok(await keep.evaluate(el => el === document.activeElement));
        checkedDialog = true;
      }
      await proposal.getByRole('button', { name: choice }).press('Enter');
    };
    for (const type of ['Weather Event', 'Security Disruption']) {
      await page.getByRole('button', { name: 'Simulate ' + type }).click();
      await proposal.or(feedback).first().waitFor({ timeout: 15000 });
      if (await proposal.isVisible()) {
        const decision = type === 'Weather Event' && decisionMode === 'approve' ? 'Approve Reroute' : 'Keep Current';
        await makeDecision(decision);
        if (decision === 'Approve Reroute') approved = true;
        await proposal.waitFor({ state: 'hidden' });
        dispositions.push(decision);
      } else dispositions.push('No lower-risk detour');
    }
    await page.getByRole('button', { name: '20X', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const report = page.getByRole('button', { name: 'View Voyage Report', exact: true });
    for (let i = 0; i < 5; i++) {
      await proposal.or(report).first().waitFor({ timeout: 90000 });
      if (await report.isVisible()) break;
      const decision = approved || decisionMode === 'reject' ? 'Keep Current' : 'Approve Reroute';
      await makeDecision(decision);
      await proposal.waitFor({ state: 'hidden' });
      dispositions.push(decision + ' at automatic checkpoint');
      if (decision === 'Approve Reroute') {
        approved = true;
        await page.getByText('Route v2', { exact: true }).waitFor();
      }
    }
    assert.ok(checkedDialog, 'No recommendation reached the dialog');
    assert.equal(approved, decisionMode === 'approve');
    await report.click();
    return dispositions;
  });
  await check('Report, replay playback/scrub, charts and downloaded JSON', async () => {
    await page.getByText('Recorded Voyage Replay', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Play replay', exact: true }).click();
    await page.getByText(/Recorded sample 2 of/).waitFor();
    await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
    const slider = page.getByRole('slider', { name: /Recorded sample/ });
    await slider.focus();
    await slider.press('End');
    assert.equal(await slider.inputValue(), await slider.getAttribute('max'));
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export simulated report' }).click(),
    ]);
    const data = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    arrivedReport = data;
    assert.equal(data.schemaVersion, 1);
    assert.match(data.environment, /Synthetic/);
    assert.equal(data.report.arrivalMs, data.report.telemetryHistory.at(-1).timestampMs);
    assert.equal(data.report.telemetryHistory.at(-1).speedKn, 0);
    assert.ok(data.report.weatherEvents >= 1 && data.report.securityEvents >= 1);
    if (decisionMode === 'approve') assert.ok(data.report.routeChanges >= 1);
    else assert.equal(data.report.routeChanges, 0);
    assert.equal(data.report.counterfactual.adoptedDetours, data.report.routeChanges);
    assert.ok(await page.locator('main svg.recharts-surface').count() >= 2);
    await runAxe(page, 'desktop voyage report');
    if (engine === 'chromium' && mount === '/') await page.screenshot({ path: path.join(output, 'report.png'), fullPage: true });
    return { samples: data.report.telemetryHistory.length, routeChanges: data.report.routeChanges, events: data.report.events.length };
  });
  await check('Five-profile comparison uses the same departure on recompute', async () => {
    await page.getByRole('link', { name: 'Analytics', exact: true }).click();
    await page.getByRole('button', { name: 'Recompute' }).waitFor();
    const table = page.getByRole('table').last();
    await table.getByText(/\d+(?:\.\d+)? t/).first().waitFor();
    const first = await table.innerText();
    await page.getByRole('button', { name: 'Recompute' }).click();
    await page.getByRole('button', { name: 'Recompute' }).waitFor();
    assert.equal(await table.innerText(), first);
    return await table.locator('tbody tr').count();
  });
  await check('Reset starts a paused voyage while preserving the completed report', async () => {
    await page.getByRole('link', { name: 'Command Center', exact: true }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Play', exact: true }).isEnabled());
    assert.equal(await page.getByRole('button', { name: 'View Voyage Report', exact: true }).count(), 0);
    await page.getByRole('link', { name: 'Voyage History', exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export simulated report' }).click(),
    ]);
    assert.deepEqual(JSON.parse(await fs.readFile(await download.path(), 'utf8')), arrivedReport);
    const replay = page.getByRole('slider', { name: /Recorded sample/ });
    await replay.press('End');
    assert.equal(await replay.inputValue(), await replay.getAttribute('max'));
  });
  await context.close();
  await check('390px phone with WebGL disabled: plan, fallback map and bridge', async () => {
    const { page: phone, context: mobile } = await pageFor(browser, { width: 390, height: 844 }, true);
    await start(phone);
    await runAxe(phone, 'mobile plan');
    await phone.getByRole('button', { name: 'Generate Routes' }).click();
    await phone.getByRole('img', { name: /Schematic of the simulated voyage routes/ }).waitFor();
    if (engine === 'chromium' && mount === '/') await phone.screenshot({ path: path.join(output, 'mobile.png') });
    const layers = phone.locator('summary').filter({ hasText: 'Map layers' });
    await layers.press('Enter');
    const routeLayer = phone.getByRole('checkbox', { name: 'Route', exact: true });
    assert.ok(await routeLayer.isChecked());
    await routeLayer.uncheck();
    await routeLayer.check();
    await layers.press('Enter');
    await routeLayer.waitFor({ state: 'hidden' });
    await runAxe(phone, 'mobile route comparison');
    const proceed = phone.getByRole('button', { name: 'Select Route & Enter Command Center' });
    await proceed.scrollIntoViewIfNeeded();
    const bound = await proceed.boundingBox();
    assert.ok(bound && bound.x >= 0 && bound.x + bound.width <= 391);
    await proceed.click();
    await phone.getByRole('link', { name: 'Captain Bridge', exact: true }).click();
    await phone.getByText('3D navigation view unavailable', { exact: true }).waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 390);
    await runAxe(phone, 'mobile captain fallback');
    await mobile.close();
  });
  await check('768px direct hash link and empty-state recovery', async () => {
    const { page: tablet, context: tabletContext } = await pageFor(browser, { width: 768, height: 900 });
    await tablet.goto(base + '#/route-analysis');
    await tablet.reload();
    await tablet.getByText('No routes calculated yet', { exact: true }).waitFor();
    await tablet.getByRole('button', { name: 'Go to Plan Voyage' }).click();
    await tablet.getByRole('heading', { name: 'Plan Voyage' }).waitFor();
    assert.equal(await tablet.evaluate(() => document.documentElement.scrollWidth), 768);
    if (engine === 'chromium' && mount === '/') await tablet.screenshot({ path: path.join(output, 'tablet.png') });
    await tablet.setViewportSize({ width: 640, height: 900 });
    assert.equal(await tablet.evaluate(() => document.documentElement.scrollWidth), 640);
    await tabletContext.close();
  });
  await check('Offline operation, browser errors and accessibility gates', async () => {
    assert.deepEqual(results.externalRequests, []);
    assert.deepEqual(results.failedLocalRequests, []);
    assert.deepEqual(results.pageErrors, []);
    assert.deepEqual(results.consoleErrors, []);
    if (engine === 'chromium') {
      assert.ok([...server.hits.keys()].some(p => p.startsWith(mount + 'cesium/Workers/')), 'No Cesium worker was requested');
    }
    assert.deepEqual(results.axe.flatMap(audit => audit.violations), []);
  });
} catch (error) {
  process.exitCode = 1;
  console.error(error.message);
} finally {
  await browser?.close();
  results.workerRequests = [...server.hits.keys()].filter(p => p.includes('/cesium/Workers/'));
  await server.close();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
}
