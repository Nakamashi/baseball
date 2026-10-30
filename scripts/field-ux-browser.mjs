import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { settledLayout } from './browser-layout.mjs';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ hasTouch: true });
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await mkdir('.browser-tests/field-ux', { recursive: true });
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const editor = page.locator('.quick-hit-editor');
const marker = page.locator('.hit-destination');
const generate = page.locator('.generate-button');
const coord = axis => page.getByRole('spinbutton', { name: `Ball aim / landing point ${axis}`, exact: true });
const point = (x, y) => page.locator('.field').evaluate((svg, p) => {
  const q = svg.createSVGPoint(); q.x = p.x; q.y = p.y;
  const screen = q.matrixTransform(svg.getScreenCTM()); return { x: screen.x, y: screen.y };
}, { x, y });
const tap = async (x, y) => { const p = await point(x, y); await page.touchscreen.tap(p.x, p.y); };
const fits = async locator => {
  const b = await locator.boundingBox(), v = page.viewportSize();
  check(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1, `Fits ${JSON.stringify(b)} in ${JSON.stringify(v)}`);
};
const complete = () => page.waitForFunction(() => !document.querySelector('.generate-button')?.disabled);
const screenshot = name => page.screenshot({ path: `.browser-tests/field-ux/${name}.png` });
try {
  for (const [width, height] of [[320,568],[375,667],[390,844],[844,390],[1366,768]]) {
    await page.setViewportSize({ width, height });
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173');
    check(await page.locator('.app-modes button').last().getAttribute('aria-pressed') === 'true', 'Simulator is the initial view');
    check(await page.locator('.field-first-hint, .game-context').count() === 0, 'No extra instruction or game-context lines');
    check(await page.getByText('Select a player to follow their role.', {exact:true}).count() === 0, 'No player instruction line');
    if (width === 1366) {
      const setup = await page.locator('.starting-situation').boundingBox();
      const score = await page.locator('.scoreboard').boundingBox();
      const fieldHeight = await page.locator('.field').evaluate(svg => svg.getScreenCTM().d * 900);
      check(setup.height <= 38, `Compact setup: ${setup.height}`);
      check(score.height <= 30, `Compact scoreboard: ${score.height}`);
      check(fieldHeight >= 420, `Desktop field uses reclaimed height: ${fieldHeight}`);
      const bases = await page.locator('.base-toggle').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().y));
      check(Math.max(...bases) - Math.min(...bases) < 1, 'Desktop runner choices share one line');
      await screenshot('desktop-expanded-field');
    }
    check(!await page.locator('.advanced-settings').evaluate(e => e.open), 'Advanced collapsed initially');
    await page.evaluate(() => scrollTo(0,0));
    await tap(650, 180);
    await editor.waitFor(); await fits(editor); await fits(generate);
    check(await marker.count() === 1, 'One marker');
    let transform = await marker.getAttribute('transform');
    const xy = transform.match(/translate\(([^ ]+) ([^)]+)/).slice(1).map(Number);
    check(Math.abs(xy[0]-650) < 1 && Math.abs(xy[1]-180) < 1, `Right-center coordinate ${transform}`);
    await editor.getByRole('button', { name: 'Ground ball', exact: true }).click();
    await editor.getByRole('button', { name: 'Normal', exact: true }).click();
    check(await generate.count() === 1, 'Single Generate action');
    const eb = await editor.boundingBox(), gb = await generate.boundingBox();
    if (width < 1000) check(eb.y + eb.height < gb.y, 'Sheet clears Generate');
    await screenshot(`editor-${width}x${height}-en`);
    await page.keyboard.press('Escape'); check(!await editor.count(), 'Escape closes');
    check(await marker.evaluate(e => document.activeElement === e), 'Focus returns to marker');
    await page.keyboard.press('ArrowRight');
    check(await marker.getAttribute('transform') !== transform, 'Keyboard moves marker');
    transform = await marker.getAttribute('transform');
    const start = await point(660,180), finish = await point(620,220);
    await page.mouse.move(start.x,start.y); await page.mouse.down(); await page.mouse.move(finish.x,finish.y,{ steps: 8 }); await page.mouse.up();
    check(await marker.getAttribute('transform') !== transform, 'Mouse drag moves marker');
    check(!await editor.count(), 'Drag does not reopen sheet');
    const beforeInvalid = await marker.getAttribute('transform');
    await tap(20,20);
    check(await marker.getAttribute('transform') === beforeInvalid, 'Foul tap retains last valid location');
    check(await page.getByRole('alert').count() === 1, 'Invalid tap explained');
    await tap(650,180); await editor.waitFor();
    check(await editor.getByRole('button',{name:'Normal',exact:true}).getAttribute('aria-pressed') === 'true', 'Remembers strength');
    await editor.getByRole('button',{name:'Done',exact:true}).click();
    const scoreboard = await page.locator('.scoreboard').innerText();
    await page.locator('.starting-situation .base-3').click();
    await page.locator('.starting-outs').getByRole('button',{name:'2 Outs',exact:true}).click();
    check(await page.locator('.scoreboard').innerText() === scoreboard, 'Draft situation leaves scoreboard alone');
    await page.locator('.advanced-settings > summary').click();
    check(await page.locator('.dynamic-runners input').last().isChecked(), 'Runner checkbox synchronized');
    check(await page.locator('#dynamic-controls').getByRole('button',{name:'2 Outs',exact:true}).getAttribute('aria-pressed') === 'true', 'Outs synchronized');
    check(Math.abs(Number(await coord('X').inputValue()) - Number((await marker.getAttribute('transform')).match(/translate\(([^ ]+)/)[1])) <= 1, 'Precision coordinate synchronized');
    await page.getByRole('combobox',{name:'Runner speed',exact:true}).selectOption('fast');
    await page.getByRole('combobox',{name:'Half-inning',exact:true}).selectOption('bottom');
    check(await page.getByRole('combobox',{name:'Fielding team',exact:true}).inputValue() === 'away','Half/team coupling');
    await page.locator('.advanced-settings > summary').click();
    await page.evaluate(() => scrollTo(0,0));
    await screenshot(`runners-${width}x${height}`);
    if (width < 1000) {
      const pb = await page.locator('.playback').boundingBox(), bar = await page.locator('.generate-box').boundingBox();
      check(pb.y + pb.height <= bar.y + 1, `Transport clears Generate in ${width}x${height}: ${pb.y+pb.height} <= ${bar.y}`);
    }
    // Hold the paint boundary to observe submission feedback and duplicate-submit protection.
    await page.evaluate(() => {
      const request = requestAnimationFrame;
      window.requestAnimationFrame = callback => {
        window.requestAnimationFrame = request; window.releaseGeneration = () => request(callback); return 0;
      };
    });
    await generate.click();
    check(await generate.isDisabled(), 'Generation disabled');
    check(/Generating/.test(await generate.innerText()), 'Loading label retained');
    await generate.evaluate(b => b.click());
    await page.evaluate(() => window.releaseGeneration()); await complete();
    check(!await page.locator('.draft-notice').count(), 'Generated draft consumed');
    check(!await page.getByRole('alert').count(), 'No validation errors');
    check(!await page.locator('.play-button').isDisabled(), 'Playback ready');
    await page.evaluate(() => scrollTo(0,0));
    const location = await marker.getAttribute('transform');
    await page.locator('[data-player=RF]').click();
    check(await marker.getAttribute('transform') === location, 'Fielder never picks location');
    check(await page.locator('[data-player=RF]').getAttribute('aria-pressed') === 'true', 'Fielder focus');
    if (width < 1000) await fits(page.locator('.mobile-focus-open'));
    await screenshot(`focus-${width}x${height}`);
    const oldPhase = await page.locator('.current-phase-title').innerText();
    const slider = page.locator('.timeline input');
    await slider.fill(await slider.getAttribute('max'));
    check(await page.locator('.current-phase-title').innerText() !== oldPhase, 'Focus uses advanced playback phase');
    check(await page.locator('.focus-action').innerText() !== '', 'Current phase responsibility remains available');
    await page.locator('.focus-panel .label-row button').click();
    check(!await page.locator('.mobile-focus-open').count(), 'Focus dismissed');
    await page.locator('.timeline input').fill('0');
    await page.getByRole('combobox',{name:'Language / 言語',exact:true}).selectOption('ja');
    await page.evaluate(() => scrollTo(0,0)); await tap(650,180); await editor.waitFor();
    check((await editor.innerText()).includes('打球のかんたん設定'),'Japanese editor');
    check(!(await page.locator('body').innerText()).includes('@v2:'),'No internal message references');
    await screenshot(`editor-${width}x${height}-ja`);
    await page.keyboard.press('Escape'); await generate.click(); await complete();
    await screenshot(`generated-${width}x${height}-ja`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No overflow');
    await fits(page.locator('.playback'));
    await page.getByRole('combobox',{name:'Language / 言語',exact:true}).selectOption('en');
    await page.locator('.advanced-settings > summary').click();
    check(await page.getByRole('combobox',{name:'Runner speed',exact:true}).inputValue() === 'fast', 'Advanced values survive language and generation');
    await page.locator('.advanced-settings > summary').click();
    await page.evaluate(() => scrollTo(0,0));
  }
  // Reposition desktop popovers at both field edges and preserve marker visibility.
  for (const [x, y] of [[150,400],[850,400],[500,100]]) {
    await tap(x,y); await editor.waitFor(); await fits(editor);
    const m = await marker.boundingBox(), e = await editor.boundingBox();
    check(m.x + m.width / 2 < e.x || m.x + m.width / 2 > e.x + e.width || m.y + m.height / 2 < e.y || m.y + m.height / 2 > e.y + e.height, 'Popover leaves marker visible');
    await page.keyboard.press('Escape');
  }
  await screenshot('desktop-dismissed');
  // Reflow the same draft through portrait, scrolling, and landscape, without reloads.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => scrollTo(0,80));
  await tap(650,180); await editor.waitFor(); await page.keyboard.press('Escape');
  const beforeResize = await marker.getAttribute('transform');
  await page.setViewportSize({width:844,height:390}); await settledLayout(page);
  check(await marker.getAttribute('transform') === beforeResize, 'Orientation preserves draft coordinates');
  const current = (await marker.getAttribute('transform')).match(/translate\(([^ ]+) ([^)]+)/).slice(1).map(Number);
  const from = await point(...current), to = await point(610,230);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:to.x,y:to.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(() => {
    const transform = document.querySelector('.hit-destination')?.getAttribute('transform');
    const p = transform?.match(/translate\(([^ ]+) ([^)]+)/)?.slice(1).map(Number);
    return p && Math.abs(p[0] - 610) < 1 && Math.abs(p[1] - 230) < 1;
  });
  const moved = (await marker.getAttribute('transform')).match(/translate\(([^ ]+) ([^)]+)/).slice(1).map(Number);
  check(Math.abs(moved[0]-610) < 1 && Math.abs(moved[1]-230) < 1, 'Native touch drag uses SVG coordinates after orientation');
  const lastValid = await marker.getAttribute('transform');
  const dragFrom = await point(...moved), invalidPoint = await point(20,20);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:dragFrom.x,y:dragFrom.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:invalidPoint.x,y:invalidPoint.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check(await marker.getAttribute('transform') === lastValid, 'Invalid drag keeps last valid position');
  const valid = await marker.getAttribute('transform');
  await marker.focus();
  await page.keyboard.press('Shift+ArrowLeft');
  check(await marker.getAttribute('transform') !== valid, 'Fine keyboard adjustment');
  await page.keyboard.press('Enter'); await editor.waitFor();
  await editor.getByRole('button',{name:'Bunt',exact:true}).click();
  check(await editor.locator('.quick-error').count() === 1, 'Unsupported distant bunt explained');
  await generate.click();
  check(await page.getByRole('alert').count() === 1, 'Invalid draft cannot generate');
  await editor.getByRole('button',{name:'Ground ball',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.locator('.app-modes button').first().click();
  check(await marker.count() === 0 && await generate.count() === 0, 'Encyclopedia unchanged');
  check(errors.length === 0, `Page errors: ${errors.join(', ')}`);
  console.log(`Field UX browser passed: ${checks} assertions across five layouts, EN/JA, field tap, drag, keyboard, validation, draft runners/outs, loading, generation, focus and advanced persistence.`);
} finally { await browser.close(); }
