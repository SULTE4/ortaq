// @ts-nocheck
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planImageFor, loadPlanMedia } from './planMedia';

test('uploaded plans repeat by flat position across floors and entrances', () => {
  const building = { floors: 9, entrances: 3, floor_plan: [3, 1, 2, 1, 3], plan_images: { '4': '/api/v1/media/1/plan-4.webp', '0': '/api/v1/media/1/plan-0.pdf' } };
  for (const apartment of [5, 10, 45, 120]) assert.equal(planImageFor(building, apartment), building.plan_images['4']);
  for (const apartment of [1, 6, 41, 81]) assert.equal(planImageFor(building, apartment), building.plan_images['0']);
  assert.equal(planImageFor(building, 42), undefined);
  assert.equal(planImageFor({ ...building, floor_plan: [1, 2, 3, 4] }, 45), building.plan_images['0']);
  assert.equal(planImageFor({ floor_plan: [3] }, 1), undefined);
  for (const apartment of [0, -1, 1.5, NaN]) assert.equal(planImageFor(building, apartment), undefined);
});

test('media uses the exact contract URL and bearer header, accepts images and PDF, and rejects failures', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  const path = '/api/v1/media/1/plan-4.png';
  try {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']) {
      globalThis.fetch = async (url, options) => {
        assert.equal(url, path);
        assert.equal(options.headers.Authorization, 'Bearer test-token');
        assert.equal(options.signal, controller.signal);
        assert.equal(options.redirect, 'error');
        return new Response(new Blob(['plan'], { type }));
      };
      const media = await loadPlanMedia(path, 1, 'test-token', controller.signal);
      assert.equal(media.blob.type, type);
      assert.equal(media.pdf, type === 'application/pdf');
    }
    for (const response of [new Response('', { status: 403 }), new Response('html', { headers: { 'Content-Type': 'text/html' } }), new Response(new Blob([], { type: 'image/png' }))]) {
      globalThis.fetch = async () => response;
      await assert.rejects(loadPlanMedia(path, 1, 'test-token', controller.signal));
    }
    globalThis.fetch = async () => { throw Error('Must not fetch'); };
    for (const url of ['https://elsewhere.test/api/v1/media/1/x.png', '/api/api/v1/media/1/x.png', '/api/v1/media/2/x.png', '/api/v1/media/1/../2/x.png', '/api/v1/media/1/x.png?token=anything']) {
      await assert.rejects(loadPlanMedia(url, 1, 'test-token', controller.signal), /Invalid plan media/);
    }
    await assert.rejects(loadPlanMedia(path, 1, '', controller.signal), /Invalid plan media/);
  } finally { globalThis.fetch = original; }
});


test('uploaded image keys follow the entrance plan and never fall back from an own plan to the default image', () => {
  const building = { floors: 5, entrances: 3, apartments: 48, floor_plan: [3, 1, 2, 1, 3], entrance_plans: { '2': [2, 3] }, plan_images: { '0': 'default-0', '4': 'default-4', '2:0': 'own-0', '2:1': 'own-1' } };
  for (const apartment of [1, 6, 29, 34, 39, 44]) assert.equal(planImageFor(building, apartment), 'default-0');
  for (const apartment of [5, 20, 33, 48]) assert.equal(planImageFor(building, apartment), 'default-4');
  for (const apartment of [21, 23, 25, 27]) assert.equal(planImageFor(building, apartment), 'own-0');
  for (const apartment of [22, 24, 26, 28]) assert.equal(planImageFor(building, apartment), 'own-1');
  assert.equal(planImageFor({ ...building, plan_images: { '0': 'default-0' } }, 21), undefined);
  for (const apartment of [0, 49, -1, 1.5, NaN]) assert.equal(planImageFor(building, apartment), undefined);
  assert.equal(planImageFor({ ...building, id: 2, plan_images: {} }, 21), undefined);
  const equal = { ...building, apartments: 60, entrance_plans: { '2': [3, 1, 2, 1, 3] } };
  assert.equal(planImageFor(equal, 21), 'own-0', 'even an equal own plan gets its own image key');
});
