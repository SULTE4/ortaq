// @ts-nocheck
import { inside, intersection, add } from './drawingPlan.ts';
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  apartmentLocation,
  apartmentWindows,
  buildingFootprint,
  footprintMetres,
  stairwellWindows,
  effectiveExpenses,
  groupExpenses,
  issuePosition,
  money,
  totalExpenses,
} from "./domain.ts";
test("real apartment numbering starts above the shops and runs bottom-up", () => {
  assert.deepEqual(apartmentLocation(1), { entrance: 1, floor: 2 });
  assert.deepEqual(apartmentLocation(45), { entrance: 2, floor: 2 });
  assert.deepEqual(apartmentLocation(120), { entrance: 3, floor: 9 });
  for (const entrance of [1, 2, 3]) for (let floor = 2; floor <= 9; floor++) {
    const apartments = Array.from({ length: 120 }, (_, i) => i + 1).filter((a) => {
      const l = apartmentLocation(a); return l.entrance === entrance && l.floor === floor;
    });
    assert.equal(apartments.length, 5);
  }
  for (const invalid of [0, 121, 1.5, NaN]) assert.throws(() => apartmentLocation(invalid), RangeError);
});
test("every home owns 2-4 unique windows on its residential floor", () => {
  const ids = new Set(), positions = new Set();
  for (let apt = 1; apt <= 120; apt++) {
    const panes = apartmentWindows(apt);
    assert.ok(panes.length >= 2 && panes.length <= 4);
    assert.ok(panes.every(w => w.side === "courtyard" || w.side === "street"));
    for (const pane of panes) {
      assert.equal(pane.apartment, apt);
      assert.equal(pane.position[1], (apartmentLocation(apt).floor - 0.5) * 1.2);
      assert.ok(!ids.has(pane.id)); ids.add(pane.id);
      const key = pane.position.join(","); assert.ok(!positions.has(key)); positions.add(key);
    }
  }
});
test("stairwells sit between residential floors and belong to no apartment", () => {
  assert.equal(stairwellWindows.length, 24);
  const owned = new Set(Array.from({ length: 120 }, (_, i) => apartmentWindows(i + 1)).flat().map(w => w.id));
  for (const w of stairwellWindows) {
    assert.equal(w.apartment, null);
    assert.ok(!owned.has(w.id));
    assert.ok(Math.abs(Math.round(w.position[1] / 1.2) - w.position[1] / 1.2) < 1e-10);
  }
});
test("surveyed L footprint retains every edge length at a constant scale", () => {
  const survey = JSON.parse(readFileSync("../docs/ux-review/real-building-footprint.json", "utf8"));
  assert.deepEqual(footprintMetres, survey.footprint);
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    assert.ok(Math.abs(length(buildingFootprint[i], buildingFootprint[next]) - length(footprintMetres[i], footprintMetres[next]) * .4) < 1e-10);
  }
});
test("corrections drive exact money totals and category sums", () => {
  const report = {
    expenses: [{ category: "Cleaning", amount: 10 }],
    corrections: [
      {
        expenses: [
          { category: "Cleaning", amount: 20 },
          { category: "Cleaning", amount: 5 },
          { category: "Salary", amount: 30 },
        ],
      },
    ],
  };
  const items = effectiveExpenses(report);
  assert.equal(totalExpenses(items), 55);
  assert.deepEqual(groupExpenses(items), [
    ["Cleaning", 25],
    ["Salary", 30],
  ]);
  assert.equal(report.expenses[0].amount, 10);
});
test("real locations map to distinct building and common-area coordinates", () => {
  assert.notDeepEqual(
    issuePosition({ entrance: 1, floor: 1, area: "" }),
    issuePosition({ entrance: 2, floor: 2, area: "" }),
  );
  assert.deepEqual(
    issuePosition({ entrance: 0, floor: 0, area: "Playground" }),
    issuePosition({ entrance: 0, floor: 0, area: "Courtyard" }),
  );
});
import { cameraAt, chapterAt, scriptIssue, scriptVotes } from "./cinematic.ts";
test("cinematic chapters and issue workflow are deterministic at boundaries", () => {
  assert.equal(chapterAt(0), 0);
  assert.equal(chapterAt(90), 8);
  assert.equal(scriptIssue(10).status, "New");
  assert.deepEqual(scriptIssue(15).location, { entrance: 2, floor: 2, area: "" });
  assert.equal(scriptIssue(20).supporters.length, 3);
  assert.equal(scriptIssue(30).status, "In Progress");
  assert.equal(scriptIssue(40).status, "Resolved");
  assert.equal(scriptVotes(79), 100);
  assert.equal(scriptVotes(69), 0);
});
test("camera follows a finite continuous path at all chapter boundaries", () => {
  for (let time = 0; time <= 90; time += 0.1) {
    const camera = cameraAt(time);
    assert.ok([...camera.position, ...camera.target].every(Number.isFinite));
  }
  for (let time = 10; time < 90; time += 10) {
    const before = cameraAt(time - 0.001).position,
      after = cameraAt(time).position;
    assert.ok(Math.hypot(...before.map((v, i) => v - after[i])) < 0.01);
  }
});

import { scriptVotedApartments } from "./cinematic.ts";
test("cinematic voter windows remain scripted before and after the voting chapter", () => {
  assert.deepEqual(scriptVotedApartments(10), []);
  assert.deepEqual(scriptVotedApartments(69), []);
  assert.equal(scriptVotedApartments(78).length, 100);
  assert.equal(new Set(scriptVotedApartments(78)).size, 100);
});

test("money uses the shared tenge format with ordinary grouping spaces", () => {
  assert.equal(money(1760000), "₸1 760 000");
  assert.equal(money(0), "₸0");
  assert.equal(money(-24000), "₸-24 000");
});

import { fittedShot, homeBounds, filmBounds, entranceBounds, labelPlacement } from "./framing.ts";
test("camera fits the whole subject into desktop, tablet, phone and embed clear areas", () => {
  for (const [width, height, area] of [
    [1440, 900, { left: 500, top: 190, right: 1416, bottom: 780 }],
    [768, 1024, { left: 24, top: 390, right: 744, bottom: 864 }],
    [390, 844, { left: 24, top: 245, right: 366, bottom: 650 }],
    [320, 240, { left: 12, top: 18, right: 308, bottom: 218 }],
  ]) {
    const shot = fittedShot([3.5, 5.2, 2.8], [32, 24, 42], homeBounds, area, width, height);
    const { PerspectiveCamera, Vector3 } = createRequire(process.cwd() + "/package.json")("three");
    const camera = new PerspectiveCamera(43, width / height, .1, 600);
    camera.position.set(...shot.position);
    camera.lookAt(...shot.target);
    camera.setViewOffset(width, height, ...shot.offset, width, height);
    camera.updateMatrixWorld();
    for (const [x, y, z] of homeBounds.points) {
          const projected = new Vector3(x, y, z).project(camera);
          const px = (projected.x + 1) * width / 2;
          const py = (1 - projected.y) * height / 2;
          assert.ok(px >= area.left && px <= area.right && py >= area.top && py <= area.bottom);
        }
    assert.ok(shot.position.every(Number.isFinite));
  }
  for (const entrance of [1, 2, 3]) {
    const bounds = entranceBounds(entrance, [0, 0, 0]);
    assert.equal(bounds.min[1], 0);
    assert.ok(bounds.max[1] > 12);
  }
});
test("labels move away from panels and hide when no nearby free placement exists", () => {
  const area = { left: 16, top: 155, right: 1424, bottom: 876 };
  const journal = { left: 1100, top: 234, right: 1400, bottom: 730 };
  const moved = labelPlacement(1090, 500, 110, 30, area, [journal]);
  assert.ok(moved && moved.right < journal.left);
  assert.equal(labelPlacement(10, 500, 110, 30, area, [area]), null);
  assert.equal(labelPlacement(-500, 300, 110, 30, area, []), null);
});
test("film fitting expands smoothly for money and neighbouring buildings", () => {
  const area = { left: 400, top: 155, right: 1100, bottom: 590 };
  const positionAt = time => {
    const shot = cameraAt(time);
    return fittedShot(shot.target, shot.position.map((v, i) => v - shot.target[i]), filmBounds(time), area, 1440, 900).position;
  };
  for (const time of [40, 50, 60, 70, 76, 80, 84]) {
    const before = positionAt(time - .001), after = positionAt(time + .001);
    assert.ok(Math.hypot(...before.map((v, i) => v - after[i])) < .1);
  }
});
test("the paused film clock seeks exactly before its first play", () => {
  const { gsap } = createRequire(process.cwd() + "/package.json")("gsap");
  const clock = { time: 0 };
  const tween = gsap.fromTo(clock, { time: 0 }, { time: 90, duration: 90, ease: "none", paused: true });
  for (const time of [25, 55, 75, 0, 90]) {
    clock.time = time;
    tween.progress(time / 90);
    assert.ok(Math.abs(clock.time - time) < .001);
    assert.equal(tween.paused(), true);
  }
  tween.kill();
  gsap.ticker.sleep();
});


import { modelFor, sauran, validBuilding, localFootprint, modelFocus, modelIssue } from "./buildingModel.ts";
import { managedFilter, cityStyle, buildingTint, facadePalette } from "./mapStyle.ts";
const secondBuilding = {
  id: 2, name: 'Second mapped home', address: 'Other district', lat: 51.16, lon: 71.45,
  floors: 5, entrances: 2, apartments: 32,
  footprint: [[71.4497, 51.15995], [71.4503, 51.15995], [71.4503, 51.16005], [71.4497, 51.16005]],
};
const legacySauran = { ...sauran, entrance_plans: undefined };
const overriddenSecond = { ...secondBuilding, apartments: 28, floor_plan: [1, 2, 3, 2], entrance_plans: { '2': [3, 1, 2] } };
test('Sauran seed uses per-entrance plans and preserves apartment numbering', () => {
  const model = modelFor(sauran);
  assert.deepEqual(model.footprint, buildingFootprint);
  for (let apt = 1; apt <= 120; apt++) {
    assert.deepEqual(model.location(apt), apartmentLocation(apt));
    assert.deepEqual(model.windows.filter(w => w.apartment === apt), apartmentWindows(apt));
  }
});
test('a different real footprint generates its own floors, entrances and unique windows', () => {
  assert.equal(validBuilding(secondBuilding), true);
  const model = modelFor(secondBuilding), positions = new Set();
  assert.equal(model.footprint.length, 4);
  assert.equal(model.height, 6);
  assert.equal(model.entrances.length, 2);
  assert.deepEqual(model.location(1), { entrance: 1, floor: 2 });
  assert.deepEqual(model.location(32), { entrance: 2, floor: 5 });
  for (let apt = 1; apt <= 32; apt++) {
    const windows = model.windows.filter(w => w.apartment === apt);
    assert.ok(windows.length >= 2 && windows.length <= 4);
    for (const w of windows) {
      assert.ok(w.position.every(Number.isFinite));
      assert.ok(w.position[1] < model.height);
      assert.equal(w.position[1], (model.location(apt).floor - .5) * 1.2);
      assert.ok(!positions.has(w.position.join(','))); positions.add(w.position.join(','));
    }
    assert.ok(modelFocus(model, apt).every(Number.isFinite));
  }
  assert.throws(() => model.location(33), RangeError);
  assert.ok(modelIssue(model, { entrance: 2, floor: 2, area: '' }).every(Number.isFinite));
  assert.deepEqual(modelIssue(model, { entrance: 0, floor: 0, area: 'Playground' }), modelIssue(model, { entrance: 1, floor: 0, area: 'Courtyard' }));
});
test('surveyed coordinates keep true metre scale in another district', () => {
  const footprint = localFootprint(secondBuilding);
  const realWidth = .0006 * Math.PI / 180 * 6378137 * Math.cos(secondBuilding.lat * Math.PI / 180);
  assert.ok(Math.abs(Math.hypot(footprint[1][0] - footprint[0][0], footprint[1][1] - footprint[0][1]) - realWidth * .4) < .001);
  assert.equal(validBuilding({ ...secondBuilding, footprint: [[NaN, 51], [71, 51], [71, 52]] }), false);
  assert.equal(validBuilding({ ...secondBuilding, footprint: [] }), false);
});
test('managed building masks cover every footprint including tile quantisation', () => {
  const filter = managedFilter([sauran, secondBuilding]);
  assert.equal(filter[0], 'all'); assert.equal(filter.length, 3);
  for (const mask of filter.slice(1)) {
    assert.equal(mask[0], '!'); assert.equal(mask[1][0], 'within');
    const ring = mask[1][1].coordinates[0]; assert.deepEqual(ring[0], ring[ring.length - 1]);
  }
});
test('custom map uses real layers, height fields, local labels and seasonal palettes', () => {
  const style = cityStyle(true, true, true, [sauran]);
  assert.equal(style.sources.city.url, 'https://tiles.openfreemap.org/planet');
  const buildings = style.layers.find(l => l.id === 'city-buildings');
  assert.equal(buildings.minzoom, 15);
  assert.ok(JSON.stringify(buildings.paint).includes('render_height'));
  assert.ok(JSON.stringify(buildings.paint).includes('render_min_height'));
  assert.ok(JSON.stringify(style.layers.find(l => l.id === 'street-names')).includes('name:kk'));
  assert.notEqual(style.layers[0].paint['background-color'], cityStyle(false, false, false, []).layers[0].paint['background-color']);
});

import { repairBuildings, insideRing } from './tileBuildings.ts';
test('merged same-height tile features lose only the managed polygon', () => {
  const home = [...sauran.footprint, sauran.footprint[0]];
  const other = [...secondBuilding.footprint, secondBuilding.footprint[0]];
  const features = [{ id: 123, properties: { render_height: 29 }, geometry: { type: 'MultiPolygon', coordinates: [[home], [other]] } }];
  const repair = repairBuildings(features, [sauran]);
  assert.deepEqual(repair.ids, [123]);
  assert.equal(repair.data.features.length, 1);
  assert.deepEqual(repair.data.features[0].geometry.coordinates, [other]);
  assert.equal(repair.data.features[0].properties.render_height, 29);
  assert.equal(repairBuildings(features, [sauran, secondBuilding]).data.features.length, 0);
  assert.equal(insideRing([secondBuilding.lon, secondBuilding.lat], other), true);
  assert.equal(insideRing([sauran.lon, sauran.lat], other), false);
});

import { mapFitZoom } from './framing.ts';
test('map fitting includes roof height and consistently uses only the free HUD area', () => {
  const points = [[-40, -10], [40, -10], [40, 10], [-40, 10]];
  const desktop = mapFitZoom(points, 27, 51.12, 30, 58, 900, 560);
  const resident = mapFitZoom(points, 27, 51.12, 30, 58, 680, 560);
  const phone = mapFitZoom(points, 27, 51.12, 30, 58, 354, 400);
  assert.ok(Number.isFinite(desktop)); assert.ok(desktop > resident); assert.ok(resident > phone);
  assert.ok(mapFitZoom(points, 90, 51.12, 30, 58, 900, 560) < desktop);
});

import { screenPolygon, interiorPoint } from './tileBuildings.ts';
test('picker hit testing follows elevated roofs and walls rather than the ground behind them', () => {
  const first = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
  const second = [[[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]]];
  const feature = { properties: { render_height: 60 }, geometry: { type: 'MultiPolygon', coordinates: [first, second] } };
  const project = ([x, y], height) => [x, y - height];
  assert.deepEqual(screenPolygon(feature, [25, -55], project), second);
  assert.deepEqual(screenPolygon(feature, [25, -20], project), second);
  assert.equal(screenPolygon(feature, [50, -55], project), undefined);
  assert.ok(insideRing(interiorPoint(first), first[0]));
  const concave = [[...sauran.footprint, sauran.footprint[0]]];
  assert.ok(insideRing(interiorPoint(concave), concave[0]));
});

const styleSpec = createRequire(process.cwd() + "/package.json")("@maplibre/maplibre-gl-style-spec");
test('facades preserve valid tile hues and use stable neutral fallbacks for missing or invalid colours', () => {
  const evaluate = (night, id, colour) => {
    const result = styleSpec.createExpression(buildingTint(night), { type: 'color' });
    assert.equal(result.result, 'success', JSON.stringify(result.value));
    return result.value.evaluate({ zoom: 17 }, { id, type: 'Polygon', properties: { render_height: 29, ...(colour === undefined ? {} : { colour }) } });
  };
  const red = evaluate(false, 12, '#A0533D'), moonlit = evaluate(true, 12, '#A0533D');
  assert.ok(Math.abs(red.r - 160 / 255) < .001);
  assert.ok(moonlit.r > moonlit.g && moonlit.g > moonlit.b);
  assert.ok(moonlit.r < red.r && moonlit.g < red.g && moonlit.b < red.b);
  const distinct = new Set();
  for (let id = 1; id <= 20; id++) {
    const fallback = evaluate(false, id).toString();
    distinct.add(fallback);
    assert.equal(evaluate(false, id, 'not-a-colour').toString(), fallback);
    assert.equal(evaluate(false, id).toString(), fallback);
  }
  assert.equal(distinct.size, facadePalette.length);
});
test('all seasonal styles validate and keep solid vertically shaded buildings and mapped road markings', () => {
  for (const winter of [false, true]) for (const night of [false, true]) {
    const style = cityStyle(winter, night, true, [sauran]);
    assert.deepEqual(styleSpec.validateStyleMin(style).map(e => e.message), []);
    for (const id of ['city-buildings', 'city-building-patches']) {
      const paint = style.layers.find(l => l.id === id).paint;
      assert.equal(paint['fill-extrusion-opacity'], 1);
      assert.equal(paint['fill-extrusion-vertical-gradient'], true);
    }
    assert.equal(style.layers.find(l => l.id === 'road-markings')['source-layer'], 'transportation');
  }
});
test('repaired tile parts retain IDs and original colour attributes', () => {
  const home = [...sauran.footprint, sauran.footprint[0]], other = [...secondBuilding.footprint, secondBuilding.footprint[0]];
  const repair = repairBuildings([{ id: 87, properties: { render_height: 29, colour: '#CFC4B0' }, geometry: { type: 'MultiPolygon', coordinates: [[home], [other]] } }], [sauran]);
  assert.equal(repair.data.features[0].id, 87);
  assert.equal(repair.data.features[0].properties.colour, '#CFC4B0');
});

import { apartmentAddress, floorPlansFor, floorPlanFor, defaultFloorPlan, localPoint, polygonArea, onBoundary, joinPolygons, joinPolygonParts } from './apartmentPlan.ts';
test('legacy floor plans follow the shared contract without inventing a room mix', () => {
  assert.deepEqual(floorPlanFor(undefined, 120, 3, 9), [3, 1, 2, 1, 3]);
  assert.deepEqual(floorPlanFor(undefined, 32, 2, 5), [2, 2, 2, 2]);
  assert.deepEqual(floorPlanFor([1, 5, 3, 4], 32, 2, 5), [1, 5, 3, 4]);
  assert.throws(() => floorPlanFor(undefined, 31, 2, 5), RangeError);
  for (const plan of [[], [1, 2], [0, 1, 2, 1, 3], [6, 1, 2, 1, 3], [1.5, 1, 2, 1, 3]])
    assert.throws(() => floorPlanFor(plan, 120, 3, 9), RangeError);
  assert.deepEqual(modelFor({ ...sauran, floor_plan: undefined }).building.floor_plan, defaultFloorPlan);
  assert.equal(modelFor(sauran).cells.find(c => c.apartment === 45).rooms, 3);
});
// Ear clipping makes overlap checks work for room entrance alcoves as well.
function triangles(polygon: Point[]): Point[][] {
  const points = [...polygon];
  const sign = points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
  const result: Point[][] = [];
  while (points.length > 3) {
    const ear = points.findIndex((b, i) => {
      const a = points[(i + points.length - 1) % points.length], c = points[(i + 1) % points.length];
      if (sign * ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) <= 1e-9) return false;
      return !points.some(p => p !== a && p !== b && p !== c && inside(p, [a, b, c]));
    });
    if (ear < 0) break;
    result.push([points[(ear + points.length - 1) % points.length], points[ear], points[(ear + 1) % points.length]]);
    points.splice(ear, 1);
  }
  if (points.length === 3) result.push(points);
  return result;
}
function overlapArea(a: Point[], b: Point[]): number {
  return triangles(a).reduce((sum, p) => sum + triangles(b).reduce((area, q) => area + polygonArea(intersection(p, q)), 0), 0);
}


function checkApartmentGeometry(building) {
  const model = modelFor(building), owned = new Set(), ids = new Set();
  for (const cell of model.cells) {
    const panes = model.windows.filter(w => w.apartment === cell.apartment);
    assert.equal(panes.length, cell.rooms + 1);
    assert.deepEqual(model.location(cell.apartment), { entrance: cell.entrance, floor: cell.floor });
    assert.ok(cell.area > 0 && Number.isFinite(cell.area));
    assert.ok(Math.abs(cell.area - polygonArea(cell.outline) * 6.25) < 1e-8);
    const outline = cell.outline.map(p => localPoint(cell.section, p));
    for (const pane of panes) {
      const point = localPoint(cell.section, [pane.position[0], pane.position[2]]);
      assert.ok(point[0] >= cell.start - 1e-8 && point[0] <= cell.end + 1e-8);
      // Boundary panes are inside the clipped polygon including its perimeter.
      const nearEdge = outline.some((p, i) => {
        const q = outline[(i + 1) % outline.length], dx = q[0] - p[0], dz = q[1] - p[1];
        const cross = (point[0] - p[0]) * dz - (point[1] - p[1]) * dx;
        return Math.abs(cross) < 1e-7 && point[0] >= Math.min(p[0], q[0]) - 1e-8 && point[0] <= Math.max(p[0], q[0]) + 1e-8 && point[1] >= Math.min(p[1], q[1]) - 1e-8 && point[1] <= Math.max(p[1], q[1]) + 1e-8;
      });
      assert.ok(nearEdge, `window ${pane.id} must lie on its cell perimeter`);
      const along = [Math.cos(pane.rotation), -Math.sin(pane.rotation)];
      for (const side of [-1, 1]) {
        const point = [pane.position[0] + along[0] * pane.width / 2 * side, pane.position[2] + along[1] * pane.width / 2 * side];
        const boundary = polygon => polygon.some((a, i) => {
          const b = polygon[(i + 1) % polygon.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
          if (length < 1e-8) return false;
          const cross = Math.abs((point[0] - a[0]) * dz - (point[1] - a[1]) * dx) / length;
          const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length ** 2;
          return cross < .001 && t >= -1e-7 && t <= 1 + 1e-7;
        });
        assert.ok(boundary(cell.outline), `whole pane ${pane.id} fits its own cell`);
        assert.ok(boundary(model.footprint), `pane ${pane.id} faces outside, including corner returns`);
      }
      assert.equal(pane.position[1], (cell.floor - .5) * 1.2);
      assert.ok(!inside([pane.position[0] + Math.sin(pane.rotation) * .01, pane.position[2] + Math.cos(pane.rotation) * .01], model.footprint), `outward normal ${pane.id}`);
      const key = pane.position.map(v => v.toFixed(7)).join(',');
      assert.ok(!owned.has(key)); owned.add(key);
      assert.ok(!ids.has(pane.id)); ids.add(pane.id);
    }
    for (const other of model.cells.filter(c => c.entrance === cell.entrance && c.floor === cell.floor && c.apartment > cell.apartment)) {
      assert.ok(overlapArea(cell.outline, other.outline) < 1e-7, `no overlapping flats ${cell.apartment}/${other.apartment}`);
    }
  }
  // Homes plus shared cores cover the surveyed floor once, including the L corner.
  const homeArea = model.cells.filter(c => c.floor === 2).reduce((sum, c) => sum + c.area / 6.25, 0);
  const coreArea = model.cores.reduce((sum, core) => sum + polygonArea(core.outline), 0);
  assert.ok(Math.abs(homeArea + coreArea - polygonArea(model.footprint)) < 1e-7);
  return model;
}
test('seed and edited plans tile each entrance with unique windows inside their own cells', () => {
  const seed = checkApartmentGeometry(sauran);
  assert.deepEqual([42, 43, 45].map(a => seed.cells.find(c => c.apartment === a).rooms), [1, 2, 3]);
  checkApartmentGeometry({ ...sauran, floor_plan: [5, 1, 4, 2, 3] });
  checkApartmentGeometry(secondBuilding);
  checkApartmentGeometry({ ...secondBuilding, floor_plan: [1, 5, 4, 3] });
  checkApartmentGeometry({ ...secondBuilding, apartments: 8, floor_plan: [5] });
  checkApartmentGeometry({ ...secondBuilding, apartments: 96, floor_plan: Array(12).fill(1) });
});
test('changing a managed floor plan changes every repeated floor while preserving numbering', () => {
  const model = modelFor({ ...sauran, entrance_plans: {}, floor_plan: [1, 2, 3, 4, 5] });
  for (const apartment of [5, 45, 120]) {
    assert.equal(model.cells.find(c => c.apartment === apartment).rooms, 5);
    assert.equal(model.windows.filter(w => w.apartment === apartment).length, 6);
  }
  assert.deepEqual(model.location(1), { entrance: 1, floor: 2 });
  assert.deepEqual(model.location(45), { entrance: 2, floor: 2 });
  assert.deepEqual(model.location(120), { entrance: 3, floor: 9 });
});

test('the third entrance has no zero-area tail along the main wing facade', () => {
  const model = modelFor(sauran), wing = model.cells.filter(c => c.entrance === 3);
  for (const cell of wing) {
    assert.ok(cell.outline.every(p => p[0] < -7));
    assert.ok(cell.outline.every(p => inside(p, buildingFootprint)));
    const local = cell.outline.map(p => localPoint(cell.section, p));
    assert.ok(Math.max(...local.map(p => p[1])) - Math.min(...local.map(p => p[1])) < 5.5);
  }
});
test('a generic L-shaped managed outline also tiles without shared windows', () => {
  checkApartmentGeometry({ ...sauran, id: 3, osm_id: 999, floor_plan: [1, 2, 3, 4, 5] });
});

// Circulation checks cover the actual polygons, not their overlapping x bounds.
test('stairs, lift and connected landing tile every section and every home has its own landing door', () => {
  for (const building of [sauran, legacySauran, overriddenSecond, { ...sauran, floor_plan: [5, 1, 4, 2, 3] }, secondBuilding, { ...secondBuilding, floor_plan: [1, 5, 4, 3] }, { ...secondBuilding, apartments: 64, floor_plan: [1, 2, 3, 4, 5, 1, 2, 3] }]) {
    const model = checkApartmentGeometry(building);
    for (const core of model.cores) {
      const flats = model.cells.filter(c => c.floor === 2 && c.entrance === core.entrance);
      const pieces = [core.stair, ...core.lifts, core.landing, ...(core.utilities ?? []), ...flats.map(f => f.outline)];
      const area = pieces.reduce((s, p) => s + polygonArea(p), 0);
      assert.ok(Math.abs(area - polygonArea(flats[0].section.outline)) < 1e-6, `section coverage ${building.id}/${core.entrance}`);
      for (let i = 0; i < pieces.length; i++) for (const other of pieces.slice(i + 1)) assert.ok(overlapArea(pieces[i], other) < 1e-7);
      for (const flat of flats) {
        assert.ok(onBoundary(flat.entry.point, core.landing), `landing ${flat.apartment}`);
        assert.ok(onBoundary(flat.entry.point, flat.outline));
        assert.ok(inside(add(flat.entry.point, flat.entry.inward, .1), flat.outline));
        for (const other of flats.filter(f => f !== flat)) assert.ok(!onBoundary(flat.entry.point, other.outline));
      }
      for (const door of core.doors) {
        assert.ok(onBoundary(door.point, core.landing), `core door joins landing ${door.kind}`);
        const target = door.kind === 'stair' ? core.stair : door.kind === 'lift' ? core.lifts[0] : core.utilities.find(p => onBoundary(door.point, p));
        assert.ok(onBoundary(door.point, target));
        assert.ok(inside(add(door.point, door.inward, -.05), core.landing));
        assert.ok(inside(add(door.point, door.inward, .05), target));
      }
      const dimensions = polygon => { const local = polygon.map(p => localPoint(flats[0].section, p)); return [0, 1].map(axis => (Math.max(...local.map(p => p[axis])) - Math.min(...local.map(p => p[axis]))) * 2.5); };
      const stair = dimensions(core.stair).sort((a, b) => a - b);
      assert.ok(stair[0] >= 2.4 && stair[0] <= 3.2 && stair[1] >= 4.5 && stair[1] <= 6.5, `stair ${stair}`);
      for (const lift of core.lifts) assert.ok(dimensions(lift).every(v => v >= 1.6 && v <= 2.1));
      const local = core.landing.map(p => localPoint(flats[0].section, p));
      const lift = core.lifts[0].map(p => localPoint(flats[0].section, p));
      assert.ok((Math.min(...lift.map(p => p[1])) - Math.min(...local.map(p => p[1]))) * 2.5 >= 1.5, 'clear corridor width');
      const panes = model.windows.filter(w => w.apartment === null && w.id.startsWith(`stair-${core.entrance}-`));
      assert.equal(panes.length, building.floors - 1);
      assert.ok(panes.every(w => onBoundary([w.position[0], w.position[2]], core.stair) && onBoundary([w.position[0], w.position[2]], model.footprint)));
    }
  }
});

test('one to twelve homes and compact footprint fallbacks retain valid circulation', () => {
  const square = { ...secondBuilding, entrances: 1, floors: 3, footprint: [[71.44, 51.13], [71.44012, 51.13], [71.44012, 51.13006], [71.44, 51.13006]] };
  for (const base of [secondBuilding, square]) for (let count = 1; count <= 12; count++) {
    const building = { ...base, apartments: base.entrances * (base.floors - 1) * count, floor_plan: Array.from({ length: count }, (_, i) => i % 5 + 1) };
    const model = checkApartmentGeometry(building);
    for (const core of model.cores) {
      const flats = model.cells.filter(c => c.floor === 2 && c.entrance === core.entrance);
      const pieces = [core.landing, core.stair, ...core.lifts, ...(core.utilities ?? []), ...flats.map(c => c.outline)];
      assert.ok(Math.abs(pieces.reduce((s, p) => s + polygonArea(p), 0) - polygonArea(flats[0].section.outline)) < 1e-6);
      for (let i = 0; i < pieces.length; i++) for (const other of pieces.slice(i + 1)) assert.ok(overlapArea(pieces[i], other) < 1e-7);
      for (const flat of flats) assert.ok(onBoundary(flat.entry.point, core.landing));
    }
  }
});

const grossBands = [[0, 0], [35, 50], [55, 75], [75, 100], [95, 125], [115, 150]];
const proportionBuildings = [sauran, legacySauran, overriddenSecond, { ...sauran, floor_plan: [5, 1, 4, 2, 3] }, { ...sauran, floor_plan: [1, 2, 3, 4, 5] }, secondBuilding, { ...secondBuilding, floor_plan: [1, 5, 4, 3] }, ...Array.from({ length: 12 }, (_, i) => ({ ...secondBuilding, apartments: 2 * 4 * (i + 1), floor_plan: Array.from({ length: i + 1 }, (_, j) => j % 5 + 1) }))];

test('gross areas follow room-count bands with one uniform scale per small section', () => {
  for (const building of proportionBuildings) {
    const model = modelFor(building);
    for (const core of model.cores) {
      const flats = model.cells.filter(c => c.floor === 2 && c.entrance === core.entrance);
      const scale = flats[0].areaScale;
      assert.ok(scale > 0 && scale <= 1);
      for (const flat of flats) {
        assert.equal(flat.areaScale, scale);
        const [min, max] = grossBands[flat.rooms];
        assert.ok(flat.area >= min * scale - .02 && flat.area <= max * scale + .02, `${building.floor_plan} entrance ${core.entrance} flat ${flat.apartment}: ${flat.area}, scale ${scale}`);
        for (const larger of flats.filter(c => c.rooms > flat.rooms)) assert.ok(larger.area > flat.area, `${flat.apartment}/${larger.apartment}: larger room count means larger gross area`);
      }
    }
  }
});

test('homes have compact bounds and a useful clear depth, including explicit small-section scaling', () => {
  for (const building of proportionBuildings) {
    const model = modelFor(building);
    for (const cell of model.cells.filter(c => c.floor === 2)) {
      const p = cell.outline.map(p => localPoint(cell.section, p));
      const dimensions = [0, 1].map(axis => (Math.max(...p.map(q => q[axis])) - Math.min(...p.map(q => q[axis]))) * 2.5);
      assert.ok(Math.max(...dimensions) / Math.min(...dimensions) <= 2.23, `flat ${cell.apartment} bounds ${dimensions}`);
      assert.ok(dimensions[1] - .25 >= 5.5 * Math.sqrt(cell.areaScale) - .15, `flat ${cell.apartment} clear window depth ${dimensions[1] - .25}`);
    }
  }
});

test('the corridor stops at the last front door plus at most 1.5 m', () => {
  for (const building of proportionBuildings) {
    const model = modelFor(building);
    for (const core of model.cores) {
      const flats = model.cells.filter(c => c.floor === 2 && c.entrance === core.entrance), section = flats[0].section;
      const corridor = core.corridor.map(p => localPoint(section, p)[0]);
      const reach = [...flats.map(c => c.entry.point), ...core.doors.filter(d => d.kind === 'stair').map(d => d.point)].map(p => localPoint(section, p)[0]);
      assert.ok((Math.max(...corridor) - Math.min(...corridor)) * 2.5 <= (Math.max(...reach) - Math.min(...reach)) * 2.5 + 1.5 + 1e-6);
      for (const flat of flats) assert.ok(onBoundary(flat.entry.point, core.landing));
    }
  }
});

test('polygon joins retain disconnected pockets and remove zero-width clipping spikes', () => {
  const pieces = [
    [[0, 0], [4, 0], [4, 3], [2.4, 3], [2.4, 3.4], [0, 3.4]],
    [[2.4, 4.5], [2.4, 5.7], [.9, 5.7], [.9, 4.5], [0, 4.5]],
    [[1, 4.5], [.9, 4.5], [0, 4.5], [0, 3.4], [1, 3.4]],
  ];
  const joined = joinPolygons(pieces);
  assert.ok(Math.abs(polygonArea(joined) - pieces.reduce((s, p) => s + polygonArea(p), 0)) < 1e-8);
  assert.equal(joinPolygonParts([joined, [[10, 0], [11, 0], [11, 1], [10, 1]]]).length, 2);
});


test('per-entrance numbering and location round-trip for every apartment with unequal plan lengths', () => {
  for (const building of [sauran, legacySauran, overriddenSecond, { ...sauran, apartments: 104, entrance_plans: { '1': [3, 1, 2] } }]) {
    const model = checkApartmentGeometry(building);
    const { plans, apartments } = floorPlansFor(building.floor_plan, building.entrance_plans, building.apartments, building.entrances, building.floors);
    assert.equal(model.building.apartments, apartments);
    assert.equal(model.cells.length, apartments);
    let apartment = 1;
    for (let entrance = 1; entrance <= building.entrances; entrance++) for (let floor = 2; floor <= building.floors; floor++) {
      for (const [position, rooms] of plans[entrance - 1].entries()) {
        const cell = model.cells.find(c => c.apartment === apartment);
        assert.deepEqual(apartmentAddress(apartment, building.floors, plans), { entrance, floor, position });
        assert.deepEqual(model.location(apartment), { entrance, floor });
        assert.equal(cell.rooms, rooms);
        apartment++;
      }
    }
    assert.equal(apartment - 1, apartments);
    for (const invalid of [0, -1, 1.5, NaN, Infinity, apartments + 1]) assert.throws(() => model.location(invalid), RangeError);
  }
  const derived = modelFor({ ...overriddenSecond, apartments: undefined });
  assert.equal(derived.building.apartments, 28);
  assert.deepEqual(modelFor({ ...overriddenSecond, floor_plan: undefined }).building.floor_plan, [2, 2, 2, 2]);
});

test('entrance plans validate keys, room counts, sizes and the sum of all residential floors', () => {
  for (const entrance_plans of [{ '0': [2] }, { '4': [2] }, { '03': [2] }, { '1.5': [2] }, { '3': [] }, { '3': Array(13).fill(2) }, { '3': [0] }, { '3': [6] }, { '3': [1.5] }, { '3': null }, [], null]) {
    assert.throws(() => modelFor({ ...sauran, entrance_plans }), RangeError);
  }
  assert.throws(() => modelFor({ ...overriddenSecond, apartments: 32 }), /sum of each entrance plan/);
  assert.throws(() => modelFor({ ...sauran, apartments: 119 }), /sum of each entrance plan/);
  assert.equal(modelFor({ ...sauran, entrance_plans: {} }).cells.length, 120);
  assert.equal(modelFor({ ...sauran, apartments: 24, entrance_plans: { '1': [1], '2': [2], '3': [3] } }).cells.length, 24);
});

test('Sauran seed fills entrance 3 with real homes in normal bands and no common Utility filler', () => {
  const model = modelFor(sauran);
  assert.deepEqual(model.cells.filter(c => c.entrance === 3 && c.floor === 2).map(c => c.rooms), [3, 2, 2, 2, 3]);
  assert.deepEqual(model.cores.find(c => c.entrance === 3).utilities, []);
  const positions = [82, 83, 84].map(apartment => model.cells.find(c => c.apartment === apartment));
  assert.ok(positions[0].centre[2] < positions[1].centre[2] && positions[1].centre[2] < positions[2].centre[2], 'middle positions keep their left-to-right order along the wing');
  for (const cell of model.cells.filter(c => c.entrance === 3)) {
    assert.equal(cell.areaScale, 1);
    assert.ok(cell.area >= grossBands[cell.rooms][0] && cell.area <= grossBands[cell.rooms][1]);
  }
  const edited = modelFor({ ...sauran, floor_plan: [5, 1, 4, 2, 3] });
  assert.deepEqual(edited.cells.filter(c => c.entrance === 3).map(c => c.rooms), model.cells.filter(c => c.entrance === 3).map(c => c.rooms));
});

test('Sauran without overrides keeps the previous numbering and exact default flat areas', () => {
  const model = modelFor(legacySauran), empty = modelFor({ ...sauran, entrance_plans: {} });
  const areas = [94.97390384416966, 46.250000000000014, 61.48730398641485, 46.25, 94.98881534945198, 95.18376380014708, 46.24999999999999, 61.487325105740666, 46.250000000000014, 94.94203756486847, 97.49999999997748, 45.9789313462248, 60.8911115791131, 45.68020182210826, 97.49999999999939];
  assert.deepEqual(empty.cells, model.cells);
  for (const cell of model.cells) {
    const position = (cell.apartment - 1) % 5;
    assert.deepEqual(model.location(cell.apartment), { entrance: Math.floor((cell.apartment - 1) / 40) + 1, floor: Math.floor((cell.apartment - 1) % 40 / 5) + 2 });
    assert.equal(cell.rooms, defaultFloorPlan[position]);
    assert.ok(Math.abs(cell.area - areas[(cell.entrance - 1) * 5 + position]) < .000001);
  }
  assert.equal(model.cores[2].utilities.length, 2, 'legacy mix still needs its documented fallback');
});
