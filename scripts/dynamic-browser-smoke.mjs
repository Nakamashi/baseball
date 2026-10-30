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
const combo = (name) => page.getByRole("combobox", { name, exact: true });
const coordinate = (axis) =>
  page.getByRole("spinbutton", {
    name: `Ball aim / landing point ${axis}`,
    exact: true,
  });
const language = (value) => combo("Language / 言語").selectOption(value);
const slider = page.locator(".timeline input");
const end = async () => slider.fill(await slider.getAttribute("max"));
const eventText = async () => {
  const details = page.locator(".dynamic-events");
  if (!(await details.getAttribute("open").then((v) => v !== null)))
    await details.locator("summary").click();
  return details.innerText();
};
const configure = async ({
  type = "Ground ball",
  x = 396,
  y = 473,
  strength = "hard",
  speed = "average",
  aggression = "aggressive",
  strategy = "standard",
  target = "auto",
  runners = [],
  outs = 0,
  arm = "standard",
  fenceMode = "standard",
  fenceHeight = 2.5,
  anticipateBunt = false,
} = {}) => {
  await language("en");
  const advanced = page.locator("details.panel").filter({
    has: page.locator(":scope > summary", { hasText: "Field and throwing" }),
  });
  if ((await advanced.getAttribute("open")) === null)
    await advanced.locator("summary").click();
  await combo("Throwing profile").selectOption(arm);
  await combo("Fence behavior").selectOption(fenceMode);
  await page
    .getByRole("spinbutton", {
      name: "Fence height (m, provisional)",
      exact: true,
    })
    .fill(String(fenceHeight));
  await page
    .getByRole("checkbox", {
      name: "Anticipate a bunt before the pitch",
      exact: true,
    })
    .setChecked(anticipateBunt);
  for (const [name, value] of [
    ["Batted ball", type],
    ["Hit strength", strength],
    ["Runner speed", speed],
    ["Runner aggression", aggression],
    ["Defensive strategy", strategy],
    ["Throwing decision", String(target)],
  ])
    await combo(name).selectOption(value);
  await coordinate("X").fill(String(x));
  await coordinate("Y").fill(String(y));
  for (let n = 1; n <= 3; n++)
    await page
      .locator(".dynamic-runners input")
      .nth(n - 1)
      .setChecked(runners.includes(n));
  await page.locator("#dynamic-controls").getByRole("button", { name: `${outs} Outs`, exact: true }).click();
};
const generate = async () => {
  await page.locator(".generate-button").click();
  await page.waitForFunction(() => !document.querySelector(".generate-button")?.disabled);
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(await page.locator(".play-button").isDisabled(), false);
};
const fieldPoint = async (x, y) => {
  const p = await page.locator(".field").evaluate(
    (svg, { x, y }) => {
      const p = svg.createSVGPoint();
      p.x = x;
      p.y = y;
      const s = p.matrixTransform(svg.getScreenCTM());
      return { x: s.x, y: s.y };
    },
    { x, y },
  );
  await page.mouse.click(p.x, p.y);
};
try {
  await page.goto(process.env.APP_URL || "http://127.0.0.1:5173");
  await page.locator(".field").waitFor();
  assert.equal(await page.locator(".app-modes button").last().getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".scenario-card").count(), 0);
  assert.equal(await combo("Playback mode").inputValue(), "full");
  assert.equal(await page.locator(".player").count(), 11);
  assert.equal(await page.locator(".hit-destination").count(), 1);
  await page.locator(".advanced-settings > summary").click();
  await page
    .getByRole("button", { name: "Place hit location", exact: true })
    .click();
  await fieldPoint(650, 180);
  await page.keyboard.press("Escape");
  assert.ok(Math.abs(+(await coordinate("X").inputValue()) - 650) <= 2);
  assert.equal(await page.locator(".play-button").isDisabled(), true);
  // The reported routine hard grounder is resolved by interception and real arrival times.
  await configure({ speed: "fast" });
  await generate();
  await end();
  assert.match(await page.locator(".scoreboard").innerText(), /Outs\s*1/);
  assert.match(await eventText(), /SS throws to 1B/);
  await slider.fill("2");
  const poses = await page
    .locator(".player")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("transform")));
  await end();
  await slider.fill("2");
  assert.deepEqual(
    await page
      .locator(".player")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("transform"))),
    poses,
  );
  await configure({ x: 425, y: 425, speed: "slow", runners: [1] });
  await generate();
  await end();
  assert.match(await page.locator(".scoreboard").innerText(), /Outs\s*2/);
  // Automatic home priority remains translated and uses one clock across language changes.
  await configure({ x: 558, y: 284, runners: [2], strategy: "prevent" });
  await generate();
  await end();
  let text = await eventText();
  // Production 8331a1c already uses 2B as the deep relay, with 1B
  // available as the separate inner cutoff rather than mandatory recipient.
  assert.match(text, /CF throws to 2B/);
  assert.match(text, /2B throws to C/);
  assert.match(
    await page.locator(".objective p").first().textContent(),
    /home|scoring|run/,
  );
  const homeTime = await slider.inputValue();
  await language("ja");
  assert.equal(await slider.inputValue(), homeTime);
  assert.match(
    await page.locator(".objective p").first().textContent(),
    /本塁|得点/,
  );
  assert.doesNotMatch(await page.locator("body").innerText(), /@v2:/);
  await slider.fill("1");
  await page.locator("[data-player=P]").click();
  assert.match(await page.locator(".focus-action").innerText(), /本塁/);
  await configure({ x: 765, y: 280, strength: "normal", runners: [2] });
  await generate();
  await end();
  assert.match(await eventText(), /throws/);
  // An outfield single has a continuous round/read/return; a deep hard lane can produce a double.
  await configure({ x: 765, y: 280, strength: "normal" });
  await generate();
  await end();
  text = await eventText();
  assert.match(text, /Round first/);
  assert.match(text, /Return to first/);
  await configure({
    type: "Line drive",
    x: 636,
    y: 172,
    speed: "fast",
    arm: "developing",
  });
  await generate();
  await end();
  assert.match(await eventText(), /Advance along the basepath toward second/);
  await configure({ x: 610, y: 430, runners: [3], strategy: "prevent" });
  await generate();
  await slider.fill("1");
  await page.locator("[data-player=R3]").click();
  assert.match(await page.locator(".focus-action").innerText(), /home/);
  await language("ja");
  assert.match(await page.locator(".focus-action").innerText(), /本塁/);
  // Flight height, the unobstructed overlay, catch rules and awards render in the actual UI.
  await configure({
    type: "Fly ball",
    x: 500,
    y: 100,
    strength: "normal",
    runners: [3],
  });
  await generate();
  await slider.fill("2.5");
  const layers = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Layers" }) });
  await layers.locator("summary").click();
  await page
    .getByRole("checkbox", { name: "Projected ball path", exact: true })
    .check();
  assert.equal(await page.locator(".trajectory-overlay").count(), 1);
  assert.ok((await page.locator(".ball-height").count()) > 0);
  await page.screenshot({ path: "/tmp/baseball-physics-flight.png" });
  await end();
  text = await eventText();
  assert.match(text, /catch|Catch/);
  assert.match(text, /touch|Touch/);
  await configure({ type: "Line drive", x: 425, y: 350, runners: [1] });
  await generate();
  await end();
  assert.match(await eventText(), /retouch|original base/i);
  assert.match(await page.locator(".scoreboard").innerText(), /Outs\s*1/);
  await language("ja");
  assert.match(await eventText(), /踏み直|帰塁/);
  await configure({ type: "Fly ball", x: 500, y: 15, runners: [1, 2, 3] });
  await generate();
  await end();
  assert.match(await eventText(), /clears the modeled fence in flight/);
  assert.match(await eventText(), /4 runs scored/);
  await configure({
    type: "Fly ball",
    x: 887.52,
    y: 370.36,
    strength: "hard",
    fenceHeight: 1,
    runners: [1, 2, 3],
  });
  await generate();
  await end();
  assert.match(await eventText(), /two bases/i);
  await configure({
    type: "Fly ball",
    x: 887.52,
    y: 370.36,
    strength: "hard",
    fenceMode: "keep-in-play",
    fenceHeight: 8,
  });
  await generate();
  await end();
  assert.match(await eventText(), /strikes the wall or training net/);
  assert.match(await eventText(), /secures the ball/);
  await configure({ type: "Pop-up", x: 450, y: 430, runners: [1, 2] });
  await generate();
  await slider.fill("2.5");
  assert.equal(await page.locator(".interception-point").count(), 1);
  assert.match(await page.locator(".ball-height").textContent(), /Ball height/);
  await page.screenshot({ path: "/tmp/tactical-popup.png" });
  await end();
  assert.match(await eventText(), /Infield fly|infield fly/);
  await language("ja");
  assert.match(
    await page.locator(".field-heading h1").innerText(),
    /ポップフライ/,
  );
  assert.doesNotMatch(await page.locator("body").innerText(), /@v2:/);
  for (const x of [380, 620]) {
    await configure({
      type: "Bunt",
      x,
      y: 650,
      strength: "normal",
      runners: [1],
      anticipateBunt: true,
    });
    await generate();
    await slider.fill("1.2");
    await page.locator(`[data-player="${x === 380 ? "1B" : "2B"}"]`).click();
    await page.screenshot({
      path:
        x === 380
          ? "/tmp/tactical-bunt-left.png"
          : "/tmp/tactical-bunt-right.png",
    });
    assert.match(await page.locator(".focus-action").innerText(), /first/);
    await language("ja");
    assert.match(await page.locator(".focus-action").innerText(), /一塁/);
    await language("en");
    await end();
    const buntEvents = await eventText();
    if (x === 380) {
      // The closer catcher now wins this pickup, but its wide lane is still
      // too late. Preserve the legitimate hold rather than forcing an out.
      assert.doesNotMatch(buntEvents, /throws/);
      assert.match(await page.locator(".scoreboard").innerText(), /Outs\s*0/);
    } else {
      assert.match(buntEvents, /C throws to 2B/);
      assert.match(await page.locator(".scoreboard").innerText(), /Outs\s*1/);
    }
  }
  for (const [strength, fielder] of [["soft", "C"], ["hard", "P"]]) {
    await configure({ type: "Bunt", x: 500, y: 739.065689, strength, speed: "fast", runners: [] });
    await generate(); await end();
    assert.match(await eventText(), new RegExp(`${fielder} throws to 1B`));
    assert.match(await page.locator(".scoreboard").innerText(), /Outs\s*1/);
  }
  await configure({ type: "Fly ball", x: 757, y: 131, strength: "normal", speed: "fast", runners: [],
    fenceMode: "keep-in-play", fenceHeight: 8 });
  await generate(); await slider.fill("10.6");
  const lfPosition = () => page.locator('[data-player="LF"]').evaluate(node => {
    const m = node.transform.baseVal.consolidate().matrix; return [m.e, m.f];
  });
  const lfBeforeTag = await lfPosition();
  await slider.fill("13"); const lfAfterTag = await lfPosition();
  assert.ok(Math.hypot(lfBeforeTag[0] - lfAfterTag[0], lfBeforeTag[1] - lfAfterTag[1]) < 0.1,
    "LF retains third support through relay control and the tag");
  await configure({
    type: "Bunt",
    x: 637,
    y: 620,
    strength: "normal",
    aggression: "normal",
    runners: [1],
  });
  await generate();
  await slider.fill("1.2");
  await page.locator('[data-player="3B"]').click();
  assert.match(await page.locator(".focus-action").innerText(), /third/);
  await language("ja");
  assert.match(await page.locator(".focus-action").innerText(), /三塁/);
  await language("en");
  await slider.fill("4");
  assert.equal(
    await page.locator('[data-player="3B"]').evaluate((node) => {
      const matrix = node.transform.baseVal.consolidate().matrix;
      return Math.hypot(matrix.e - 300, matrix.f - 570) < 0.1;
    }),
    true,
    "Third is already covered before C secures the bunt",
  );
  await end();
  const recoveredThird = await page
    .locator('[data-player="3B"]')
    .getAttribute("transform");
  const recovered = recoveredThird.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
  assert.ok(recovered, "Third baseman has a rendered field position");
  assert.ok(
    Math.hypot(Number(recovered[1]) - 300, Number(recovered[2]) - 570) < 0.1,
    "Third baseman reaches third rather than finishing in the bunt charging lane",
  );
  await page.screenshot({ path: "/tmp/bunt-third-recovery.png" });
  await configure({ x: 425, y: 425, speed: "slow", runners: [1] });
  await generate();
  await page
    .getByRole("combobox", { name: "Playback mode", exact: true })
    .selectOption("full");
  await slider.fill("0");
  await page.locator(".play-button").click();
  await page.waitForFunction(
    () => Number(document.querySelector(".timeline input").value) > 3.1,
  );
  await page.locator(".play-button").click();
  const paused = await slider.inputValue();
  await page.waitForTimeout(100);
  assert.equal(await slider.inputValue(), paused);
  await slider.fill("2.2");
  await page.screenshot({ path: "/tmp/tactical-dp-contact.png" });
  await slider.fill("4.4");
  await page.screenshot({ path: "/tmp/tactical-dp-pivot.png" });
  await coordinate("X").fill("880");
  assert.equal(await page.locator(".play-button").isDisabled(), true);
  assert.equal(await page.locator(".interception-point").count(), 0);
  await configure({
    type: "Fly ball",
    x: 500,
    y: 100,
    strength: "normal",
    runners: [3],
  });
  await generate();
  await slider.fill("2.5");
  await language("ja");
  assert.doesNotMatch(await page.locator("body").innerText(), /@v2:/);
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1280, 720],
    [820, 1180],
    [390, 844],
    [375, 667],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo(0, 0));
    const controls = await page.locator(".playback").boundingBox();
    assert.ok(
      controls && controls.y + controls.height <= height + 2,
      `Transport outside ${width}x${height}`,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: "/tmp/baseball-physics-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/baseball-physics-mobile.png" });
  await language("en");
  await page.locator(".app-modes button").first().click();
  assert.equal(await page.locator(".scenario-card").count(), 24);
  assert.equal(await page.locator(".hit-destination").count(), 0);
  assert.equal(await page.locator(".trajectory-overlay").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Dynamic browser smoke passed: interception, double plays, home priority, runner reads, retouches, pop-ups, bunts, configurable fences/arms, wall caroms, boundaries, deterministic seeks, EN/JA and six layouts.",
  );
} finally {
  await browser.close();
}
