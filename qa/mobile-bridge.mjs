import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './static-server.mjs';

const [directory = 'dist', mount = '/'] = process.argv.slice(2);
const staticSite = await startStaticServer(directory, mount);
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === staticSite.origin || url.protocol === 'data:' ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.includes('webgl') ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto(staticSite.base);
  await page.getByRole('button', { name: 'Run Full Demo' }).click();
  const tanker = page.getByRole('button', { name: /^Tanker/ });
  await tanker.press('Enter');
  assert.equal(await tanker.getAttribute('aria-pressed'), 'true');
  const departure = page.getByRole('button', { name: '16:00', exact: true });
  await departure.press('Enter');
  assert.equal(await page.getByLabel('Departure Time (UTC)').inputValue(), '16:00');
  await page.getByRole('button', { name: /^fuel efficient$/i }).click();
  await page.getByRole('button', { name: 'Generate Routes' }).click();
  const route = page.getByRole('button', { name: /Fastest Alternative/ });
  await route.press('Enter');
  assert.equal(await route.getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Select Route & Enter Command Center' }).click();
  await page.getByRole('button', { name: 'Simulate Weather Event' }).click();
  const dialog = page.getByRole('dialog');
  const status = page.getByRole('status').filter({ hasText: 'No lower-risk detour found' });
  await dialog.or(status).first().waitFor();
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Keep Current' }).press('Enter');
  await page.getByRole('link', { name: 'Captain Bridge', exact: true }).click();
  const alertTab = page.getByRole('link', { name: /^Alerts\b/ });
  await alertTab.click();
  const pending = page.getByRole('button', { name: 'Acknowledge' });
  await pending.first().waitFor();
  const before = await pending.count();
  const previousAlertCount = Number((await alertTab.innerText()).match(/\d+$/)?.[0] ?? '0');
  assert.ok(previousAlertCount > 0, 'Weather fixture should raise a warning');
  const warning = page.locator('li').filter({ hasText: /WARNING|CRITICAL/ }).filter({ has: pending }).first();
  await warning.getByRole('button', { name: 'Acknowledge' }).press('Enter');
  assert.equal(await pending.count(), before - 1);
  assert.equal(Number((await alertTab.innerText()).match(/\d+$/)?.[0] ?? '0'), previousAlertCount - 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  console.log('PASS mobile custom plan, alternate route, weather scenario and bridge alert acknowledgement');
} finally {
  await browser?.close();
  await staticSite.close();
}
