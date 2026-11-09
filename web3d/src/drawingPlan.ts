import { localPoint, worldPoint, polygonArea, joinPolygons, joinPolygonParts, type ApartmentCell, type FacadeWindow, type Point } from './apartmentPlan';

export type PlanRoom = { id: string; name: string; kind: 'living' | 'bedroom' | 'kitchen' | 'bath' | 'wc' | 'hall' | 'storage' | 'dressing' | 'utility'; polygon: Point[]; area: number; combined?: boolean; origin: Point; tangent: Point; inward: Point; width: number; depth: number; accessFrom?: string };
export type PlanOpening = { id: string; room: string; a: Point; b: Point; inward: Point; to?: string; side?: 'courtyard' | 'street' };
export type DrawingPlan = { outline: Point[]; rooms: PlanRoom[]; windows: PlanOpening[]; doors: PlanOpening[]; balconies: { polygon: Point[]; door: PlanOpening }[]; width: number; height: number; hall: Point[][]; hallArea: number; wallArea: number; landing?: Point[] };
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
export const add = (p: Point, v: Point, n: number): Point => [p[0] + v[0] * n, p[1] + v[1] * n];
export const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function halfPlane(polygon: Point[], normal: Point, bound: number): Point[] {
  const result: Point[] = [];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length], a = dot(p, normal) - bound, b = dot(q, normal) - bound;
    if (a <= 1e-8) result.push(p);
    if ((a < 0 && b > 0) || (a > 0 && b < 0)) result.push([p[0] + (q[0] - p[0]) * a / (a - b), p[1] + (q[1] - p[1]) * a / (a - b)]);
  });
  return result.filter((p, i) => distance(p, result[(i + 1) % result.length]) > 1e-7);
}
export function inside(p: Point, polygon: Point[]) {
  let result = false;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  });
  return result || polygon.some((a, i) => {
    const b = polygon[(i + 1) % polygon.length], l = distance(a, b);
    return l > 0 && Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / l < 1e-6 && dot([p[0] - a[0], p[1] - a[1]], [p[0] - b[0], p[1] - b[1]]) <= 1e-6;
  });
}
export function intersection(a: Point[], b: Point[]): Point[] {
  const sign = b.reduce((sum, p, i) => { const q = b[(i + 1) % b.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
  return b.reduce((poly, p, i) => { const q = b[(i + 1) % b.length], normal: Point = [sign * (q[1] - p[1]), sign * (p[0] - q[0])]; return halfPlane(poly, normal, dot(p, normal)); }, a);
}
const rectangle = (x: number, y: number, w: number, h: number): Point[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

// Subtract a convex room from its convex allocation, retaining the service shelves.
function subtract(polygon: Point[], cut: Point[]): Point[][] {
  if (!cut.length) return [polygon];
  const sign = cut.reduce((sum, p, i) => { const q = cut[(i + 1) % cut.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
  const pieces: Point[][] = [];
  let remainder = polygon;
  cut.forEach((p, i) => {
    const q = cut[(i + 1) % cut.length], normal: Point = [sign * (q[1] - p[1]), sign * (p[0] - q[0])];
    const outside = halfPlane(remainder, [-normal[0], -normal[1]], -dot(p, normal));
    if (polygonArea(outside) > 1e-7) pieces.push(outside);
    remainder = halfPlane(remainder, normal, dot(p, normal));
  });
  return pieces;
}
// Offset each wall towards the clear floor. Unlike convex clipping, this keeps
// the entrance alcoves of L-shaped rooms instead of counting them as walls.
export function usableArea(polygon: Point[], outline: Point[]): number {
  const sign = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
  const lines = polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length], length = distance(a, b);
    const tangent: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    const inward: Point = [-sign * tangent[1], sign * tangent[0]];
    const centre = midpoint(a, b);
    const exterior = outline.some((p, j) => {
      const q = outline[(j + 1) % outline.length];
      return Math.abs((centre[0] - p[0]) * (q[1] - p[1]) - (centre[1] - p[1]) * (q[0] - p[0])) / distance(p, q) < 1e-6;
    });
    return { a: add(a, inward, exterior ? .125 : .05), tangent };
  });
  const floor = lines.map((line, i) => {
    const prev = lines[(i + lines.length - 1) % lines.length];
    const cross = prev.tangent[0] * line.tangent[1] - prev.tangent[1] * line.tangent[0];
    if (Math.abs(cross) < 1e-7) return line.a;
    const delta: Point = [line.a[0] - prev.a[0], line.a[1] - prev.a[1]];
    return add(prev.a, prev.tangent, (delta[0] * line.tangent[1] - delta[1] * line.tangent[0]) / cross);
  });
  return polygonArea(floor);
}

function mergeNiches(rooms: PlanRoom[], outline: Point[], hall: Point[], cap: number) {
  for (const room of [...rooms]) {
    if (!['utility', 'storage'].includes(room.kind) || room.area >= .25 && Math.min(room.width, room.depth) >= .8) continue;
    for (const other of rooms.filter(r => r !== room).sort((a, b) => Number(['living', 'bedroom', 'kitchen'].includes(a.kind)) - Number(['living', 'bedroom', 'kitchen'].includes(b.kind)))) {
      const polygon = joinPolygons([room.polygon, other.polygon]);
      if (Math.abs(polygonArea(polygon) - polygonArea(room.polygon) - polygonArea(other.polygon)) > 1e-6) continue;
      const x = Math.min(...polygon.map(p => p[0])), y = Math.min(...polygon.map(p => p[1]));
      if (['living', 'bedroom', 'kitchen'].includes(other.kind) && Math.max(...polygon.map(p => p[1])) - y > Math.max(6.4, other.depth) + 1e-7) continue;
      Object.assign(other, { polygon, area: usableArea(polygon, outline), origin: [x, y], width: Math.max(...polygon.map(p => p[0])) - x, depth: Math.max(...polygon.map(p => p[1])) - y });
      rooms.splice(rooms.indexOf(room), 1);
      break;
    }
    if (!rooms.includes(room)) continue;
    const polygon = joinPolygons([hall, room.polygon]);
    if (Math.abs(polygonArea(polygon) - polygonArea(hall) - polygonArea(room.polygon)) < 1e-6 && usableArea(polygon, outline) <= cap) {
      hall.splice(0, hall.length, ...polygon);
      rooms.splice(rooms.indexOf(room), 1);
    }
  }
}

// One-sided flats open their rooms onto a short internal passage. The end
// rooms wrap the passage ends, so a wide facade does not imply a huge hall.
function oneSidedPlan(cell: ApartmentCell, facade: FacadeWindow[], loggiaSides: ('courtyard' | 'street')[]): DrawingPlan {
  const local = cell.outline.map(p => localPoint(cell.section, p));
  const top = Math.max(...local.map(p => p[1]));
  const width = (cell.end - cell.start) * 2.5, height = (top - Math.min(...local.map(p => p[1]))) * 2.5;
  const entryLocal = localPoint(cell.section, cell.entry.point);
  const flip = (top - entryLocal[1]) * 2.5 < height / 2;
  const convert = (p: Point): Point => [(p[0] - cell.start) * 2.5, flip ? height - (top - p[1]) * 2.5 : (top - p[1]) * 2.5];
  const outline = local.map(convert), entry = convert(entryLocal);
  const panes = facade.filter(w => w.apartment === cell.apartment).map(w => ({ w, p: convert(localPoint(cell.section, [w.position[0], w.position[2]])) })).sort((a, b) => a.p[0] - b.p[0]);
  const cap = cell.rooms <= 3 ? 10 : 12;
  const compactFamily = cell.rooms >= 3 && outline.length === 4 && height <= 6.5;
  const endWidth = Math.min(3.65, width / 3);
  const boundaries = compactFamily ? [0, ...panes.slice(1).map((_, i) => endWidth + i * (width - 2 * endWidth) / (panes.length - 2)), width] : [0, ...panes.slice(1).map((p, i) => (p.p[0] + panes[i].p[0]) / 2 + (panes.length === 2 ? .55 : panes.length === 3 && i === 0 ? .37 : 0)), width];
  const bentFacade = cell.rooms === 3 && height > 6.5 && !inside([width - .5, entry[1] - .6], outline);
  const hallDepth = Math.min(width < 7 ? 1.35 : bentFacade ? 1.22 : 1.2, height * .27), hallWidth = Math.min(width, cap / (hallDepth - .1) + .1, Math.max(4.3, width * .66, boundaries[boundaries.length - 2] - boundaries[1] + 1.8));
  const hx = Math.max(0, boundaries[boundaries.length - 2] + .9 - hallWidth, Math.min(width - hallWidth, boundaries[1] - .9, entry[0] - hallWidth / 2 - Math.min(.5, width * .03))), north = entry[1] - hallDepth;
  const hallPolygon = intersection(outline, rectangle(hx, north, hallWidth, hallDepth));
  const rooms: PlanRoom[] = [], windows: PlanOpening[] = [], doors: PlanOpening[] = [];
  const makeRoom = (id: string, kind: PlanRoom['kind'], name: string, polygon: Point[]): PlanRoom => {
    const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { id, kind, name, polygon, area: usableArea(polygon, outline), origin: [x, y], tangent: [1, 0], inward: [0, 1], width: Math.max(...xs) - x, depth: Math.max(...ys) - y };
  };
  const rearPocket = intersection(outline, rectangle(hx, entry[1], hallWidth, height - entry[1]));
  if (polygonArea(rearPocket) > .1) rooms.push(makeRoom('rear-storage', 'storage', 'Storage', rearPocket));
  const rear = boundaries;
  let bedroom = 0;
  panes.forEach((pane, i) => {
    const first = i === 0, last = i === panes.length - 1;
    let polygon = joinPolygons([
      intersection(outline, rectangle(boundaries[i], 0, boundaries[i + 1] - boundaries[i], north)),
      ...(first ? [intersection(outline, rectangle(0, north, hx, height - north))] : []),
      ...(last ? [intersection(outline, rectangle(hx + hallWidth, north, width - hx - hallWidth, height - north))] : []),
    ]);
    // At a deep L corner the shared living room connects the far bedroom.
    const kind: PlanRoom['kind'] = (bentFacade ? i === 2 : first) ? 'living' : (cell.rooms >= 3 || width < 6 && cell.rooms >= 2 ? i === 1 : last) ? 'kitchen' : 'bedroom';
    const bedroomNumber = kind === 'bedroom' ? cell.rooms >= 3 ? last ? 1 : ++bedroom + 1 : ++bedroom : 0;
    const id = kind === 'bedroom' ? `bedroom-${bedroomNumber}` : kind;
    const retainRoom = (pieces: Point[][]) => {
      const parts = joinPolygonParts(pieces);
      const main = parts.find(p => inside(pane.p, p)) ?? parts.sort((a, b) => polygonArea(b) - polygonArea(a))[0] ?? [];
      parts.filter(p => p !== main).forEach((p, n) => rooms.push(makeRoom(`niche-${i}-${rooms.length}-${n}`, 'utility', 'Closet', p)));
      return main;
    };
    // Wet rooms occupy a rear corner beside the entrance, with an alcove
    // maintaining the windowed room's direct connection to the hall.
    const middleService = panes.length >= 3 && !compactFamily;
    const serviceLeft = width < 6 || !inside([width - .5, height - .5], outline);
    if ((compactFamily ? last : middleService ? i === (cell.rooms === 2 && !flip ? panes.length - 1 : 1) : serviceLeft ? first : last) && north > 2.2) {
      const bx = middleService ? boundaries[i] : serviceLeft && !compactFamily ? 0 : Math.min(hx + hallWidth, width - 1.15), serviceWidth = middleService ? Math.min(2.6, boundaries[i + 1] - bx - .95) : serviceLeft && !compactFamily ? Math.min(2.6, width * .4, height - entry[1] > .2 ? hx : Infinity) : width - bx;
      const serviceDepth = compactFamily ? 2.2 : Math.min(height - 2, Math.max(cell.rooms >= 3 ? 2.5 : 2.2, 5.5 / Math.max(1.4, Math.min(2.6, serviceWidth))));
      const serviceCut = rectangle(bx, (middleService || width < 6 && height > 6.5 ? north : height) - serviceDepth, serviceWidth, serviceDepth);
      const service = intersection(polygon, serviceCut);
      if (polygonArea(service) > 1.5) {
        const bathWidth = cell.rooms >= 3 && serviceWidth > 2.8 ? 2.1 : 2.6;
        const bathPolygon = halfPlane(service, [1, 0], bx + bathWidth);
        rooms.push({ ...makeRoom('bath', 'bath', 'Bathroom', bathPolygon), combined: true });
        const extra = halfPlane(service, [-1, 0], -(bx + bathWidth));
        const separateWC = cell.rooms >= 3 && usableArea(extra, outline) > .85;
        if (polygonArea(extra) > .1) rooms.push(makeRoom(separateWC ? 'wc' : 'storage', separateWC ? 'wc' : 'storage', separateWC ? 'WC' : 'Storage', extra));
        if (separateWC) rooms.find(r => r.id === 'bath')!.combined = false;
        polygon = retainRoom(subtract(polygon, serviceCut));
      }
    }
    if (height <= 6.5 && last && kind === 'bedroom' && cell.rooms >= 3 && usableArea(polygon, outline) > 11.8) {
      const shelfWidth = compactFamily ? rear[i + 1] - rear[i] - 1 : Math.min(1.4, Math.max(.8, rear[i + 1] - rear[i] - 1));
      const cut = rectangle(rear[i] + 1, north - (compactFamily ? 2.05 : 1.1), shelfWidth, 1.1);
      const dressing = intersection(polygon, cut);
      if (usableArea(dressing, outline) > .6) {
        rooms.push({ ...makeRoom('dressing', 'dressing', 'Dressing', dressing), accessFrom: id });
        polygon = retainRoom(subtract(polygon, cut));
      }
    }
    if (compactFamily && first) {
      const cut = rectangle(0, height - 2, 1.1, 2);
      const wc = intersection(polygon, cut);
      if (usableArea(wc, outline) > 1.2) {
        rooms.push(makeRoom('wc', 'wc', 'WC', wc));
        polygon = retainRoom(subtract(polygon, cut));
      }
    }
    if (height > 6.5) {
      const windowRoom = halfPlane(polygon, [0, 1], 6.4);
      const service = halfPlane(polygon, [0, -1], -6.4);
      if (polygonArea(service) > .1) rooms.push(makeRoom(`utility-${i}`, 'utility', 'Storage', service));
      polygon = windowRoom;
    }
    const maxArea = kind === 'living' ? 25 : kind === 'kitchen' ? 15 : 18;
    if (usableArea(polygon, outline) > maxArea + .2) {
      let lo = .6, hi = Math.max(...polygon.map(p => p[1]));
      for (let j = 0; j < 32; j++) {
        const y = (lo + hi) / 2;
        if (usableArea(halfPlane(polygon, [0, 1], y), outline) > maxArea) hi = y; else lo = y;
      }
      const useful = halfPlane(polygon, [0, 1], hi), extra = halfPlane(polygon, [0, -1], -hi);
      const storage = rooms.some(r => r.kind === 'storage') ? 'utility' : 'storage';
      if (usableArea(extra, outline) > .3) {
        rooms.push(makeRoom(`extra-${i}`, storage, storage === 'storage' ? 'Storage' : usableArea(extra, outline) < 6 ? 'Pantry' : 'Study', extra));
        polygon = useful;
      }
    }
    rooms.push(makeRoom(id, kind, kind === 'living' ? 'Living room' : kind === 'kitchen' ? 'Kitchen' : `Bedroom ${bedroomNumber}`, polygon));
    const a = local.map(convert);
    const edge = a.map((p, j) => ({ a: p, b: a[(j + 1) % a.length] })).find(e => inside(pane.p, [e.a, e.b]))!;
    const length = distance(edge.a, edge.b), tangent: Point = [(edge.b[0] - edge.a[0]) / length, (edge.b[1] - edge.a[1]) / length];
    let inward: Point = [-tangent[1], tangent[0]];
    if (!inside(add(pane.p, inward, .02), outline)) inward = [-inward[0], -inward[1]];
    const span = (pane.w.width ?? .48) * 2.5;
    windows.push({ id: pane.w.id, room: id, a: add(pane.p, tangent, -span / 2), b: add(pane.p, tangent, span / 2), inward, side: pane.w.side });
  });
  if (rooms.some(r => r.kind === 'wc')) { const bath = rooms.find(r => r.kind === 'bath'); if (bath) bath.combined = false; }
  for (const room of [...rooms].filter(r => r.kind === 'storage')) {
    if (room.area < 2) { room.kind = 'utility'; room.name = 'Closet'; continue; }
    if (room.area <= 4) continue;
    let lo = Math.min(...room.polygon.map(p => p[0])), hi = Math.max(...room.polygon.map(p => p[0]));
    for (let j = 0; j < 32; j++) {
      const x = (lo + hi) / 2;
      if (usableArea(halfPlane(room.polygon, [1, 0], x), outline) > 3.2) hi = x; else lo = x;
    }
    const pantry = halfPlane(room.polygon, [-1, 0], -hi);
    Object.assign(room, makeRoom(room.id, 'storage', 'Storage', halfPlane(room.polygon, [1, 0], hi)));
    if (usableArea(pantry, outline) > .2) rooms.push(makeRoom(`${room.id}-pantry`, 'utility', 'Pantry', pantry));
  }
  mergeNiches(rooms, outline, hallPolygon, cap);
  const neighbours = [{ id: 'hall', polygon: hallPolygon }];
  const priority = (r: PlanRoom) => ['living', 'kitchen', 'bedroom', 'utility', 'storage', 'dressing', 'bath', 'wc'].indexOf(r.kind);
  let remaining = [...rooms].sort((a, b) => priority(a) - priority(b));
  for (let pass = 0; pass < rooms.length; pass++) remaining = remaining.filter(room => {
    const candidates: PlanOpening[] = [];
    room.polygon.forEach((a, i) => {
      const b = room.polygon[(i + 1) % room.polygon.length], length = distance(a, b);
      if (length < .8) return;
      const tangent: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      let inward: Point = [-tangent[1], tangent[0]];
      if (!inside(add(midpoint(a, b), inward, .02), room.polygon)) inward = [-inward[0], -inward[1]];
      for (let offset = .1; offset + .65 < length - .09; offset += .1) {
        const p = add(a, tangent, offset), q = add(p, tangent, .65);
        const target = neighbours.filter(n => room.accessFrom ? n.id === room.accessFrom : n.id === 'hall' || !['bedroom', 'dressing', ...(['living', 'bedroom', 'kitchen'].includes(room.kind) ? ['bath', 'wc'] : [])].includes(rooms.find(r => r.id === n.id)?.kind ?? '')).find(n => [.1, .5, .9].every(t => inside(add(add(p, tangent, .65 * t), inward, -.36), n.polygon)));
        if (target) for (const [hinge, latch] of [[p, q], [q, p]]) candidates.push({ id: `door-${room.id}`, room: room.id, to: target.id, a: hinge, b: latch, inward });
      }
    });
    const score = (d: PlanOpening) => Number(d.to === room.accessFrom) * 200 + Number(d.to === 'hall') * 100 - Number(['bath', 'wc'].includes(rooms.find(r => r.id === d.to)?.kind ?? '')) * 50 + (['bath', 'wc'].includes(room.kind) ? furnishing(room, [d], []).length * 10 : 0);
    const door = candidates.sort((a, b) => score(b) - score(a))[0];
    if (!door) return true;
    doors.push(door);
    neighbours.push(room);
    return false;
  });
  doors.push({ id: 'entrance', room: 'hall', a: [entry[0] - .425, entry[1]], b: [entry[0] + .425, entry[1]], inward: [0, -1] });
  const landing = rectangle(entry[0] - 1.1, entry[1] + .14, 2.2, 1.05);
  const hallArea = usableArea(hallPolygon, outline);
  const result: DrawingPlan = { outline, rooms, windows, doors, balconies: [], width, height, hall: [hallPolygon], hallArea, wallArea: polygonArea(outline) - hallArea - rooms.reduce((s, r) => s + r.area, 0), landing };
  for (const side of loggiaSides) {
    const pane = windows.find(w => w.side === side);
    if (pane) result.balconies.push({ polygon: [pane.a, pane.b, add(pane.b, pane.inward, -.75), add(pane.a, pane.inward, -.75)], door: { ...pane, id: `balcony-${side}` } });
  }
  if (flip) {
    const reflect = (p: Point): Point => [p[0], height - p[1]];
    result.outline = result.outline.map(reflect); result.hall = result.hall.map(p => p.map(reflect)); result.landing = landing.map(reflect);
    result.rooms = rooms.map(r => ({ ...r, polygon: r.polygon.map(reflect), origin: reflect(r.origin), inward: [0, -1] }));
    const opening = (d: PlanOpening): PlanOpening => ({ ...d, a: reflect(d.a), b: reflect(d.b), inward: [d.inward[0], -d.inward[1]] });
    result.windows = windows.map(opening); result.doors = doors.map(opening); result.balconies = result.balconies.map(b => ({ polygon: b.polygon.map(reflect), door: opening(b.door) }));
  }
  return result;
}

// Metres throughout, using the same 2.5 m per scene unit as the building model.
export function drawingPlan(cell: ApartmentCell, facade: FacadeWindow[], loggiaSides: ('courtyard' | 'street')[] = []): DrawingPlan {
  const direction = localPoint({ ...cell.section, position: [0, 0, 0] }, cell.entry.inward);
  const shape = cell.outline.map(p => localPoint(cell.section, p));
  const ownedPanes = facade.filter(w => w.apartment === cell.apartment).map(w => localPoint(cell.section, [w.position[0], w.position[2]]));
  if (Math.max(...ownedPanes.map(p => p[0])) - Math.min(...ownedPanes.map(p => p[0])) < .01) {
    const section = { ...cell.section, rotation: cell.section.rotation + Math.PI / 2 };
    const turned = cell.outline.map(p => localPoint(section, p));
    const result = drawingPlan({ ...cell, section, start: Math.min(...turned.map(p => p[0])), end: Math.max(...turned.map(p => p[0])) }, facade, loggiaSides);
    const width = (cell.end - cell.start) * 2.5, flip = ([x, y]: Point): Point => [width - y, x];
    const vector = ([x, y]: Point): Point => [-y, x];
    const opening = (d: PlanOpening): PlanOpening => ({ ...d, a: flip(d.a), b: flip(d.b), inward: vector(d.inward) });
    return { ...result, width, height: result.width, outline: result.outline.map(flip), hall: result.hall.map(p => p.map(flip)), landing: result.landing?.map(flip), rooms: result.rooms.map(r => ({ ...r, polygon: r.polygon.map(flip), origin: flip(r.origin), tangent: vector(r.tangent), inward: vector(r.inward) })), windows: result.windows.map(opening), doors: result.doors.map(opening), balconies: result.balconies.map(b => ({ polygon: b.polygon.map(flip), door: opening(b.door) })) };
  }
  const rearY = direction[1] > 0 ? Math.min(...shape.map(p => p[1])) + .1 : Math.max(...shape.map(p => p[1])) - .1;
  const mirrorBay = Math.abs(direction[1]) > .7 && !inside([cell.start + .1, rearY], shape) && inside([cell.end - .1, rearY], shape);
  if (direction[0] > .7 || mirrorBay) {
    const reflect = (p: Point): Point => { const q = localPoint(cell.section, p); return worldPoint(cell.section, [cell.start + cell.end - q[0], q[1]]); };
    const vector = (p: Point): Point => { const q = localPoint({ ...cell.section, position: [0, 0, 0] }, p); return worldPoint({ ...cell.section, position: [0, 0, 0] }, [-q[0], q[1]]); };
    const mirrored = { ...cell, outline: cell.outline.map(reflect), entry: { point: reflect(cell.entry.point), inward: vector(cell.entry.inward) } };
    const panes = facade.filter(w => w.apartment === cell.apartment).map(w => { const p = reflect([w.position[0], w.position[2]]), n = vector([Math.sin(w.rotation), Math.cos(w.rotation)]); return { ...w, position: [p[0], w.position[1], p[1]] as [number, number, number], rotation: Math.atan2(n[0], n[1]) }; });
    const result = drawingPlan(mirrored, panes, loggiaSides), flip = ([x, y]: Point): Point => [result.width - x, y];
    const opening = (d: PlanOpening): PlanOpening => ({ ...d, a: flip(d.a), b: flip(d.b), inward: [-d.inward[0], d.inward[1]] });
    return { ...result, outline: result.outline.map(flip), hall: result.hall.map(p => p.map(flip)), landing: result.landing?.map(flip), rooms: result.rooms.map(r => ({ ...r, polygon: r.polygon.map(flip), origin: flip(r.origin), tangent: [-r.tangent[0], r.tangent[1]], inward: [-r.inward[0], r.inward[1]] })), windows: result.windows.map(opening), doors: result.doors.map(opening), balconies: result.balconies.map(b => ({ polygon: b.polygon.map(flip), door: opening(b.door) })) };
  }
  if (Math.abs(direction[1]) > .7) return oneSidedPlan(cell, facade, loggiaSides);
  const local = cell.outline.map(p => localPoint(cell.section, p));
  const top = Math.max(...local.map(p => p[1]));
  const convert = (p: Point): Point => [(p[0] - cell.start) * 2.5, (top - p[1]) * 2.5];
  const outline = local.map(convert), width = (cell.end - cell.start) * 2.5, height = Math.max(...outline.map(p => p[1]));
  const edges = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length], length = distance(a, b), tangent: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    let inward: Point = [-tangent[1], tangent[0]];
    if (!inside(add(midpoint(a, b), inward, .02), outline)) inward = [-inward[0], -inward[1]];
    return { a, b, length, tangent, inward };
  });
  const panes = facade.filter(w => w.apartment === cell.apartment).map(w => {
    const p = convert(localPoint(cell.section, [w.position[0], w.position[2]]));
    const edge = edges.find(e => inside(p, [e.a, e.b]))!;
    return { w, p, edge };
  }).sort((a, b) => (a.w.side === b.w.side ? a.p[0] - b.p[0] || a.p[1] - b.p[1] : a.w.side === 'courtyard' ? -1 : 1));
  const entryRight = localPoint(cell.section, cell.entry.point)[0] > (cell.start + cell.end) / 2;
  // A transverse 1.3 m passage connects the windowed rooms. Its far end is
  // an entrance to a useful room, rather than an unused strip across the flat.
  const cap = cell.rooms <= 3 ? 10 : 12;
  const corridorWidth = Math.max(1.3, 4.6 / Math.max(1, width - .25));
  const cy = convert(localPoint(cell.section, cell.entry.point))[1];
  const north = cy - corridorWidth / 2, south = cy + corridorWidth / 2;
  const rowEnds = [true, false].flatMap(upper => {
    const row = panes.filter(p => (p.p[1] < cy) === upper).sort((a, b) => a.p[0] - b.p[0]);
    if (row.length < 2) return [];
    return [entryRight ? (row[0].p[0] + row[1].p[0]) / 2 : (row[row.length - 2].p[0] + row[row.length - 1].p[0]) / 2];
  });
  const reach = rowEnds.length ? entryRight ? width - Math.min(...rowEnds) + 2.1 : Math.max(...rowEnds) + 2.1 : 0;
  let hallLength = Math.min(width, cap / (corridorWidth - .1) + .1, Math.max(reach, 4.3 / (corridorWidth - .1) + .175));
  if (width - hallLength < .85 && usableArea(intersection(outline, rectangle(0, north, width, corridorWidth)), outline) <= cap) hallLength = width;
  const hx = entryRight ? width - hallLength : 0;
  const hallPolygon = intersection(outline, rectangle(hx, north, hallLength, corridorWidth));
  const hall = [hallPolygon];
  const rooms: PlanRoom[] = [], windows: PlanOpening[] = [], doors: PlanOpening[] = [];
  const makeRoom = (id: string, kind: PlanRoom['kind'], name: string, polygon: Point[]): PlanRoom => {
    const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { id, kind, name, polygon, area: usableArea(polygon, outline), origin: [x, y], tangent: [1, 0], inward: [0, 1], width: Math.max(...xs) - x, depth: Math.max(...ys) - y };
  };
  const courtyard = panes.filter(p => p.w.side === 'courtyard');
  const sameFacade = panes.every(p => Math.abs(p.edge.inward[1] - panes[0].edge.inward[1]) < .01);
  const livingPane = sameFacade && cell.rooms >= 4 ? panes[Math.floor(panes.length / 2)] : [...courtyard].sort((a, b) => a.p[1] - b.p[1] || a.p[0] - b.p[0])[0] ?? panes[0];
  const kitchenPane = [...panes].reverse().find(p => p !== livingPane && p.w.side === 'street') ?? [...panes].reverse().find(p => p !== livingPane)!;
  const allocations: { pane: typeof panes[number]; kind: PlanRoom['kind']; name: string; id: string; zone: Point[]; upper: boolean; left: number; right: number; reserve: number }[] = [];
  const shelves: { polygon: Point[]; owner?: string; dressing?: boolean; utilityOnly?: boolean }[] = [];
  const division = (a: typeof panes[number], b: typeof panes[number]) => Math.min(b.p[0] - (b.w.width ?? .48) * 1.25 - .08, Math.max(a.p[0] + (a.w.width ?? .48) * 1.25 + .08, (a.p[0] + b.p[0]) / 2 + (a === livingPane ? .55 : b === livingPane ? -.55 : 0)));
  for (const upper of [true, false]) {
    const row = panes.filter(p => (p.p[1] < cy) === upper).sort((a, b) => a.p[0] - b.p[0]);
    if (!row.length) {
      shelves.push({ polygon: intersection(outline, rectangle(0, upper ? 0 : south, width, upper ? north : height - south)) });
      continue;
    }
    row.forEach((pane, index) => {
      // Side-wall windows need enough width for a bed, even beside a street window.
      const left = index ? Math.max(division(row[index - 1], pane), Math.abs(row[index - 1].edge.inward[0]) > .7 ? 2 : 0) : 0;
      const right = index + 1 < row.length ? Math.max(division(pane, row[index + 1]), Math.abs(pane.edge.inward[0]) > .7 ? 2 : 0) : width;
      const kind = pane === livingPane ? 'living' : pane === kitchenPane ? 'kitchen' : 'bedroom';
      const name = kind === 'living' ? 'Living room' : kind === 'kitchen' ? 'Kitchen' : 'Bedroom';
      const zone = intersection(outline, rectangle(left, upper ? 0 : south, right - left, upper ? north : height - south));
      const target = kind === 'living' ? 27.5 : kind === 'kitchen' ? 16.5 : cell.rooms >= 4 ? 19 : 18;
      allocations.push({ pane, kind, name, id: `room-${panes.indexOf(pane)}`, zone, upper, left, right, reserve: Math.max(0, polygonArea(zone) - target) });
    });
  }
  const bedrooms = allocations.filter(a => a.kind === 'bedroom').sort((a, b) => polygonArea(b.zone) - polygonArea(a.zone));
  bedrooms.forEach((a, i) => { a.name = `Bedroom ${i + 1}`; });
  const mainBedroom = bedrooms[0];
  if (cell.rooms >= 3 && mainBedroom && polygonArea(mainBedroom.zone) > 15.5 && mainBedroom.right - mainBedroom.left > 2.1) mainBedroom.reserve = Math.max(mainBedroom.reserve, 3.8);
  // Reserve useful rooms before distributing the rest to living and kitchen.
  const serviceTarget = cell.area < 35 ? 4.5 : cell.area < 48 ? 6 : cell.rooms >= 3 ? 15.3 : 10;
  let missing = serviceTarget - allocations.reduce((sum, a) => sum + a.reserve, 0) - shelves.reduce((sum, shelf) => sum + polygonArea(shelf.polygon), 0);
  for (const a of [...allocations].sort((a, b) => ['kitchen', 'living', 'bedroom'].indexOf(a.kind) - ['kitchen', 'living', 'bedroom'].indexOf(b.kind))) {
    if (missing <= 0) break;
    if (Math.abs(a.pane.edge.inward[0]) > .7 || a.right - a.left < 1.65) continue;
    const minimum = a.kind === 'kitchen' ? (cell.area < 35 ? 8 : 10.5) : a.kind === 'living' ? Math.min(cell.area >= 60 ? 18.3 : 17, polygonArea(a.zone) * (cell.area >= 60 ? .9 : .7)) : Math.min(11.5, polygonArea(a.zone) * .85);
    const extra = Math.max(0, Math.min(missing, polygonArea(a.zone) - a.reserve - minimum, a.kind === 'kitchen' ? Math.max(0, 8.4 - a.reserve) : Infinity));
    a.reserve += extra; missing -= extra;
  }
  for (const a of allocations) {
    const { pane, kind, name, id, zone, upper, left, right } = a;
    const depth = upper ? north : height - south;
    let polygon = zone;
    let shelf: Point[] = [];
    if (Math.abs(pane.edge.inward[0]) > .7) {
      // A corner room's depth is perpendicular to its end-wall window.
      const d = Math.min(6.4, (kind === 'living' ? 27.5 : 19) / depth);
      const axis: Point = [Math.sign(pane.edge.inward[0]), 0];
      polygon = halfPlane(zone, axis, dot(pane.edge.a, axis) + d);
      subtract(zone, polygon).forEach(p => shelves.push({ polygon: p }));
    } else {
      const overlap = Math.min(right, hx + hallLength) - Math.max(left, hx);
      const alcove = Math.min(1.25, Math.max(1, overlap - .05), (right - left) * .45);
      const facadeMin = Math.max(left, Math.min(pane.edge.a[0], pane.edge.b[0])), facadeMax = Math.min(right, Math.max(pane.edge.a[0], pane.edge.b[0]));
      const shelfWidth = Math.max(.5, facadeMax - facadeMin - alcove);
      const serviceDepth = a.reserve < 1.5 ? 0 : Math.min(depth - 2.3, a.reserve / shelfWidth);
      const roomDepth = depth - serviceDepth;
      if (serviceDepth > .1) {
        const shelfX = entryRight ? facadeMin : facadeMin + alcove;
        const cut = rectangle(shelfX, upper ? roomDepth : south, shelfWidth, serviceDepth);
        shelf = intersection(zone, cut);
        const parts = joinPolygonParts(subtract(zone, cut));
        polygon = parts.find(p => inside(pane.p, p)) ?? [];
        parts.filter(p => p !== polygon).forEach(p => {
          const piece = halfPlane(p, upper ? [0, 1] : [0, -1], upper ? 6.45 : -(height - 6.45));
          if (polygonArea(piece) > .01) shelves.push({ polygon: piece });
        });
      }
      // A very deep model cell uses service rooms to reach its windowed rooms.
      if (depth > 6.45) {
        const clipped = halfPlane(polygon, upper ? [0, 1] : [0, -1], upper ? 6.45 : -(height - 6.45));
        const beyond = intersection(zone, rectangle(left, upper ? 6.45 : south, right - left, depth - 6.45));
        polygon = clipped;
        const retained = halfPlane(shelf, upper ? [0, 1] : [0, -1], upper ? 6.45 : -(height - 6.45));
        shelf = joinPolygons([retained, beyond]);
      }
      if (shelf.length && polygonArea(shelf) > .01) shelves.push({ polygon: shelf, owner: id, dressing: kind === 'bedroom' && name === 'Bedroom 1' && cell.rooms >= 3 && right - left >= 2.1 });
    }
    rooms.push(makeRoom(id, kind, name, polygon));
    const paneWidth = (pane.w.width ?? .48) * 2.5;
    windows.push({ id: pane.w.id, room: id, a: add(pane.p, pane.edge.tangent, -paneWidth / 2), b: add(pane.p, pane.edge.tangent, paneWidth / 2), inward: pane.edge.inward, side: pane.w.side });
  }
  if (hallLength < width) shelves.push({ polygon: intersection(outline, rectangle(entryRight ? 0 : hallLength, north, width - hallLength, corridorWidth)), utilityOnly: true });

  // Deep internal shelves get a normal wet-room depth. Their remaining area
  // becomes a pantry or utility room, instead of an elongated bathroom or WC.
  for (const shelf of [...shelves]) {
    if (shelf.dressing) continue;
    const ys = shelf.polygon.map(p => p[1]), xs = shelf.polygon.map(p => p[0]);
    const min = Math.min(...ys), max = Math.max(...ys);
    if (max - min <= 3.3 || Math.max(...xs) - Math.min(...xs) < 1.8) continue;
    const upper = (min + max) / 2 < cy;
    const cut = upper ? max - 2.4 : min + 2.4;
    const inner = halfPlane(shelf.polygon, upper ? [0, -1] : [0, 1], upper ? -cut : cut);
    const outer = halfPlane(shelf.polygon, upper ? [0, 1] : [0, -1], upper ? cut : -cut);
    shelf.polygon = inner;
    if (polygonArea(outer) > .1) shelves.push({ polygon: outer, utilityOnly: true });
  }

  let bath = false, wc = false, storage = false, dressing = false, utility = 0;
  const pending = shelves.filter(s => polygonArea(s.polygon) > 1e-7).sort((a, b) => Number(!!a.utilityOnly) - Number(!!b.utilityOnly) || Number(!!a.dressing) - Number(!!b.dressing) || polygonArea(b.polygon) - polygonArea(a.polygon));
  for (const shelf of pending) {
    let polygon = shelf.polygon;
    const minX = Math.min(...polygon.map(p => p[0])), maxX = Math.max(...polygon.map(p => p[0]));
    const minY = Math.min(...polygon.map(p => p[1])), maxY = Math.max(...polygon.map(p => p[1]));
    // Cuts perpendicular to circulation give each service room its own door.
    const normal: Point = [1, 0];
    while (polygonArea(polygon) > 1e-7) {
      const area = polygonArea(polygon);
      const kind: PlanRoom['kind'] = shelf.utilityOnly ? 'utility' : shelf.dressing && !dressing ? 'dressing' : !bath ? 'bath' : !wc ? 'wc' : !storage ? 'storage' : 'utility';
      const depth = maxY - minY;
      const target = kind === 'bath' ? Math.max(cell.area < 40 ? 3.4 : 5, depth * 1.55) : kind === 'wc' ? Math.max(1.9, depth * .95) : kind === 'dressing' || kind === 'storage' ? 3.5 : 8;
      const split = area > target + Math.max(1.4, depth * .75) && maxX - minX > 1.7;
      let piece = polygon;
      if (split) {
        let lo = minX, hi = maxX;
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2;
          if (polygonArea(halfPlane(polygon, normal, mid)) > target) hi = mid; else lo = mid;
        }
        piece = halfPlane(polygon, normal, hi);
        polygon = halfPlane(polygon, [-1, 0], -hi);
      } else polygon = [];
      const name = kind === 'bath' ? 'Bathroom' : kind === 'wc' ? 'WC' : kind === 'dressing' ? 'Dressing' : kind === 'storage' ? 'Storage' : (['Laundry', 'Pantry', 'Study'][utility++] ?? `Utility ${utility}`);
      const id = kind === 'utility' ? `utility-${utility}` : kind;
      const room = makeRoom(id, kind, name, piece);
      if (kind === 'dressing') room.accessFrom = shelf.owner;
      rooms.push(room);
      bath ||= kind === 'bath'; wc ||= kind === 'wc'; storage ||= kind === 'storage'; dressing ||= kind === 'dressing';
    }
  }

  const smallBath = rooms.find(r => r.kind === 'bath' && r.area < 3.2);
  const wetSpace = smallBath && rooms.find(r => ['utility', 'storage', 'dressing'].includes(r.kind) && r.area >= 3.5 && Math.min(r.width, r.depth) >= 1.1);
  if (smallBath && wetSpace) {
    smallBath.kind = 'utility'; smallBath.name = 'Closet';
    wetSpace.kind = 'bath'; wetSpace.name = 'Bathroom'; delete wetSpace.accessFrom;
  }
  const compactStorage = rooms.find(r => r.kind === 'storage' && r.area < 2);
  if (compactStorage) { compactStorage.kind = 'utility'; compactStorage.name = 'Closet'; }
  if (!rooms.some(r => r.kind === 'storage')) {
    const niche = rooms.find(r => r.kind === 'utility' && r.area >= 2 && r.area <= 4);
    if (niche) { niche.kind = 'storage'; niche.name = 'Storage'; }
  }
  const tinyWC = rooms.find(r => r.kind === 'wc' && r.area < 1.2);
  if (tinyWC) { tinyWC.kind = 'utility'; tinyWC.name = 'Closet'; }
  if (!rooms.some(r => r.kind === 'wc')) { const bathroom = rooms.find(r => r.kind === 'bath'); if (bathroom) bathroom.combined = true; }
  mergeNiches(rooms, outline, hallPolygon, cap);

  const sharedDoor = (room: PlanRoom, neighbours: { id: string; polygon: Point[] }[]): PlanOpening | undefined => {
    const candidates: (PlanOpening & { score: number })[] = [];
    room.polygon.forEach((a, i) => {
      const b = room.polygon[(i + 1) % room.polygon.length], length = distance(a, b);
      if (length < .65) return;
      const tangent: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      let inward: Point = [-tangent[1], tangent[0]];
      if (!inside(add(midpoint(a, b), inward, .02), room.polygon)) inward = [-inward[0], -inward[1]];
      const size = Math.min(['living', 'bedroom', 'kitchen'].includes(room.kind) ? .8 : .65, length - .16);
      for (let offset = .08; offset + size < length - .07; offset += .1) {
        const p = add(a, tangent, offset), q = add(p, tangent, size);
        const neighbour = neighbours.find(n => [.1, .5, .9].every(t => inside(add(add(p, tangent, size * t), inward, -.12), n.polygon)));
        if (!neighbour) continue;
        for (const [hinge, latch] of [[p, q], [q, p]]) {
          const door = { id: `door-${room.id}`, room: room.id, to: neighbour.id, a: hinge, b: latch, inward };
          const fixtures = ['bath', 'wc', 'storage', 'dressing'].includes(room.kind) ? furnishing(room, [door], []).length : 0;
          candidates.push({ ...door, score: (neighbour.id === room.accessFrom ? 200 : neighbour.id === 'hall' ? 100 : 0) + fixtures * 10 + length - offset * .01 });
        }
      }
    });
    return candidates.sort((a, b) => b.score - a.score)[0];
  };
  // Hall first, then non-bedroom service connections; dressing is the one
  // intentional bedroom connection. This also handles corner service shelves.
  const connected = [{ id: 'hall', polygon: hallPolygon }];
  let remaining = [...rooms];
  for (let pass = 0; pass < rooms.length && remaining.length; pass++) {
    remaining = remaining.filter(room => {
      const neighbours = room.accessFrom ? [...connected.filter(n => n.id === room.accessFrom), ...connected.filter(n => n.id === 'hall')] : connected.filter(n => n.id === 'hall' || !['bedroom', 'dressing'].includes(rooms.find(r => r.id === n.id)?.kind ?? ''));
      const door = sharedDoor(room, neighbours);
      if (!door) return true;
      doors.push(door); connected.push(room); return false;
    });
  }
  for (const room of rooms.filter(r => r.accessFrom)) {
    const owner = rooms.find(r => r.id === room.accessFrom);
    const door = owner && sharedDoor(room, [owner]);
    const existing = doors.findIndex(d => d.room === room.id);
    if (door && existing >= 0) doors[existing] = door;
  }
  const entryCentre = convert(localPoint(cell.section, cell.entry.point));
  const entryLocal = localPoint({ ...cell.section, position: [0, 0, 0] }, cell.entry.inward);
  const entryInward: Point = [entryLocal[0], -entryLocal[1]], entryTangent: Point = [-entryInward[1], entryInward[0]];
  doors.push({ id: 'entrance', room: 'hall', a: add(entryCentre, entryTangent, -.425), b: add(entryCentre, entryTangent, .425), inward: entryInward });
  const balconies: DrawingPlan['balconies'] = [];
  loggiaSides.forEach(side => {
    const window = windows.find(w => w.side === side && rooms.find(r => r.id === w.room)?.kind !== 'kitchen') ?? windows.find(w => w.side === side);
    if (!window) return;
    const room = rooms.find(r => r.id === window.room)!, edge = panes.find(p => p.w.id === window.id)!.edge;
    const tangent = edge.tangent, a = add(edge.a, tangent, .3), b = add(edge.b, tangent, -.3);
    balconies.push({ polygon: [a, b, add(b, window.inward, -.75), add(a, window.inward, -.75)], door: { id: `balcony-${side}`, room: room.id, a: add(window.a, tangent, -.77), b: add(window.a, tangent, -.12), inward: window.inward } });
  });
  const hallArea = hall.reduce((sum, p) => sum + usableArea(p, outline), 0);
  const landing = [add(add(entryCentre, entryTangent, -1.1), entryInward, -.15), add(add(entryCentre, entryTangent, 1.1), entryInward, -.15), add(add(entryCentre, entryTangent, 1.1), entryInward, -1.2), add(add(entryCentre, entryTangent, -1.1), entryInward, -1.2)];
  return { outline, rooms, windows, doors, balconies, width, height, hall, hallArea, wallArea: polygonArea(outline) - hallArea - rooms.reduce((sum, r) => sum + r.area, 0), landing };
}

export type Furniture = { kind: 'bed' | 'sofa' | 'table' | 'dining' | 'counter' | 'fridge' | 'wardrobe' | 'tub' | 'shower' | 'sink' | 'toilet'; x: number; y: number; w: number; h: number; rotated?: boolean };
export function furnishing(room: PlanRoom, doors: PlanOpening[], windows: PlanOpening[], compact = false): Furniture[] {
  const specs: [Furniture['kind'], number, number][] = ['storage', 'dressing', 'utility'].includes(room.kind) ? [['wardrobe', Math.min(1.1, room.width - .4), .45]] : room.kind === 'living' ? [['sofa', 2.1, .85], ['table', .95, .55], ['wardrobe', 1.4, .55]] : room.kind === 'bedroom' ? [['bed', room.name.endsWith('1') && room.width >= 2.2 ? 1.6 : 1.1, 2], ['wardrobe', 1.4, .55]] : room.kind === 'kitchen' ? [['counter', .62, 2.1], ['fridge', .65, .65], ['dining', compact ? .95 : room.width < 2.7 ? 1.15 : 1.35, compact ? .95 : room.width < 2.7 ? 1.15 : 1.25]] : room.kind === 'bath' ? [room.area < 3.5 || compact ? ['shower', .8, .8] : ['tub', .72, 1.5], ['sink', .5, .43]] : [['toilet', .4, .65]];
  if (room.combined) specs.unshift(['toilet', .4, .65]);
  const result: Furniture[] = [];
  const toWorld = (x: number, y: number) => add(add(room.origin, room.tangent, x), room.inward, y);
  for (const [kind, specWidth, specHeight] of specs) {
    const options: (Furniture & { score: number })[] = [];
    const step = ['bath', 'wc', 'kitchen', 'storage', 'dressing'].includes(room.kind) ? .08 : .16;
    for (const rotated of [false, true]) {
      const w = rotated ? specHeight : specWidth, h = rotated ? specWidth : specHeight;
      for (let x = .16; x + w <= room.width - .12; x += step) for (let y = .18; y + h <= room.depth - (room.kind === 'bath' ? .06 : room.kind === 'wc' ? .1 : .35); y += step) {
        const corners = rectangle(x, y, w, h).map(p => toWorld(...p));
        if (!corners.every(p => inside(p, room.polygon))) continue;
        if (result.some(f => x < f.x + f.w + .12 && x + w + .12 > f.x && y < f.y + f.h + .12 && y + h + .12 > f.y)) continue;
        // Keep the whole symbol outside the door's swept quadrant and glazing clearance.
        const blocked = doors.filter(d => d.room === room.id).some(d => {
          const hinge = d.a, radius = distance(d.a, d.b) + .1;
          const xx = dot([hinge[0] - room.origin[0], hinge[1] - room.origin[1]], room.tangent), yy = dot([hinge[0] - room.origin[0], hinge[1] - room.origin[1]], room.inward);
          return Math.hypot(Math.max(x - xx, 0, xx - x - w), Math.max(y - yy, 0, yy - y - h)) < radius;
        });
        if (blocked || windows.filter(p => p.room === room.id).some(p => polygonArea(intersection(corners, [p.a, p.b, add(p.b, p.inward, .3), add(p.a, p.inward, .3)])) > 1e-6)) continue;
        const centre = kind === 'dining' || kind === 'table';
        options.push({ kind, x, y, w, h, rotated, score: centre ? Math.abs(x + w / 2 - room.width * .62) + Math.abs(y + h / 2 - room.depth * .5) : x + y * (kind === 'shower' ? -.3 : .3) });
      }
    }
    const best = options.sort((a, b) => a.score - b.score)[0];
    if (best) result.push(best);
  }
  if (!compact && (room.kind === 'bath' && result.length < (room.combined ? 3 : 2) || room.kind === 'kitchen' && result.length < 3)) return furnishing(room, doors, windows, true);
  return result;
}

export function roomLabel(room: PlanRoom, furniture: Furniture[], doors: PlanOpening[], font: number): { point: Point; font: number; compact?: boolean } {
  const compact = room.area < 5 || Math.min(room.width, room.depth) < 2.2;
  const sub = compact ? `${Math.round(room.area)} m2` : `about ${Math.round(room.area)} m2`;
  const labelLength = Math.max(room.name.length, sub.length);
  const base = Math.min(font, room.kind === 'wc' ? .26 : room.kind === 'bath' ? .29 : font, Math.max(.18, (room.width - .2) / (labelLength * .52)));
  const objects = furniture.map(f => rectangle(f.x, f.y, f.w, f.h).map(([x, y]) => add(add(room.origin, room.tangent, x), room.inward, y)));
  const xs = room.polygon.map(p => p[0]), ys = room.polygon.map(p => p[1]);
  const centre: Point = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  for (const scale of [1, .9, .8, .7, .58, .48, .38]) {
    const size = base * scale, w = labelLength * size * .54, h = size * 2.2;
    let best = { point: centre, score: Infinity };
    for (let x = Math.min(...xs) + w / 2 + .12; x < Math.max(...xs) - w / 2 - .12; x += .1) {
      for (let y = Math.min(...ys) + h / 2 + .12; y < Math.max(...ys) - h / 2 - .12; y += .1) {
        const box = rectangle(x - w / 2, y - h / 2, w, h);
        if (!box.every(p => inside(p, room.polygon))) continue;
        if (scale >= .48 && (objects.some(p => polygonArea(intersection(box, p)) > 1e-6) || doors.filter(d => d.room === room.id).some(d => Math.hypot(Math.max(x - w / 2 - d.a[0], 0, d.a[0] - x - w / 2), Math.max(y - h / 2 - d.a[1], 0, d.a[1] - y - h / 2)) < distance(d.a, d.b) + .08))) continue;
        const score = distance([x, y], centre);
        if (score < best.score) best = { point: [x, y], score };
      }
    }
    if (Number.isFinite(best.score)) return { point: [best.point[0], best.point[1] - size * .22], font: size, compact };
  }
  return { point: centre, font: Math.max(.2, base * .75), compact };
}

export function hallLabel(plan: DrawingPlan, font: number): { point: Point; font: number } {
  const area = Math.round(plan.hallArea);
  const entry = plan.doors.find(d => d.id === 'entrance');
  const centre: Point = [plan.width / 2, plan.height / 2];
  for (const scale of [.9, .8, .7, .6]) {
    const size = font * scale, w = `about ${area} m2`.length * size * .54, h = size * 2.3;
    let best = { point: centre, score: Infinity };
    for (let x = w / 2 + .15; x < plan.width - w / 2 - .15; x += .15) for (let y = h / 2 + .15; y < plan.height - h / 2 - .15; y += .15) {
      const box = rectangle(x - w / 2, y - h / 2, w, h);
      if (!box.every(p => plan.hall.some(polygon => inside(p, polygon)))) continue;
      if (entry && distance([x, y], entry.a) < distance(entry.a, entry.b) + w / 2) continue;
      const score = distance([x, y], centre);
      if (score < best.score) best = { point: [x, y], score };
    }
    if (Number.isFinite(best.score)) return { point: [best.point[0], best.point[1] - size * .25], font: size };
  }
  return { point: entry ? add(midpoint(entry.a, entry.b), entry.inward, .4) : centre, font: font * .6 };
}
