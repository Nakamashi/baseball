import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await mkdir('.browser-tests', { recursive: true });
const button = page.locator('.generate-button');
const complete = () => page.waitForFunction(() => !document.querySelector('.generate-button')?.disabled);
const readable = async () => {
  const ratio = await button.evaluate(b => {
    const style = getComputedStyle(b), panel = getComputedStyle(b.parentElement);
    const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
    const over = rgb(panel.backgroundColor), opacity = Number(style.opacity);
    const composite = c => c.map((v, i) => (v * opacity + over[i] * (1 - opacity)) / 255);
    const light = c => c.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const a = light(composite(rgb(style.color))), z = light(composite(rgb(style.backgroundColor)));
    return (Math.max(a, z) + .05) / (Math.min(a, z) + .05);
  });
  assert.ok(ratio >= 4.5, `Generate text contrast ${ratio.toFixed(2)} is too low`);
};
const visibleAtBottom = async () => {
  const b = await button.boundingBox(), v = page.viewportSize();
  assert.ok(b && b.y >= 0 && b.y + b.height <= v.height + 1);
  assert.ok(v.height - b.y - b.height < 70, `CTA too far from usable bottom: ${JSON.stringify(b)}`);
  assert.ok(b.height >= 44);
  assert.equal(await button.count(), 1);
};
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173');
  await page.locator('.app-modes button').last().click();
  await page.locator(".advanced-settings > summary").click();
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo(0, 0)); await visibleAtBottom();
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await visibleAtBottom();
    const tail = await page.locator('#dynamic-controls .scope-note').boundingBox();
    const bar = await page.locator('.generate-box').boundingBox();
    if (tail && bar) assert.ok(tail.y + tail.height <= bar.y + 1, 'Last content obscured');
    await page.getByRole('combobox', { name: 'Batted ball', exact: true }).selectOption('Bunt');
    await page.getByRole('spinbutton', { name: 'Ball aim / landing point X', exact: true }).fill('620');
    await page.getByRole('spinbutton', { name: 'Ball aim / landing point Y', exact: true }).fill('650');
    await page.locator('.dynamic-runners input').last().setChecked(true);
    await button.click(); await complete();
    assert.equal(await page.getByRole('alert').count(), 0);
    await visibleAtBottom();
    await readable(); // Includes the pointer's retained hover after clicking.
    await page.evaluate(() => {
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => {
        window.requestAnimationFrame = request;
        window.releaseGenerationFrame = () => request(callback);
        return 0;
      };
    });
    await button.click();
    assert.equal(await button.isDisabled(), true);
    assert.match(await button.innerText(), /Generating/);
    await readable();
    await button.evaluate(b => b.click()); // Native disabled submission is inert.
    await page.evaluate(() => window.releaseGenerationFrame()); await complete();
    await page.getByRole('spinbutton', { name: 'Ball aim / landing point X', exact: true }).fill('900');
    await button.click();
    const alert = page.getByRole('alert'); await alert.waitFor();
    const a = await alert.boundingBox();
    assert.ok(a.y >= 0 && a.y + a.height < height);
    await page.getByRole('spinbutton', { name: 'Ball aim / landing point X', exact: true }).fill('620');
    await page.getByRole('spinbutton', { name: 'Ball aim / landing point Y', exact: true }).fill('650');
    await button.click(); await complete();
    await page.getByRole('combobox', { name: 'Language / 言語', exact: true }).selectOption('ja');
    assert.match(await button.innerText(), /再生成|プレーを生成/);
    await visibleAtBottom();
    if (width === 390) await page.screenshot({ path: '.browser-tests/v2-mobile-generate.png', fullPage: false });
    await page.getByRole('combobox', { name: 'Language / 言語', exact: true }).selectOption('en');
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  assert.notEqual(await page.locator('.generate-box').evaluate(e => getComputedStyle(e).position), 'fixed');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '.browser-tests/v2-desktop-generate.png' });
  await page.locator('.app-modes button').first().click();
  assert.equal(await button.count(), 0);
  assert.deepEqual(errors, []);
  console.log('Mobile Generate Play passed: one bottom CTA, portrait/narrow/landscape, scroll clearance, R3 bunt, disabled progress/repeat prevention, visible errors, EN/JA, desktop and encyclopedia.');
} finally { await browser.close(); }
