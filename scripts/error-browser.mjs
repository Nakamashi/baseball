import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {settledLayout} from './browser-layout.mjs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const combo=name=>page.getByRole('combobox',{name,exact:true});
const button=page.locator('.generate-button');
const toggle=page.locator('.include-error input');
const complete=()=>page.waitForFunction(()=>!document.querySelector('.generate-button')?.disabled);
const generate=async()=>{await button.click();await complete();assert.equal(await page.getByRole('alert').count(),0);};
const end=async()=>{
  const slider=page.locator('.timeline input');
  await slider.fill(await slider.getAttribute('max'));
};
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173');
  if(await page.locator('.app-modes button').last().getAttribute('aria-pressed')!=='true')await page.locator('.app-modes button').last().click();
  assert.equal(await toggle.count(),1);assert.equal(await toggle.isChecked(),false);
  assert.equal(await page.getByRole('checkbox',{name:'Include Error',exact:true}).count(),1);
  // Visible outside the advanced panel and operable with the keyboard.
  assert.equal(await toggle.isVisible(),true);await toggle.focus();await page.keyboard.press('Space');assert.equal(await toggle.isChecked(),true);
  await page.locator('.advanced-settings > summary').click();
  await page.locator('details.panel').filter({has:page.locator(':scope > summary',{hasText:'Field and throwing'})}).locator(':scope > summary').click();
  await combo('Batted ball').selectOption('Bunt');await combo('Hit strength').selectOption('hard');
  await combo('Runner aggression').selectOption('aggressive');
  await page.getByRole('checkbox',{name:'Anticipate a bunt before the pitch',exact:true}).setChecked(true);
  for(const [axis,value]of [['X','500'],['Y','650']])await page.getByRole('spinbutton',{name:`Ball aim / landing point ${axis}`,exact:true}).fill(value);
  await generate();await end();
  await page.locator('.dynamic-events > summary').click();
  assert.match(await page.locator('.dynamic-events').innerText(),/passes above SS/);
  assert.match(await page.locator('.dynamic-events').innerText(),/CF secures the recovered ball/);
  assert.doesNotMatch(await page.locator('.dynamic-events').innerText(),/R1 is forced out/);
  await generate();assert.equal(await toggle.isChecked(),true);
  // Generation paints its guard before compiling; a second action is inert.
  await page.evaluate(()=>{const request=requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>{window.requestAnimationFrame=request;window.releaseGenerationFrame=()=>request(callback);return 0;};});
  await button.click();assert.equal(await toggle.isDisabled(),true);assert.equal(await button.isDisabled(),true);
  await page.evaluate(()=>window.releaseGenerationFrame());await complete();
  // A forced internal budget failure must preserve the previous complete play.
  await end();const oldLog=await page.locator('.dynamic-events').innerText();
  await page.evaluate(async()=>{const {errorPolicy}=await import('/src/dynamic/throwRecovery.ts');window.errorAuditLimit=errorPolicy.maximumLiveTime;errorPolicy.maximumLiveTime=1;});
  await button.click();await complete();assert.match(await page.getByRole('alert').innerText(),/previous play is preserved/);
  await end();assert.equal(await page.locator('.dynamic-events').innerText(),oldLog);
  await page.evaluate(async()=>{const {errorPolicy}=await import('/src/dynamic/throwRecovery.ts');errorPolicy.maximumLiveTime=window.errorAuditLimit;});
  await generate();
  await combo('Throwing decision').selectOption('hold');await generate();
  assert.match(await page.locator('.generation-info').innerText(),/No eligible throwing error/);
  await combo('Throwing decision').selectOption('auto');
  await mkdir('.browser-tests',{recursive:true});
  for(const locale of ['en','ja']) {
    await combo('Language / 言語').selectOption(locale);
    assert.equal(await page.getByRole('checkbox',{name:locale==='en'?'Include Error':'エラーを含める',exact:true}).count(),1);
    for(const [width,height]of [[1366,768],[320,568],[390,844],[844,390]]) {
      await page.setViewportSize({width,height});
      const layout=await settledLayout(page,'bottom');
      const bar=await page.locator('.generate-box').boundingBox(),t=await page.locator('.include-error').boundingBox(),b=await button.boundingBox();
      assert.ok(t && t.height>=44 && t.x>=0 && t.x+t.width<=width+1);
      assert.ok(b && b.height>=44 && b.x>=0 && b.x+b.width<=width+1);
      assert.ok(bar && bar.y>=0 && bar.y+bar.height<=height+1);
      if(width<=600 || height<=500) {
        assert.equal(await page.locator('.generate-box').evaluate(e=>getComputedStyle(e).position),'fixed');
        assert.ok(layout.tail.bottom<=layout.bar.y+1,'Content clears measured action bar');
        await page.evaluate(()=>scrollTo(0,0));await settledLayout(page);
        const field=await page.locator('.field-stage').boundingBox(),transport=await page.locator('.transport').boundingBox();
        assert.ok(field && field.height>=100 && field.y+field.height<=bar.y+1,'Field clears generation bar');
        assert.ok(transport && transport.y+transport.height<=bar.y+1,'Playback controls clear generation bar');
      }
      if(width===320 || width===844)await page.screenshot({path:`.browser-tests/throwing-error-${locale}-${width}.png`});
    }
  }
  await combo('Language / 言語').selectOption('en');
  await toggle.setChecked(false);await generate();assert.equal(await toggle.isChecked(),false);assert.equal(await page.locator('.generation-info').count(),0);
  await end();assert.doesNotMatch(await page.locator('.dynamic-events').innerText(),/passes above SS/);
  assert.deepEqual(errors,[]);
  console.log('Throwing error UI passed: default OFF, real recovery, repeats, keyboard/loading, safe failure, no-op notice, EN/JA and mobile action-bar/field/transport clearance.');
} finally {await browser.close();}
