// Run timeline-preview.mjs first. Exercises the production view with the vault's
// actual timeline, including interval targets and the native mobile stylesheet.
const { chromium, webkit } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../../output/timeline-preview');
const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const suffix = engine === 'webkit' ? '-webkit' : '';

(async () => {
  let browser;
  const server = http.createServer((req, res) => {
    const name = path.basename(req.url.split('?')[0]) || 'index.html';
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.json') ? 'application/json' : 'text/html');
    try { res.end(fs.readFileSync(path.join(root, name))); }
    catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('crash', () => errors.push('Browser renderer crashed'));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.timeline);
    await page.evaluate(async () => {
      document.body.classList.add('is-mobile', 'mod-ios', 'theme-dark');
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'obsidian.css';
      const loaded = new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; });
      document.head.prepend(link); await loaded;
      const v = window.timeline; v.lanes = new Set(['nw']); v.openCanvas();
    });
    const reports = [];
    for (const config of [{ label: 'Book of Mormon', lanes: ['nw'], detail: false },
      { label: 'Book of Mormon, every event', lanes: ['nw'], detail: true },
      { label: 'Whole story, every event', lanes: ['ow', 'nw', 'rs'], detail: true }]) {
      await page.evaluate(config => {
        const v = window.timeline; v.lanes = new Set(config.lanes); v.detail = config.detail; v.render();
        v.world.camera = { x: 20, y: 12, scale: 1 }; v.world.paint();
      }, config);
      const report = await page.evaluate(async () => {
        const v = window.timeline, w = v.world, surface = document.querySelector('.sg-tw-world');
        const expected = v.visible().map(e => e.id).sort();
        const ids = [...new Set([...surface.querySelectorAll('.sg-tw-event')].map(e => e.dataset.eventId))].sort();
        if (JSON.stringify(ids) !== JSON.stringify(expected)) throw new Error('Timeline events were dropped');
        const total = surface.querySelectorAll('*').length;
        const initialVisible = [...surface.querySelectorAll('.sg-tw-event')].filter(e => getComputedStyle(e).display !== 'none').length;
        const bounds = () => {
          const vp = w.viewport.getBoundingClientRect(), svg = w.svg.getBoundingClientRect(), box = surface.getBoundingClientRect();
          if (Math.abs(svg.width - vp.width) > 1 || Math.abs(svg.height - vp.height) > 1 || Math.abs(box.height - vp.height) > 1 || Math.abs(box.width - vp.width) > 1) throw new Error('Drawing surface exceeds viewport');
          if (surface.offsetHeight > vp.height + 1 || surface.offsetWidth > vp.width + 1) throw new Error('Oversized layout surface');
          if (getComputedStyle(surface).transform !== 'none' || getComputedStyle(surface).willChange !== 'auto') throw new Error('World promoted to a transformed layer');
          for (const rail of surface.querySelectorAll('.sg-tw-rail')) if (rail.offsetHeight > vp.height + 1) throw new Error('Oversized rail');
        };
        const frame = () => new Promise(r => requestAnimationFrame(r));
        for (let i = 0; i < 50; i++) {
          w.zoomBy(.001); bounds(); if (w.camera.scale !== .05) throw new Error('Cannot zoom fully out');
          await frame();
          w.camera.x -= 130; w.camera.y -= 70; w.paint(); bounds();
          w.zoomBy(1000); bounds(); if (w.camera.scale !== 2.8) throw new Error('Cannot zoom fully in');
          await frame();
        }
        if (surface.querySelectorAll('*').length !== total) throw new Error('Zoom leaked DOM nodes');
        w.camera = { x: 20, y: 12, scale: 1 }; w.paint();
        const card = w.cards[0], node = w.nodes[0].el, box = card.el.getBoundingClientRect();
        const dot = new DOMPoint(Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))).matrixTransform(node.getScreenCTM());
        if (Math.abs(box.left - dot.x - 22) > 1 || Math.abs(dot.y - box.top - 39) > 1) throw new Error('Cards and connections misaligned');
        w.zoomBy(.001); bounds();
        const maxHitWidth = Math.max(...w.hitAreas.map(h => parseFloat(h.style.strokeWidth) * w.camera.scale));
        return { events: ids.length, initialVisible, intervalTargets: w.hitAreas.length, maxHitWidth,
          logicalHeight: w.height, surfaceHeight: surface.offsetHeight, cycles: 50 };
      });
      assert.ok(report.initialVisible < report.events, 'Off-screen cards must be culled');
      assert.ok(report.intervalTargets > 0);
      assert.equal(report.maxHitWidth, 28);
      reports.push({ label: config.label, ...report });
    }
    // The reported case, with a real touch gesture at the minimum zoom.
    await page.evaluate(() => {
      const v = window.timeline; v.lanes = new Set(['nw']); v.detail = true; v.render();
      v.world.camera = { x: 20, y: 12, scale: 1 }; v.world.paint();
    });
    // Pan starting on a card until that card leaves the viewport. Capture must
    // survive culling and dragging must not open the event.
    const first = await page.locator('.sg-tw-event:visible').first().boundingBox();
    const x = Math.min(350, first.x + 90), startY = first.y + 50;
    if (engine === 'chromium') {
      const client = await page.context().newCDPSession(page);
      const touch = (type, coords) => client.send('Input.dispatchTouchEvent', { type, touchPoints: coords.map(([x, y, id]) => ({ x, y, id, radiusX: 2, radiusY: 2 })) });
      await touch('touchStart', [[x, startY, 1]]);
      for (let i = 1; i <= 8; i++) await touch('touchMove', [[x, startY - i * 25, 1]]);
      await touch('touchEnd', []);
      assert.ok(await page.evaluate(() => window.timeline.world.camera.y < -150));
      assert.equal(await page.locator('.sg-tl-detail').count(), 0);
      await page.evaluate(() => window.timeline.world.zoomBy(.001));
      await touch('touchStart', [[60, 300, 1], [320, 620, 2]]);
      await touch('touchMove', [[160, 440, 1], [190, 470, 2]]);
      await touch('touchEnd', []);
    } else {
      // Playwright exposes multi-touch dispatch through Chromium's CDP only.
      await page.mouse.move(x, startY); await page.mouse.down();
      await page.mouse.move(x, startY - 200, { steps: 8 }); await page.mouse.up();
      assert.ok(await page.evaluate(() => window.timeline.world.camera.y < -150));
      assert.equal(await page.locator('.sg-tl-detail').count(), 0);
      await page.evaluate(() => window.timeline.world.zoomBy(.001));
    }
    assert.equal(await page.evaluate(() => window.timeline.world.camera.scale), .05);
    await page.screenshot({ path: path.join(root, `zoom-minimum-phone${suffix}.png`) });
    await page.getByRole('button', { name: 'Return to the first event', exact: true }).click();
    await page.locator('.sg-tw-event:visible').first().tap();
    await page.waitForSelector('.sg-tl-detail');
    await page.getByRole('button', { name: 'Close event details', exact: true }).click();
    await page.evaluate(() => window.timeline.world.jump(421));
    assert.ok(await page.evaluate(() => window.timeline.world.camera.y < -1000), 'Year navigation reaches later rows');
    const lastId = await page.evaluate(() => {
      const v = window.timeline, id = v.visible().at(-1).id; v.world.follow(id); return id;
    });
    assert.ok(await page.locator(`.sg-tw-event[data-event-id="${lastId}"]:visible`).count() > 0, 'Last events remain reachable');
    await page.getByRole('button', { name: 'Close event details', exact: true }).click();
    const restored = await page.evaluate(async () => {
      const v = window.timeline, state = v.getState(); await v.setState(state, {});
      return { expected: state.camera, actual: v.world.camera };
    });
    assert.deepEqual(restored.actual, restored.expected);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => window.timeline.world.svg.clientHeight === window.timeline.world.viewport.clientHeight);
    await page.getByRole('button', { name: 'Fit all timeline columns', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Return to the first event', exact: true }).click();
    await page.screenshot({ path: path.join(root, `zoom-readable-phone${suffix}.png`) });
    // A queued input frame must be cancelled when a filter rebuilds the view.
    const teardown = await page.evaluate(async () => {
      const v = window.timeline, old = v.world; old.requestPaint(); v.render();
      await new Promise(r => requestAnimationFrame(r));
      return { destroyed: old.destroyed, frame: old.frame, worlds: document.querySelectorAll('.sg-tw-world').length };
    });
    assert.deepEqual(teardown, { destroyed: true, frame: null, worlds: 1 });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(root, `zoom-regression-results${suffix}.json`), JSON.stringify({ engine, reports, checks: '150 zoom round trips, DPR 3, bounded SVG/HTML surfaces, off-screen culling, stable DOM count, pointer pan, interval targets, touch event taps, last-event jump, restore, rotation, teardown', multiTouch: engine === 'chromium', errors }, null, 2) + '\n');
    console.log(JSON.stringify(reports, null, 2));
    console.log(`PASS (${engine}): mobile zoom stress, pointer navigation, state restoration, resize and teardown.`);
  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
