// Browser-only synchronization. Wait for measured responsive geometry rather
// than a fixed sleep or a matching-but-stale ResizeObserver value.
export async function settledLayout(page, scroll = 'top') {
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    delete window.__baseballLayoutProbe;
  });
  const handle = await page.waitForFunction(scroll => {
    const root = document.scrollingElement;
    scrollTo({ top: scroll === 'bottom' ? root.scrollHeight : 0, behavior: 'instant' });
    const rect = selector => {
      const r = document.querySelector(selector)?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom } : null;
    };
    const main = document.querySelector('main'), svg = document.querySelector('.field');
    const matrix = svg?.getScreenCTM();
    const snapshot = { width: innerWidth, height: innerHeight, scroll: root.scrollTop,
      scrollHeight: root.scrollHeight, clientHeight: root.clientHeight,
      padding: main && getComputedStyle(main).paddingBottom,
      inset: main?.style.getPropertyValue('--generate-bottom-inset'),
      field: rect('.field'), bar: rect('.generate-box'), tail: rect('#dynamic-controls .scope-note'),
      matrix: matrix && [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f] };
    const signature = JSON.stringify(snapshot), now = performance.now();
    const previous = window.__baseballLayoutProbe;
    if (previous?.signature !== signature) {
      window.__baseballLayoutProbe = { signature, since: now };
      return false;
    }
    return now - previous.since >= 150 ? snapshot : false;
  }, scroll, { polling: 'raf', timeout: 10000 });
  try { return await handle.jsonValue(); } finally { await handle.dispose(); }
}
