// Read-only Brief 15 fixtures. Run Vite on 127.0.0.1:8094 first.
const { chromium } = require('/home/sultanbek/.npm-global/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const building = {
  id: 1, name: 'ЖК Ortaq Demo', address: '6 Sauran St, Astana',
  floors: 9, entrances: 3, apartments: 120, floor_plan: [3, 1, 2, 1, 3],
  entrance_plans: { '3': [3, 2, 2, 2, 3] }, plan_images: {}, osm_id: 425124327,
  lat: 51.122618, lon: 71.423048,
  footprint: [[71.4225657, 51.1225401], [71.422685, 51.122859], [71.422867, 51.1228321], [71.4227873, 51.1226193], [71.4237113, 51.1224831], [71.4236716, 51.122377]],
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(60000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      sessionStorage.setItem('ortaq-3d-token', 'r15-readonly-fixture');
      // Keep the intercepted scene fixed while software rendering the plans.
      const interval = window.setInterval.bind(window);
      window.setInterval = (handler, delay, ...args) => delay === 3000 ? 0 : interval(handler, delay, ...args);
    });
    const errors = [], writes = [], mediaRequests = [], areas = [];
    let uploaded = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') { writes.push(url.pathname); await route.abort(); return; }
      if (url.pathname === '/api/v1/scene') {
        await route.fulfill({ json: { building: { ...building, plan_images: uploaded ? { '1': '/api/v1/media/1/r15-default.png', '3:1': '/api/v1/media/1/r15-own.png' } : {} }, issues: [], reports: [], announcements: [], polls: [], role: 'resident', apartment: 81 } });
      } else if (url.pathname === '/api/v1/buildings/map') {
        const { entrance_plans, floor_plan, plan_images, ...publicBuilding } = building;
        await route.fulfill({ json: [publicBuilding] });
      } else if (url.pathname.startsWith('/api/v1/media/1/')) {
        mediaRequests.push(url.pathname);
        assert.equal(request.headers().authorization, 'Bearer r15-readonly-fixture');
        await route.fulfill({ contentType: 'image/png', body: await fs.readFile(path.join(root, 'docs/ux-review/r12-plan-reference.png')) });
      } else if (url.pathname.includes('/map/')) await route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
      else await route.fulfill({ status: 404, json: { error: 'Read-only browser fixture' } });
    });
    const shot = async name => { await page.screenshot({ path: path.join(root, `docs/ux-review/r15-after-${name}.png`), animations: 'disabled' }); console.log(`Captured ${name}`); };
    const focus = async apartment => {
      await page.evaluate(async apartment => { const { useView } = await import('/src/store.ts'); useView.getState().set({ focus: apartment, cinematic: false, city: false, quality: false }); }, apartment);
      await page.getByRole('button', { name: `Enlarge floor plan for apartment ${apartment}`, exact: true }).waitFor();
      await page.locator('.apartment-note').evaluate(el => { el.scrollTop = 0; });
      await page.waitForTimeout(700);
    };
    const open = async apartment => {
      await page.getByRole('button', { name: `Enlarge floor plan for apartment ${apartment}`, exact: true }).click();
      await page.locator('.plan-dialog[open]').waitFor();
      await page.waitForTimeout(200);
    };
    const close = () => page.getByRole('button', { name: 'Close floor plan', exact: true }).click();
    await page.goto('http://127.0.0.1:8094/');
    await page.waitForFunction(async () => (await import('/src/store.ts')).useView.getState().snapshot !== null);
    await page.locator('.maplibregl-canvas').waitFor();
    await page.waitForFunction(() => !document.querySelector('.scene-loading'));
    for (const [apartment, mix] of [[81, [3, 2, 2, 2, 3]], [45, [3, 1, 2, 1, 3]]]) {
      await focus(apartment);
      await page.getByRole('button', { name: 'Floor', exact: true }).click();
      assert.equal(await page.locator('.generated-plan [data-flat]').count(), 5);
      assert.deepEqual(await page.locator('.generated-plan [data-flat] tspan').allTextContents(), mix.map(r => `${r} ${r === 1 ? 'room' : 'rooms'}`));
      await open(apartment);
      assert.equal(await page.locator('.plan-dialog [data-selected="true"]').getAttribute('data-flat'), String(apartment));
      assert.equal(await page.locator('.plan-dialog [data-common-room="utility"]').count(), 0);
      assert.ok(await page.locator('.plan-dialog .drawing-door').count() >= 7);
      await shot(`floor${apartment}`);
      await close();
      await page.getByRole('button', { name: 'Apartment', exact: true }).click();
    }
    for (const apartment of [82, 85]) {
      await focus(apartment);
      const rooms = apartment === 82 ? 2 : 3;
      assert.equal(await page.locator('.apartment-facts strong').textContent(), `${rooms} rooms`);
      await open(apartment);
      const dialog = page.locator('.plan-dialog[open]');
      assert.equal(await dialog.locator('[data-room="living"], [data-room="bedroom"]').count(), rooms);
      assert.equal(await dialog.locator('[data-window-id]').count(), rooms + 1);
      assert.equal(await dialog.evaluate(el => el.matches(':modal')), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Reset zoom' }).textContent(), '150%');
      await page.getByRole('button', { name: 'Reset zoom' }).click();
      await shot(`modal${apartment}`);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await page.getByRole('button', { name: `Enlarge floor plan for apartment ${apartment}`, exact: true }).evaluate(el => el === document.activeElement), true);
    }
    await focus(81);
    await page.waitForTimeout(2200);
    assert.equal(await page.locator('.canvas-error').count(), 0);
    await shot('focus81');
    areas.push(...await page.evaluate(async () => {
      const [{ modelFor }, { useView }, { localPoint, polygonArea }, { drawingPlan }] = await Promise.all([import('/src/buildingModel.ts'), import('/src/store.ts'), import('/src/apartmentPlan.ts'), import('/src/drawingPlan.ts')]);
      const model = modelFor(useView.getState().snapshot.building);
      return model.cells.filter(c => c.entrance === 3 && c.floor === 2).map(cell => {
        const p = cell.outline.map(p => localPoint(cell.section, p));
        const drawing = drawingPlan(cell, model.windows, cell.loggiaSides);
        return { apartment: cell.apartment, rooms: cell.rooms, area: cell.area, areaScale: cell.areaScale, bounds: [0, 1].map(axis => (Math.max(...p.map(q => q[axis])) - Math.min(...p.map(q => q[axis]))) * 2.5), facades: [...new Set(model.windows.filter(w => w.apartment === cell.apartment).map(w => w.side))], hall: drawing.hallArea, roomsDrawn: drawing.rooms.map(r => ({ kind: r.kind, area: r.area })) };
      });
    }));
    // Uploaded per-entrance images use e:p in both card and enlarged view.
    uploaded = true;
    await page.evaluate(async () => { const { useView } = await import('/src/store.ts'); const snapshot = await (await fetch('/api/v1/scene')).json(); useView.getState().set({ snapshot, focus: null }); });
    for (const [apartment, expected] of [[82, '/api/v1/media/1/r15-own.png'], [42, '/api/v1/media/1/r15-default.png']]) {
      await focus(apartment);
      await page.waitForFunction(() => document.querySelector('.uploaded-plan')?.getAttribute('aria-busy') === 'false');
      assert.equal(mediaRequests.at(-1), expected);
      await open(apartment);
      assert.equal(await page.locator('.plan-dialog img').count(), 1);
      assert.equal(await page.locator('.plan-dialog svg.plan-drawing').count(), 0);
      await close();
      await page.getByRole('button', { name: 'View entrance floor', exact: true }).click();
      await page.locator('.plan-dialog .entrance-floor').waitFor();
      assert.equal(await page.locator('.plan-dialog [data-selected="true"]').getAttribute('data-flat'), String(apartment));
      await close();
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await focus(85);
    await open(85);
    await close();
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    await fs.writeFile('/tmp/ortaq-r15-browser-areas.json', JSON.stringify(areas, null, 2));
    console.log('Passed: own/default floor mixes, selection, no Utility, 82/85 generated modals, focus trap/return, zoom, 81 in 3D, own/default uploaded image keys, uploaded entrance floors, both motion preferences. No API writes or page errors.');
    console.log(JSON.stringify(areas));
  } catch (error) {
    for (const page of browser.contexts().flatMap(c => c.pages())) {
      await page.screenshot({ path: '/tmp/r15-browser-failure.png' }).catch(() => {});
      console.error(await page.locator('body').innerText().catch(() => 'No page'));
    }
    throw error;
  } finally {
    await Promise.all(browser.contexts().map(context => context.close()));
    await browser.close();
    console.log('Closed screenshot browser');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
