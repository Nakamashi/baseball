import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fieldPoint = async (x, y) => {
  const point = await page.locator(".field").evaluate(
    (svg, { x, y }) => {
      const p = svg.createSVGPoint();
      p.x = x;
      p.y = y;
      const screen = p.matrixTransform(svg.getScreenCTM());
      return { x: screen.x, y: screen.y };
    },
    { x, y },
  );
  await page.mouse.click(point.x, point.y);
};
try {
  await page.goto(process.env.APP_URL || "http://127.0.0.1:5173");
  await page.locator(".field").waitFor();
  await page.locator(".app-modes button").last().click();
  assert.equal(await page.locator(".player").count(), 11);
  assert.equal(await page.locator(".hit-destination").count(), 1);
  await page
    .getByRole("combobox", { name: "Batted ball", exact: true })
    .selectOption("Ground ball");
  await page
    .getByRole("combobox", { name: "Runner speed", exact: true })
    .selectOption("slow");
  await page
    .getByRole("button", { name: "Place hit location", exact: true })
    .click();
  await fieldPoint(360, 440);
  assert.ok(
    Math.abs(
      +(await page
        .getByRole("spinbutton", { name: "Hit destination X" })
        .inputValue()) - 360,
    ) <= 2,
  );
  assert.ok(
    Math.abs(
      +(await page
        .getByRole("spinbutton", { name: "Hit destination Y" })
        .inputValue()) - 440,
    ) <= 2,
  );
  assert.equal(await page.locator(".play-button").isDisabled(), true);
  await page.locator(".generate-button").click();
  assert.match(await page.locator(".field-heading h1").innerText(), /SS/);
  const slider = page.locator(".timeline input");
  await slider.fill(await slider.getAttribute("max"));
  assert.match(await page.locator(".scoreboard").innerText(), /Outs\s*2/);
  await slider.fill("0");
  await page.locator(".reading-nav button").last().click();
  assert.equal(await slider.inputValue(), "1");
  await page
    .getByRole("combobox", { name: "Language / 言語" })
    .selectOption("ja");
  assert.match(
    await page.locator(".phase-explanation").innerText(),
    /野手|味方/,
  );
  await page
    .getByRole("combobox", { name: "打球の種類", exact: true })
    .selectOption("Base hit");
  await page.getByRole("spinbutton", { name: "打球の到達位置 X" }).fill("790");
  await page.getByRole("spinbutton", { name: "打球の到達位置 Y" }).fill("290");
  await page
    .getByRole("combobox", { name: "走者の積極性", exact: true })
    .selectOption("aggressive");
  await page
    .getByRole("combobox", { name: "走者の速さ", exact: true })
    .selectOption("average");
  await page
    .getByRole("combobox", { name: "送球の判断", exact: true })
    .selectOption("home");
  await page.locator(".generate-button").click();
  await slider.fill(await slider.getAttribute("max"));
  assert.match(await page.locator(".field-heading h1").innerText(), /RF/);
  await page.locator(".dynamic-events summary").click();
  assert.match(await page.locator(".dynamic-events").innerText(), /送球/);
  await page.locator("[data-player=P]").click();
  assert.match(
    await page.locator(".focus-action").innerText(),
    /[ぁ-んァ-ヶ一-龯]/,
  );
  for (const [width, height] of [
    [1366, 768],
    [820, 1180],
    [390, 844],
    [375, 667],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo(0, 0));
    const controls = await page.locator(".playback").boundingBox();
    assert.ok(
      controls.y + controls.height <= height,
      `dynamic transport visible at ${width}×${height}`,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({
    path: "/tmp/baseball-v2-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/baseball-v2-mobile.png",
    fullPage: true,
  });
  await page.locator(".app-modes button").first().click();
  assert.equal(await page.locator(".scenario-card").count(), 24);
  assert.equal(await page.locator(".hit-destination").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Dynamic browser checks passed: continuous field picking, draft protection, generation, double play, throw override, bilingual explanations, shared timeline, mobile fit, and return to encyclopedia.",
  );
} finally {
  await browser.close();
}
