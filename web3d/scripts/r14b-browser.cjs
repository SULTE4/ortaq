// Read-only browser checks. Start Vite on 127.0.0.1:8094 before running.
const { chromium } = require('/home/sultanbek/.npm-global/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(60000);
    const errors = [], writes = [], plans = [];
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let fixture = '';
    page.on('pageerror', error => errors.push(error.message));
    // Refuse all data writes, including any unexpected background requests.
    await page.route('**/api/**', async route => {
      const req = route.request();
      if (req.method() !== 'GET' && !req.url().includes('/auth/')) {
        writes.push(req.url()); await route.abort(); return;
      }
      if (req.url().includes('/scene') && fixture) {
        const response = await route.fetch(), data = await response.json();
        if (fixture === 'upload') data.building.plan_images = { '4': '/api/v1/media/1/r12-readonly.png' };
        else if (fixture === 'generic') {
          data.building = { ...data.building, id: 2, osm_id: 0, entrance_plans: {}, name: 'Generic building', address: 'Generic building', lat: 51.13, lon: 71.44, floors: 9, entrances: 1, apartments: 40, floor_plan: [1, 2, 3, 4, 5], plan_images: {}, footprint: [[71.44, 51.13], [71.4406, 51.13], [71.4406, 51.130108], [71.44, 51.130108]] };
          data.apartment = 4;
        }
        await route.fulfill({ response, json: data }); return;
      }
      await route.continue();
    });
    const shot = name => page.screenshot({ path: path.join(root, `docs/ux-review/r14b-after-${name}.png`), animations: 'disabled' });
    const recordPlan = async apartment => {
      const summary = await page.evaluate(async apartment => {
        const [{ useView }, { modelFor }, { drawingPlan }] = await Promise.all([import('/src/store.ts'), import('/src/buildingModel.ts'), import('/src/drawingPlan.ts')]);
        const model = modelFor(useView.getState().snapshot.building);
        const cell = model.cells.find(c => c.apartment === apartment);
        const plan = drawingPlan(cell, model.windows, cell.loggiaSides);
        return { apartment, rooms: cell.rooms, cellArea: cell.area, hallArea: plan.hallArea, wallArea: plan.wallArea, roomList: plan.rooms.map(r => ({ name: r.name, kind: r.kind, area: r.area })), windows: plan.windows.length };
      }, apartment);
      assert.ok(summary.hallArea <= (summary.rooms <= 3 ? 10 : 12));
      assert.ok(Math.abs(summary.cellArea - summary.hallArea - summary.wallArea - summary.roomList.reduce((sum, r) => sum + r.area, 0)) < .001);
      assert.equal(await page.locator('.generated-plan .drawing-hall-label').textContent(), `Hallabout ${Math.round(summary.hallArea)} m2`);
      plans.push(summary);
    };
    const focus = async apartment => {
      await page.evaluate(async apartment => { const { useView } = await import('/src/store.ts'); useView.getState().set({ focus: apartment }); }, apartment);
      await page.getByRole('button', { name: `Enlarge floor plan for apartment ${apartment}`, exact: true }).waitFor();
      await page.locator('.apartment-note').evaluate(el => { el.scrollTop = 0; });
      await page.waitForTimeout(1300);
    };
    await page.goto('http://127.0.0.1:8094/');
    await page.locator('.enter-link').click();
    await page.locator('.login-card input[type="tel"]').fill('+77000000012');
    await page.locator('.login-card input[maxlength="4"]').fill('1234');
    await page.locator('.login-card .primary').click();
    await page.waitForFunction(async () => (await import('/src/store.ts')).useView.getState().snapshot !== null);
    await page.evaluate(async () => { const { useView } = await import('/src/store.ts'); useView.getState().set({ cinematic: false, city: false }); });
    for (const [apartment, count] of [[1, 4], [41, 4], [42, 2], [43, 3], [45, 4]]) {
      await focus(apartment);
      assert.equal(await page.locator('.generated-plan [data-window-id]').count(), count);
      assert.equal(await page.locator('.generated-plan figcaption').textContent(), 'Approximate plan generated from the building model');
      await recordPlan(apartment);
      if (apartment === 45) { await shot('focus45'); await page.locator('.apartment-note').screenshot({ path: path.join(root, 'docs/ux-review/r14b-after-card45.png'), animations: 'disabled' }); }
      await page.getByRole('button', { name: `Enlarge floor plan for apartment ${apartment}`, exact: true }).click();
      await page.locator('.plan-dialog[open]').waitFor();
      await shot(`modal${apartment}`);
      await page.getByRole('button', { name: 'Close floor plan' }).click();
    }
    for (const apartment of [1, 81]) {
      await focus(apartment);
      await page.getByRole('button', { name: 'Floor', exact: true }).click();
      await page.getByRole('button', { name: `Enlarge floor plan for apartment ${apartment}`, exact: true }).click();
      await page.locator('.plan-dialog[open] .entrance-floor').waitFor();
      await shot(`floor${apartment}`);
      await page.getByRole('button', { name: 'Close floor plan' }).click();
      await page.getByRole('button', { name: 'Apartment', exact: true }).click();
    }
    await focus(45);
    await page.getByRole('button', { name: 'Floor', exact: true }).click();
    assert.equal(await page.locator('.generated-plan [data-flat]').count(), 5);
    assert.equal(await page.locator('.generated-plan [data-selected="true"]').getAttribute('data-flat'), '45');
    await shot('floor-card45');
    await page.getByRole('button', { name: 'Enlarge floor plan for apartment 45', exact: true }).click();
    await page.locator('.plan-dialog[open] .entrance-floor').waitFor();
    assert.equal(await page.locator('.plan-dialog [data-flat]').count(), 5);
    assert.equal(await page.locator('.plan-dialog [data-selected="true"] polygon').evaluate(el => getComputedStyle(el).fill), 'rgb(242, 211, 159)');
    assert.ok(await page.locator('.plan-dialog .drawing-door').count() >= 7);
    await shot('floor45');
    await page.getByRole('button', { name: 'Close floor plan' }).click();
    await page.getByRole('button', { name: 'Apartment', exact: true }).click();
    const enlarge = page.getByRole('button', { name: 'Enlarge floor plan for apartment 45', exact: true });
    await enlarge.click();
    const dialog = page.locator('.plan-dialog[open]'), stage = page.locator('.plan-stage');
    await dialog.waitFor();
    assert.equal(await dialog.evaluate(el => el.matches(':modal')), true);
    assert.equal(await dialog.locator('[data-window-id]').count(), 4);
    assert.equal(await page.locator('body').evaluate(() => {
      const ids = [...document.querySelectorAll('.plan-drawing [id]')].map(el => el.id);
      return new Set(ids).size === ids.length;
    }), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button', { name: 'Close floor plan' }).evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Reset zoom' }).textContent(), '200%');
    const box = await stage.boundingBox();
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .7);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .4, box.y + box.height * .4, { steps: 8 });
    await page.mouse.up();
    assert.ok(await stage.evaluate(el => el.scrollTop > 0));
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await stage.evaluate(el => el.scrollBy(100, 100));
    assert.ok(await stage.evaluate(el => el.scrollLeft > 0));
    await page.getByRole('button', { name: 'Reset zoom' }).click();
    await page.waitForTimeout(300);
    await shot('modal45');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.ok(await enlarge.evaluate(el => el === document.activeElement));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000);
    await shot('phone');
    assert.ok(await page.locator('.generated-plan-open').evaluate(el => {
      const box = el.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth;
    }));
    await enlarge.click();
    await dialog.waitFor();
    await stage.focus();
    await page.keyboard.press('+');
    assert.equal(await page.getByRole('button', { name: 'Reset zoom' }).textContent(), '150%');
    await page.getByRole('button', { name: 'Reset zoom' }).click();
    await shot('phone-modal');
    await page.getByRole('button', { name: 'Close floor plan' }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await focus(41);
    assert.ok(await page.locator('.generated-plan .drawing-door').count() >= 6);
    await shot('loggia41');
    const loadFixture = async () => {
      await page.evaluate(async () => {
        const { useView } = await import('/src/store.ts');
        const token = sessionStorage.getItem('ortaq-3d-token');
        const data = await (await fetch('/api/v1/scene', { headers: { Authorization: `Bearer ${token}` } })).json();
        useView.getState().set({ snapshot: data, focus: null });
      });
    };
    fixture = 'generic';
    // The fixture lives only in intercepted GET responses, never on the backend.
    await loadFixture();
    await focus(4);
    await recordPlan(4);
    assert.equal(await page.locator('.generated-plan [data-room="bedroom"]').count(), 3);
    await page.getByRole('button', { name: 'Enlarge floor plan for apartment 4', exact: true }).click();
    await dialog.waitFor();
    await shot('generic4');
    await page.getByRole('button', { name: 'Close floor plan' }).click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: 'Floor', exact: true }).click();
    assert.equal(await page.locator('.generated-plan [data-flat]').count(), 5);
    await page.getByRole('button', { name: 'Apartment', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    fixture = 'upload';
    await page.route('**/api/v1/media/1/r12-readonly.png', async route => route.fulfill({ status: 200, contentType: 'image/png', body: await fs.readFile(path.join(root, 'docs/ux-review/r12-plan-reference.png')) }));
    await loadFixture();
    await focus(45);
    await page.waitForFunction(() => document.querySelector('.uploaded-plan')?.getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('.uploaded-plan svg').count(), 0);
    assert.equal(await page.locator('.uploaded-plan figcaption').textContent(), "Floor plan from the building's documents");
    const natural = await page.locator('.uploaded-plan img').evaluate(img => [img.naturalWidth, img.naturalHeight]);
    await enlarge.click();
    await dialog.waitFor();
    assert.deepEqual(await dialog.locator('img').evaluate(img => [img.naturalWidth, img.naturalHeight]), natural);
    assert.equal(await dialog.locator('.plan-drawing').count(), 0);
    await page.getByRole('button', { name: 'Close floor plan' }).click();
    await page.getByRole('button', { name: 'View entrance floor', exact: true }).click();
    await page.locator('.plan-dialog .entrance-floor').waitFor();
    assert.equal(await page.locator('.plan-dialog [data-selected="true"]').getAttribute('data-flat'), '45');
    await page.getByRole('button', { name: 'Close floor plan' }).click();
    await fs.writeFile('/tmp/ortaq-r14b-browser-areas.json', JSON.stringify(plans, null, 2));
    console.log(JSON.stringify(plans));
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    console.log('Passed: 42/43/45 cards, 45 modal, focus trap/return, zoom/pan, unique SVG IDs, phone, loggias, generic four-room plan, uploaded image unchanged. No API data writes or page errors.');
  } catch (error) {
    console.error('Browser failure:', error);
    for (const page of browser.contexts().flatMap(c => c.pages())) {
      await page.screenshot({ path: '/tmp/r14b-browser-failure.png' }).catch(() => {});
      console.error(await page.locator('body').innerText().catch(() => 'No page'));
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
