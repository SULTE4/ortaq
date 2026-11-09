// Run --draw before starting Vite with ORTAQ_R11_PLAN_FIXTURE=/tmp/ortaq-r11-plan.png.
// Then run without arguments for browser checks and the requested screenshots.
const { chromium } = require('/home/sultanbek/.npm-global/lib/node_modules/@playwright/cli/node_modules/playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const fixture = '/tmp/ortaq-r11-plan.png';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(15000);
    if (process.argv.includes('--draw')) {
      const png = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 780;
        const c = canvas.getContext('2d');
        c.fillStyle = '#f7f5ef'; c.fillRect(0, 0, 1200, 780);
        c.fillStyle = '#344454'; c.font = '28px sans-serif'; c.fillText('THREE-ROOM HOME', 74, 66);
        c.fillStyle = '#727c83'; c.font = '17px sans-serif'; c.fillText('DEVELOPMENT FIXTURE - ORIGINAL CANVAS ILLUSTRATION', 74, 97);
        const room = (x, y, w, h, label, sub, color) => {
          c.fillStyle = color; c.fillRect(x, y, w, h);
          c.fillStyle = '#344454'; c.font = '23px sans-serif'; c.fillText(label, x + 25, y + 48);
          c.fillStyle = '#727c83'; c.font = '15px sans-serif'; c.fillText(sub, x + 25, y + 75);
        };
        room(80, 145, 440, 240, 'Living room', 'Courtyard side', '#e9e0cc');
        room(520, 145, 300, 240, 'Bedroom', 'Courtyard side', '#e9e0cc');
        room(820, 145, 300, 240, 'Bedroom', 'Corner room', '#e9e0cc');
        room(80, 385, 740, 110, 'Hallway', '', '#ecebe5');
        room(820, 385, 300, 110, 'Bathroom', '', '#dfe9e7');
        room(80, 495, 440, 170, 'Kitchen', 'Street side', '#dfe9e7');
        room(520, 495, 600, 170, 'Entrance hall', '', '#ecebe5');
        c.strokeStyle = '#344454'; c.lineWidth = 12; c.strokeRect(80, 145, 1040, 520);
        c.lineWidth = 7;
        for (const line of [[520,145,520,385],[820,145,820,495],[80,385,1120,385],[80,495,1120,495],[520,495,520,665]]) { c.beginPath(); c.moveTo(line[0],line[1]);c.lineTo(line[2],line[3]);c.stroke(); }
        c.strokeStyle = '#f7f5ef'; c.lineWidth = 11;
        for (const [x,y,w] of [[440,385,65],[690,385,65],[960,385,65],[850,495,65],[420,495,65],[700,665,80]]) { c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.stroke(); }
        c.strokeStyle = '#729da3'; c.lineWidth = 12;
        for (const [x,y,w] of [[180,145,200],[590,145,140],[900,145,140],[180,665,200]]) { c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.stroke(); }
        c.fillStyle = '#727c83';c.font='16px sans-serif';c.fillText('Illustration only. No surveyed dimensions or property measurements.', 80, 730);
        return canvas.toDataURL('image/png').split(',')[1];
      });
      await fs.writeFile(fixture, Buffer.from(png, 'base64'));
      console.log('Original canvas plan drawn:', fixture); return;
    }
    const errors = [], requests = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', req => {
      if (req.url().includes('/api/v1/media/')) requests.push({ url: req.url(), authorized: /^Bearer .+/.test(req.headers().authorization || '') });
      if (req.method() !== 'GET' && req.url().includes('/api/') && !req.url().includes('/auth/')) writes.push(req.url());
    });
    await page.addInitScript(() => {
      window.__r11Created = []; window.__r11Revoked = [];
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => { const url = create(blob); window.__r11Created.push(url); return url; };
      URL.revokeObjectURL = url => { window.__r11Revoked.push(url); revoke(url); };
    });
    await page.goto('http://127.0.0.1:8094/?planFixture=1');
    await page.locator('.enter-link').click();
    await page.locator('.login-card input[type="tel"]').fill('+77000000012');
    await page.locator('.login-card input[maxlength="4"]').fill('1234');
    await page.locator('.login-card .primary').click();
    await page.locator('.live-link').waitFor({ timeout: 30000 });
    await page.locator('.live-link').click();
    const enlarge = page.getByRole('button', { name: 'Enlarge floor plan for apartment 45', exact: true });
    await enlarge.waitFor();
    await page.waitForFunction(() => document.querySelector('.uploaded-plan')?.getAttribute('aria-busy') === 'false');
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('.uploaded-plan-frame').evaluate(el => getComputedStyle(el).borderRadius), '12px');
    await page.screenshot({ path: path.join(root, 'docs/ux-review/r11-after-focus45.png') });
    console.log('Desktop plan captured; opening modal.');
    await enlarge.click();
    await page.locator('.plan-dialog[open]').waitFor();
    console.log('Modal opened.');
    assert.equal(await page.locator('.plan-dialog').evaluate(el => el.matches(':modal')), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('.plan-dialog').evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button', { name: 'Close floor plan' }).evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Reset zoom' }).textContent(), '200%');
    const stage = page.locator('.plan-stage'), box = await stage.boundingBox();
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .7); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .4, box.y + box.height * .4, { steps: 8 }); await page.mouse.up();
    assert.ok(await stage.evaluate(el => el.scrollLeft > 0 && el.scrollTop > 0));
    await page.getByRole('button', { name: 'Reset zoom' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(root, 'docs/ux-review/r11-after-modal.png') });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.plan-dialog'));
    assert.equal(await enlarge.evaluate(el => el === document.activeElement), true);
    const previous = await page.locator('.uploaded-plan-open img').getAttribute('src');
    await page.evaluate(async () => { const { useView } = await import('/src/store.ts'); useView.getState().set({ focus: 42 }); });
    await page.locator('.apartment-note h2').filter({ hasText: '42' }).waitFor();
    assert.equal(await page.locator('.apartment-plan figcaption').textContent(), 'Approximate plan generated from the building model');
    assert.ok(await page.evaluate(url => window.__r11Revoked.includes(url), previous));
    await page.waitForTimeout(1300);
    await page.screenshot({ path: path.join(root, 'docs/ux-review/r11-after-schematic.png') });
    console.log('Schematic and blob cleanup checked.');
    await page.locator('.apartment-note > .icon-button').click();
    await page.locator('.live-link').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.uploaded-plan')?.getAttribute('aria-busy') === 'false');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(root, 'docs/ux-review/r11-after-phone.png') });
    assert.ok(await page.locator('.uploaded-plan-frame').evaluate(el => { const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; }));
    await enlarge.click();
    await page.locator('.plan-dialog[open]').waitFor();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(root, 'docs/ux-review/r11-after-phone-modal.png') });
    await page.getByRole('button', { name: 'Close floor plan', exact: true }).click();
    console.log('Phone card and modal captured.');

    // Read-only browser fixtures exercise the same authenticated route for failures and PDF.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let browserPlanPath;
    await page.route('**/api/v1/scene*', async route => {
      const response = await route.fetch();
      const data = await response.json();
      if (browserPlanPath) data.building.plan_images = { ...data.building.plan_images, '1': `/api/v1/media/1/${browserPlanPath}` };
      await route.fulfill({ response, json: data });
    });
    const selectFixture = async name => {
      browserPlanPath = name;
      await page.evaluate(async name => {
        const { useView } = await import('/src/store.ts');
        const state = useView.getState();
        // Keep the sync fixture's position 4, and test position 1 with a distinct browser-only URL.
        state.set({ focus: 42, snapshot: { ...state.snapshot, building: { ...state.snapshot.building, plan_images: { ...state.snapshot.building.plan_images, '1': `/api/v1/media/1/${name}` } } } });
      }, name);
    };
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/v1/media/1/slow.png', async route => { await gate; await route.fulfill({ status: 200, contentType: 'image/png', body: await fs.readFile(fixture) }); });
    await selectFixture('slow.png');
    await page.getByRole('status', { name: 'Loading floor plan' }).waitFor();
    assert.equal(await page.locator('.plan-skeleton').evaluate(el => getComputedStyle(el, '::after').display), 'none');
    release();
    await page.waitForFunction(() => document.querySelector('.uploaded-plan')?.getAttribute('aria-busy') === 'false');
    await page.route('**/api/v1/media/1/error.png', route => route.fulfill({ status: 403, body: '' }));
    await selectFixture('error.png');
    await page.locator('.plan-error').waitFor();
    assert.ok(await page.locator('.apartment-plan svg').isVisible());
    await page.route('**/api/v1/media/1/broken.png', route => route.fulfill({ status: 200, contentType: 'image/png', body: 'not a png' }));
    await selectFixture('broken.png');
    await page.locator('.plan-error').waitFor();
    const stream = 'BT /F1 24 Tf 72 700 Td (Development floor plan fixture) Tj ET';
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Count 1 /Kids [3 0 R] >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    await page.route('**/api/v1/media/1/test.pdf', route => route.fulfill({ status: 200, contentType: 'application/pdf', body: pdf }));
    await selectFixture('test.pdf');
    await page.getByRole('button', { name: 'Enlarge floor plan for apartment 42', exact: true }).click();
    await page.locator('.plan-dialog[open] object[type="application/pdf"]').waitFor();
    assert.ok((await page.locator('.plan-pdf').getAttribute('data')).startsWith('blob:'));
    assert.equal(await page.locator('.plan-dialog').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.getByRole('button', { name: 'Close floor plan', exact: true }).click();
    assert.ok(requests.length >= 5 && requests.every(req => req.authorized));
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: authenticated media, fixture, modal focus, zoom/pan, Esc/close, URL cleanup, schematic, phone, loading, HTTP/decode fallback, PDF, reduced motion.');
    console.log('No API data writes. No page errors. Screenshots saved to docs/ux-review/r11-after-*.png.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
