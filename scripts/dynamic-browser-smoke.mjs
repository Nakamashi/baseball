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
  // Reported center-field scoring threat: automatic mode must complete the
  // home relay and keep the new close-play explanation translated.
  await page
    .getByRole("combobox", { name: "Language / 言語" })
    .selectOption("en");
  await page.locator(".dynamic-runners input").nth(0).uncheck();
  await page.locator(".dynamic-runners input").nth(1).check();
  await page.locator(".dynamic-runners input").nth(2).uncheck();
  await page.getByRole("spinbutton", { name: "Hit destination X" }).fill("530");
  await page.getByRole("spinbutton", { name: "Hit destination Y" }).fill("235");
  await page
    .getByRole("combobox", { name: "Hit strength", exact: true })
    .selectOption("hard");
  await page
    .getByRole("combobox", { name: "Runner speed", exact: true })
    .selectOption("average");
  await page
    .getByRole("combobox", { name: "Defensive strategy", exact: true })
    .selectOption("prevent");
  await page
    .getByRole("combobox", { name: "Throwing decision", exact: true })
    .selectOption("auto");
  await page.locator(".generate-button").click();
  await slider.fill(await slider.getAttribute("max"));
  assert.match(
    await page.locator(".dynamic-events").innerText(),
    /CF throws to 1B/,
  );
  assert.match(
    await page.locator(".dynamic-events").innerText(),
    /1B throws to C/,
  );
  assert.match(
    await page.locator(".objective p").first().textContent(),
    /tag timing is close/,
  );
  const homeTime = await slider.inputValue();
  await page
    .getByRole("combobox", { name: "Language / 言語" })
    .selectOption("ja");
  assert.equal(await slider.inputValue(), homeTime);
  assert.match(
    await page.locator(".objective p").first().textContent(),
    /際どい/,
  );
  assert.doesNotMatch(await page.locator("body").innerText(), /@v2:/);
  await slider.fill("1");
  await page.locator("[data-player=P]").click();
  assert.match(await page.locator(".focus-action").innerText(), /本塁/);
  // A return to an ordinary second-base receiver must not end a live home read.
  await page
    .getByRole("combobox", { name: "Language / 言語" })
    .selectOption("en");
  await page.getByRole("spinbutton", { name: "Hit destination Y" }).fill("250");
  await page
    .getByRole("combobox", { name: "Hit strength", exact: true })
    .selectOption("hard");
  await page
    .getByRole("combobox", { name: "Runner speed", exact: true })
    .selectOption("average");
  await page.locator(".generate-button").click();
  await slider.fill(await slider.getAttribute("max"));
  assert.match(
    await page.locator(".dynamic-events").innerText(),
    /CF throws to SS/,
  );
  assert.match(
    await page.locator(".dynamic-events").innerText(),
    /SS throws to C/,
  );
  await page
    .getByRole("combobox", { name: "Language / 言語" })
    .selectOption("ja");
  // Clean outfield singles have a live round/read/return instead of a stop on first.
  await page
    .getByRole("combobox", { name: "Language / 言語" })
    .selectOption("en");
  await page.locator(".dynamic-runners input").nth(1).uncheck();
  await page.getByRole("spinbutton", { name: "Hit destination X" }).fill("765");
  await page.getByRole("spinbutton", { name: "Hit destination Y" }).fill("295");
  await page.locator(".generate-button").click();
  await slider.fill(await slider.getAttribute("max"));
  assert.match(
    await page.locator(".dynamic-events").innerText(),
    /Round first/,
  );
  assert.match(
    await page.locator(".dynamic-events").innerText(),
    /Return to first/,
  );
  // A deep left-field hit can now produce a real double on the calibrated ground.
  await page.getByRole("spinbutton", { name: "Hit destination X" }).fill("170");
  await page.getByRole("spinbutton", { name: "Hit destination Y" }).fill("200");
  await page
    .getByRole("combobox", { name: "Hit strength", exact: true })
    .selectOption("normal");
  await page.locator(".generate-button").click();
  await slider.fill(await slider.getAttribute("max"));
  assert.match(
    await page.locator(".dynamic-events").innerText(),
    /Advance along the basepath toward second/,
  );
  // Eligible aggressive contact play from third, including the infield-in risk.
  await page
    .getByRole("combobox", { name: "Batted ball", exact: true })
    .selectOption("Ground ball");
  await page.getByRole("spinbutton", { name: "Hit destination X" }).fill("640");
  await page.getByRole("spinbutton", { name: "Hit destination Y" }).fill("430");
  await page.locator(".dynamic-runners input").nth(2).check();
  await page.locator(".generate-button").click();
  await slider.fill("1");
  await page.locator("[data-player=R3]").click();
  assert.match(await page.locator(".focus-action").innerText(), /home/);
  await page
    .getByRole("combobox", { name: "Language / 言語" })
    .selectOption("ja");
  assert.match(await page.locator(".focus-action").innerText(), /本塁/);
  assert.doesNotMatch(await page.locator("body").innerText(), /@v2:/);
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
    "Dynamic browser checks passed: continuous field picking, draft protection, generation, double play, throw override, center-field home relay, base-receiver follow-up, rounded singles, extra-base advances, contact play from third, bilingual explanations, shared timeline, mobile fit, and return to encyclopedia.",
  );
} finally {
  await browser.close();
}
