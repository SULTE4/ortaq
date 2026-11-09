// @ts-nocheck
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelFor, sauran } from './buildingModel.ts';
import { polygonArea, localPoint } from './apartmentPlan.ts';
import { drawingPlan, inside, intersection, distance, furnishing, add, midpoint, hallLabel, roomLabel } from './drawingPlan.ts';

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

const generic = { ...sauran, id: 2, osm_id: 0, entrance_plans: {}, floors: 9, entrances: 1, apartments: 40, floor_plan: [1, 2, 3, 4, 5], footprint: [[71.44, 51.13], [71.4406, 51.13], [71.4406, 51.13015], [71.44, 51.13015]] };
for (const building of [sauran, generic, { ...sauran, floor_plan: [1, 2, 3, 4, 5] }]) {
  const model = modelFor(building);
  test(`architectural layouts preserve cells, rooms, windows and circulation in building ${building.id} (${building.floor_plan})`, () => {
    for (const cell of model.cells.filter(c => c.floor === 2)) {
      const plan = drawingPlan(cell, model.windows, cell.loggiaSides), panes = model.windows.filter(w => w.apartment === cell.apartment);
      assert.equal(plan.rooms.filter(r => r.kind === 'living' || r.kind === 'bedroom').length, cell.rooms);
      assert.equal(plan.rooms.filter(r => r.kind === 'kitchen').length, 1);
      assert.equal(plan.rooms.filter(r => r.kind === 'bath').length, 1, `bathroom ${cell.apartment}`);
      assert.equal(plan.rooms.filter(r => r.kind === 'wc').length + Number(!!plan.rooms.find(r => r.kind === 'bath')?.combined), 1);
      assert.equal(plan.windows.length, panes.length);
      assert.deepEqual(plan.windows.map(w => [w.id, w.side]).sort(), panes.map(w => [w.id, w.side]).sort());
      for (const room of plan.rooms) {
        assert.ok(room.area > 0);
        assert.ok(room.polygon.every(p => inside(p, plan.outline)), `room ${room.id} in cell ${cell.apartment}`);
        assert.ok(plan.doors.some(d => d.room === room.id), `door ${room.id} in cell ${cell.apartment}`);
        if (room.kind === 'bath' || room.kind === 'wc') assert.equal(plan.windows.filter(w => w.room === room.id).length, 0);
        for (const other of plan.rooms.filter(r => r.id !== room.id)) assert.ok(overlapArea(room.polygon, other.polygon) < 1e-6, `${room.id} and ${other.id} overlap in ${cell.apartment}`);
      }
      assert.ok(plan.doors.some(d => d.id === 'entrance'), `entrance ${cell.apartment}`);
      for (const window of plan.windows) {
        const source = panes.find(w => w.id === window.id);
        assert.ok(Math.abs(distance(window.a, window.b) - source.width * 2.5) < 1e-7);
      }
      assert.ok(Math.abs(polygonArea(plan.outline) - cell.area) < 1e-7);
    }
  });
}
test('Sauran 42, 43 and corner 45 retain the model dimensions and loggias', () => {
  const model = modelFor(sauran);
  for (const apt of [42, 43, 45]) {
    const cell = model.cells.find(c => c.apartment === apt), plan = drawingPlan(cell, model.windows, cell.loggiaSides);
    assert.equal(plan.width, (cell.end - cell.start) * 2.5);
    assert.equal(plan.windows.length, { 42: 2, 43: 3, 45: 4 }[apt]);
    assert.ok(plan.rooms.filter(r => r.kind === 'living' || r.kind === 'bedroom').every(r => furnishing(r, plan.doors, plan.windows).length > 0));
  }
  assert.equal(model.cells.find(c => c.apartment === 45).loggiaSides.length, 0);
  assert.deepEqual(model.cells.find(c => c.apartment === 41).loggiaSides, ['courtyard', 'street']);
  const cell = model.cells.find(c => c.apartment === 41);
  const plan = drawingPlan(cell, model.windows, cell.loggiaSides);
  assert.equal(plan.balconies.length, 2);
  assert.ok(plan.balconies.every(b => !b.polygon.every(p => inside(p, plan.outline))));
  assert.equal(modelFor(generic).cells.find(c => c.rooms === 4).loggiaSides, undefined);
});

test('openings keep exact model positions, street kitchens and stair-facing entrances', () => {
  for (const building of [sauran, generic]) {
    const model = modelFor(building);
    for (const cell of model.cells.filter(c => c.floor === 2)) {
      const plan = drawingPlan(cell, model.windows, cell.loggiaSides);
      const top = Math.max(...cell.outline.map(p => localPoint(cell.section, p)[1]));
      for (const pane of plan.windows) {
        const source = model.windows.find(w => w.id === pane.id);
        const local = localPoint(cell.section, [source.position[0], source.position[2]]);
        const expected = [(local[0] - cell.start) * 2.5, (top - local[1]) * 2.5];
        assert.ok(distance(midpoint(pane.a, pane.b), expected) < 1e-7);
        const room = plan.rooms.find(r => r.id === pane.room);
        assert.ok([pane.a, pane.b].every(p => inside(p, room.polygon)), `glazing inside room ${cell.apartment}`);
      }
      const kitchen = plan.rooms.find(r => r.kind === 'kitchen');
      assert.equal(plan.windows.find(w => w.room === kitchen.id).side, plan.windows.some(w => w.side === 'street') ? 'street' : 'courtyard');
      const entry = plan.doors.find(d => d.id === 'entrance');
      const source = localPoint(cell.section, cell.entry.point);
      assert.ok(distance(midpoint(entry.a, entry.b), [(source[0] - cell.start) * 2.5, (top - source[1]) * 2.5]) < 1e-6);
      for (const door of plan.doors.filter(d => d.id !== 'entrance')) {
        const room = plan.rooms.find(r => r.id === door.room);
        assert.ok([door.a, door.b].every(p => inside(p, room.polygon)), `door on room boundary ${cell.apartment}`);
        const outside = add(midpoint(door.a, door.b), door.inward, -.35);
        const target = door.to === 'hall' ? plan.hall[0] : plan.rooms.find(r => r.id === door.to)?.polygon;
        assert.ok(target && inside(outside, target), `door opens to its connected room ${cell.apartment} ${door.room}`);
      }
    }
  }
});

test('furniture fits primary layouts and clears glazing, other symbols and all door swings', () => {
  for (const building of [sauran, generic]) {
    const model = modelFor(building);
    for (const cell of model.cells.filter(c => c.floor === 2)) {
      const plan = drawingPlan(cell, model.windows, cell.loggiaSides);
      const doors = [...plan.doors, ...plan.balconies.map(b => b.door)];
      for (const room of plan.rooms) {
        const furniture = furnishing(room, doors, plan.windows);
        const required = room.kind === 'living' ? ['sofa', 'table'] : room.kind === 'bedroom' ? ['bed'] : room.kind === 'kitchen' ? ['counter', 'fridge', 'dining'] : room.kind === 'bath' ? ['sink', ...(room.combined ? ['toilet'] : [])] : room.kind === 'wc' ? ['toilet'] : [];
        if (room.kind === 'bath') assert.ok(furniture.some(f => f.kind === 'shower' || f.kind === 'tub'), `bath or shower in ${cell.apartment}`);
        for (const kind of required) assert.ok(furniture.some(f => f.kind === kind), `${kind} in ${cell.apartment} ${room.id}`);
        const toWorld = (x, y) => add(add(room.origin, room.tangent, x), room.inward, y);
        for (const f of furniture) {
          const box = [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]].map(p => toWorld(...p));
          assert.ok(box.every(p => inside(p, room.polygon)));
          for (const other of furniture.filter(o => o !== f)) assert.ok(!(f.x < other.x + other.w && f.x + f.w > other.x && f.y < other.y + other.h && f.y + f.h > other.y));
          for (const window of plan.windows.filter(w => w.room === room.id)) {
            const clear = [window.a, window.b, add(window.b, window.inward, .3), add(window.a, window.inward, .3)];
            assert.ok(polygonArea(intersection(box, clear)) < 1e-6);
          }
          for (const door of doors.filter(d => d.room === room.id)) {
            const relative = [door.a[0] - room.origin[0], door.a[1] - room.origin[1]];
            const x = relative[0] * room.tangent[0] + relative[1] * room.tangent[1];
            const y = relative[0] * room.inward[0] + relative[1] * room.inward[1];
            assert.ok(Math.hypot(Math.max(f.x - x, 0, x - f.x - f.w), Math.max(f.y - y, 0, y - f.y - f.h)) >= distance(door.a, door.b) + .09);
          }
        }
      }
    }
  }
});

test('hall labels stay in circulation space rather than inside wet rooms', () => {
  for (const building of [sauran, generic]) {
    const model = modelFor(building);
    for (const cell of model.cells.filter(c => c.floor === 2)) {
      const plan = drawingPlan(cell, model.windows, cell.loggiaSides);
      const label = hallLabel(plan, Math.max(.36, Math.min(.46, (plan.height + 3.6) * .027)));
      assert.ok(inside(label.point, plan.outline));
      assert.ok(!plan.rooms.some(r => inside(label.point, r.polygon)), `hall label ${cell.apartment}`);
    }
  }
});

const screenshotGeneric = { ...generic, footprint: [[71.44, 51.13], [71.4406, 51.13], [71.4406, 51.130108], [71.44, 51.130108]] };
const cases = [sauran, generic, screenshotGeneric, { ...sauran, floor_plan: [1, 2, 3, 4, 5] }].flatMap(building => {
  const model = modelFor(building);
  return model.cells.filter(c => c.floor === 2).map(cell => ({ cell, plan: drawingPlan(cell, model.windows, cell.loggiaSides) }));
});

test('1-5 room halls stay within caps and every square metre belongs to floor or walls', () => {
  assert.deepEqual([...new Set(cases.map(({ cell }) => cell.rooms))].sort(), [1, 2, 3, 4, 5]);
  for (const { cell, plan } of cases) {
    const context = `flat ${cell.apartment}, ${cell.rooms} rooms, ${cell.area} m2`;
    assert.ok(plan.hallArea >= 4 - .05 && plan.hallArea <= (cell.rooms <= 3 ? 10 : 12) + .05, context);
    const gross = plan.hall.reduce((sum, p) => sum + polygonArea(p), 0) + plan.rooms.reduce((sum, r) => sum + polygonArea(r.polygon), 0);
    assert.ok(Math.abs(gross - cell.area) < .001, `no unallocated space: ${context}`);
    assert.ok(plan.wallArea > 0 && plan.wallArea < cell.area * .25, `wall allowance: ${context}`);
    assert.ok(Math.abs(plan.hallArea + plan.wallArea + plan.rooms.reduce((sum, r) => sum + r.area, 0) - cell.area) < .001, context);
    for (const room of plan.rooms) {
      assert.ok(room.area > .05 && Number.isFinite(room.area), `${context}: ${room.id}`);
      assert.ok(plan.hall.every(p => overlapArea(p, room.polygon) < 1e-6), `room outside circulation: ${context}`);
    }
    const entry = plan.doors.find(d => d.id === 'entrance');
    assert.ok(entry && inside(add(midpoint(entry.a, entry.b), entry.inward, .3), plan.hall[0]), `entrance reaches hall: ${context}`);
    for (const pane of plan.windows) {
      const room = plan.rooms.find(r => r.id === pane.room);
      const depth = Math.max(...room.polygon.map(p => (p[0] - pane.a[0]) * pane.inward[0] + (p[1] - pane.a[1]) * pane.inward[1]));
      assert.ok(depth <= 6.5 + .01, `window depth ${depth}: ${context}`);
    }
  }
});

test('every room is reachable from the entrance without crossing another bedroom', () => {
  for (const { cell, plan } of cases) {
    const graph = new Map([['hall', []], ...plan.rooms.map(r => [r.id, []])]);
    for (const door of plan.doors.filter(d => d.id !== 'entrance')) {
      assert.ok(graph.has(door.to), `known connection ${cell.apartment} ${door.room}`);
      graph.get(door.to).push(door.room); graph.get(door.room).push(door.to);
    }
    for (const target of plan.rooms) {
      const seen = new Set(['hall']), queue = ['hall'];
      while (queue.length) {
        const id = queue.shift();
        for (const next of graph.get(id)) {
          const room = plan.rooms.find(r => r.id === next);
          if (seen.has(next) || room?.kind === 'bedroom' && next !== target.id && next !== target.accessFrom) continue;
          seen.add(next); queue.push(next);
        }
      }
      assert.ok(seen.has(target.id), `reachable ${cell.apartment} ${target.id}`);
      if (target.kind === 'dressing' && plan.doors.some(d => d.room === target.id && d.to === target.accessFrom)) assert.equal(plan.rooms.find(r => r.id === target.accessFrom)?.kind, 'bedroom');
    }
  }
});

test('42, 43, 45 and the pictured generic four-room flat keep useful room sizes', () => {
  for (const building of [sauran, screenshotGeneric]) {
    const model = modelFor(building);
    for (const cell of model.cells.filter(c => building.id === 1 ? [42, 43, 45].includes(c.apartment) : c.apartment === 4)) {
      const plan = drawingPlan(cell, model.windows, cell.loggiaSides);
      for (const room of plan.rooms) {
        const range = { living: [16, 26], bedroom: [10, 18], kitchen: [9, 15.5], bath: [4, 6], storage: [2, 4] }[room.kind];
        if (range) assert.ok(room.area >= range[0] && room.area <= range[1], `${cell.apartment} ${room.name}: ${room.area}`);
      }
      if (cell.rooms >= 3) {
        assert.ok(plan.rooms.some(r => r.kind === 'wc'));
        const dressing = plan.rooms.find(r => r.kind === 'dressing');
        assert.ok(dressing && plan.doors.some(d => d.room === dressing.id && d.to === dressing.accessFrom), 'private dressing access');
      }
      assert.ok(plan.rooms.some(r => r.kind === 'storage') || plan.rooms.some(r => furnishing(r, plan.doors, plan.windows).some(f => f.kind === 'wardrobe')), 'storage room or built-in wardrobe');
      assert.ok(plan.rooms.filter(r => ['living', 'bedroom', 'kitchen'].includes(r.kind)).every(r => plan.doors.some(d => d.room === r.id && (d.to === 'hall' || !['bedroom', 'dressing', 'bath', 'wc'].includes(plan.rooms.find(n => n.id === d.to)?.kind)))), `circulation avoids private and wet rooms ${cell.apartment}`);
    }
  }
});

test('overlap checks include L-shaped entrance alcoves', () => {
  const room = [[0, 0], [4, 0], [4, 4], [3, 4], [3, 2], [0, 2]];
  assert.equal(overlapArea(room, [[0, 0], [4, 0], [4, 4], [0, 4]]), 10);
  assert.equal(overlapArea(room, [[0, 3], [2, 3], [2, 4], [0, 4]]), 0);
  assert.equal(overlapArea(room, [[3.2, 3], [3.8, 3], [3.8, 4], [3.2, 4]]).toFixed(2), '0.60');
});

test('concave room labels stay inside their own rooms when the bounding-box centre is outside', () => {
  const model = modelFor(sauran), cell = model.cells.find(c => c.apartment === 85);
  const plan = drawingPlan(cell, model.windows, cell.loggiaSides);
  for (const room of plan.rooms) {
    const label = roomLabel(room, furnishing(room, plan.doors, plan.windows), plan.doors, .46);
    assert.ok(inside(label.point, room.polygon), `${room.id} label in flat 85`);
  }
});

test('interior partitions follow the section axes and slants belong only to surveyed exterior walls', () => {
  for (const { cell, plan } of cases) {
    for (const polygon of [...plan.rooms.map(r => r.polygon), ...plan.hall]) polygon.forEach((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      if (Math.abs(a[0] - b[0]) < 1e-6 || Math.abs(a[1] - b[1]) < 1e-6) return;
      const exterior = plan.outline.some((p, j) => {
        const q = plan.outline[(j + 1) % plan.outline.length];
        return [a, b].every(v => inside(v, [p, q]));
      });
      assert.ok(exterior, `flat ${cell.apartment} diagonal interior partition ${a}/${b}`);
    });
  }
});
