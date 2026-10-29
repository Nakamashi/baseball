import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const timeline = () => page.locator(".timeline input");
const readingNext = () => page.locator(".reading-nav button").last();
const readingPrevious = () => page.locator(".reading-nav button").first();
const play = () => page.locator(".play-button");
const choose = async (id) => page.locator(`[data-scenario="${id}"]`).click();
async function fits(width, height) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => scrollTo(0, 0));
  const field = await page.locator(".field-stage").boundingBox();
  const controls = await page.locator(".playback").boundingBox();
  assert.ok(
    field.y >= 0 && field.height >= 150,
    `field visibility at ${width}×${height}`,
  );
  assert.ok(
    controls.y + controls.height <= height,
    `controls visible at ${width}×${height}: ${controls.y + controls.height}`,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
}
try {
  await page.goto(process.env.APP_URL || "http://127.0.0.1:5173");
  await page.locator(".field").waitFor();
  const playbackMode = page.getByRole("combobox", {
    name: "Playback mode",
    exact: true,
  });
  assert.equal(await playbackMode.inputValue(), "full");
  assert.equal(await page.locator(".scenario-card").count(), 24);
  assert.equal(await page.locator(".intro,.topbar").count(), 0);
  assert.equal(
    await page
      .getByText("Count is context only; it does not change an authored play.")
      .count(),
    0,
  );
  await page.locator("[data-player=RF]").click();
  assert.match(await page.locator(".focus-action").innerText(), /Back up/);
  // Reading-panel navigation must move the exact same timeline and field.
  await readingNext().click();
  assert.equal(await timeline().inputValue(), "1.5");
  assert.equal(
    await page.locator(".current-phase-title").innerText(),
    "Contact",
  );
  await readingPrevious().click();
  assert.equal(await timeline().inputValue(), "0");
  await page
    .getByRole("combobox", { name: "Speed", exact: true })
    .selectOption("2");
  await playbackMode.selectOption("step");
  await play().click();
  await page.waitForFunction(
    () => document.querySelector(".play-button")?.textContent === "Play",
  );
  assert.equal(await timeline().inputValue(), "1.5");
  await page.waitForTimeout(200);
  assert.equal(await timeline().inputValue(), "1.5");
  await page
    .getByRole("combobox", { name: "Playback mode", exact: true })
    .selectOption("full");
  await play().click();
  await page.waitForTimeout(200);
  await play().click();
  const paused = await timeline().inputValue();
  await page.waitForTimeout(150);
  assert.equal(await timeline().inputValue(), paused);
  await page.getByRole("button", { name: "Restart play", exact: true }).click();
  assert.equal(await timeline().inputValue(), "0");
  // Every combination that can be selected in the guided controls has a play.
  const category = page.getByRole("combobox", {
    name: "Play category",
    exact: true,
  });
  for (const value of await category
    .locator("option")
    .evaluateAll((nodes) => nodes.map((n) => n.value))) {
    await category.selectOption(value);
    const situation = page.getByRole("combobox", {
      name: "Starting situation",
      exact: true,
    });
    for (const key of await situation
      .locator("option")
      .evaluateAll((nodes) => nodes.map((n) => n.value))) {
      await situation.selectOption(key);
      assert.ok((await page.locator(".scenario-card").count()) > 0);
      assert.equal(await page.locator(".scenario-card.chosen").count(), 1);
    }
  }
  await category.selectOption("all");
  await page
    .getByRole("combobox", { name: "Starting situation", exact: true })
    .selectOption("all");
  await choose("06");
  await timeline().fill(await timeline().getAttribute("max"));
  assert.match(await page.locator(".scoreboard").innerText(), /Outs\s*2/);
  await timeline().fill("0");
  assert.match(await page.locator(".scoreboard").innerText(), /Outs\s*0/);
  for (const id of await page
    .locator(".scenario-card")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.scenario))) {
    await choose(id);
    await timeline().fill(await timeline().getAttribute("max"));
    assert.equal(
      await page.locator(".current-phase-title").innerText(),
      "Outcome",
    );
  }
  await choose("06");
  await readingNext().click();
  const beforeLanguage = await timeline().inputValue();
  await page
    .getByRole("combobox", { name: "Language / 言語", exact: true })
    .selectOption("ja");
  assert.equal(await timeline().inputValue(), beforeLanguage);
  assert.equal(await page.locator("html").getAttribute("lang"), "ja");
  assert.equal(
    await page.locator(".current-phase-title").innerText(),
    "打球への反応",
  );
  assert.match(await page.locator(".phase-explanation").innerText(), /遊撃手/);
  await page.reload();
  assert.equal(
    await page
      .getByRole("combobox", { name: "Language / 言語", exact: true })
      .inputValue(),
    "ja",
  );
  for (const id of await page
    .locator(".scenario-card")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.scenario))) {
    await choose(id);
    for (let step = 0; step < 20; step++) {
      assert.match(
        await page.locator(".phase-explanation").innerText(),
        /[ぁ-んァ-ヶ一-龯]/,
      );
      assert.match(
        await page.locator(".focus-action").innerText(),
        /[ぁ-んァ-ヶ一-龯]/,
      );
      if (await readingNext().isDisabled()) break;
      await readingNext().click();
    }
  }
  await choose("06");
  for (const [w, h] of [
    [1366, 768],
    [1440, 900],
    [1920, 1080],
    [820, 1180],
    [390, 844],
    [375, 667],
  ])
    await fits(w, h);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: "/tmp/baseball-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/baseball-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: guided choices, synchronized reading navigation, teaching auto-pause, full playback, 24 English/Japanese plays, saved language, and field/controls visible at six screen sizes.",
  );
} finally {
  await browser.close();
}
