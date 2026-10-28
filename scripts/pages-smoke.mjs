// Serve only the production artifact: no Vite transforms or SPA dev fallback.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
};
const server = createServer(async (req, res) => {
  try {
    let path = new URL(req.url, "http://localhost").pathname;
    if (path.startsWith("/baseball/")) path = path.slice("/baseball".length);
    if (path.endsWith("/")) path += "index.html";
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/", "/baseball/"]) {
    const page = await browser.newPage();
    const errors = [];
    const failed = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) failed.push(r.url());
    });
    await page.goto(origin + path);
    await page.locator(".field").waitFor();
    assert.equal(await page.locator(".scenario-card").count(), 24);
    await page.locator(".reading-nav button").last().click();
    assert.equal(
      await page.locator(".current-phase-title").innerText(),
      "Contact",
    );
    await page.locator(".app-modes button").last().click();
    assert.match(
      await page.locator(".field-heading h1").innerText(),
      /Dynamic play/,
    );
    assert.equal(await page.locator(".hit-destination").count(), 1);
    await page.locator(".reading-nav button").last().click();
    assert.equal(
      await page.locator(".current-phase-title").innerText(),
      "Contact",
    );
    const assets = await page
      .locator("script[src],link[rel=stylesheet]")
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute("src") || n.getAttribute("href")),
      );
    assert.ok(assets.length >= 2);
    assert.ok(assets.every((p) => p.startsWith("./assets/")));
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    await page.close();
    console.log(`Static Pages check passed at ${path}`);
  }
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
