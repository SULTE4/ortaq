import type { Vec3 } from './types.ts';

export const defaultFloorPlan = [3, 1, 2, 1, 3];
export const sauranEntrancePlans: Record<string, number[]> = { '3': [3, 2, 2, 2, 3] };
export type Point = [number, number];
export type EntranceSection = { entrance: number; position: Vec3; rotation: number; length: number; outline: Point[]; exterior: Point[]; frontSide?: 'courtyard' | 'street' };
export type ApartmentCell = {
  apartment: number; entrance: number; floor: number; rooms: number;
  outline: Point[]; section: EntranceSection; start: number; end: number;
  area: number; centre: Vec3; entry: { point: Point; inward: Point }; loggiaSides?: ('courtyard' | 'street')[]; areaScale?: number;
};
export type ApartmentWindow = { id: string; apartment: number; position: Vec3; rotation: number; side: 'courtyard' | 'street'; width?: number };
export type FacadeWindow = Omit<ApartmentWindow, 'apartment'> & { apartment: number | null };
export type CirculationCore = { entrance: number; outline: Point[]; stair: Point[]; lifts: Point[][]; landing: Point[]; utilities?: Point[][]; corridor?: Point[]; doors: { point: Point; inward: Point; kind: 'stair' | 'lift' | 'utility' }[] };
export type ApartmentPlan = { cells: ApartmentCell[]; windows: FacadeWindow[]; cores: CirculationCore[] };

export function floorPlanFor(plan: number[] | undefined, apartments: number, entrances: number, floors: number): number[] {
  const count = apartments / (entrances * (floors - 1));
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new RangeError('Apartment count must fit the residential floors');
  if (plan != null) {
    if (!Array.isArray(plan) || plan.length !== count || !plan.every(r => Number.isInteger(r) && r >= 1 && r <= 5))
      throw new RangeError('Typical floor must match the apartment count and contain 1-5 rooms per home');
    return [...plan];
  }
  return count === defaultFloorPlan.length ? [...defaultFloorPlan] : Array(count).fill(2);
}
export function floorPlansFor(plan: number[] | undefined, overrides: Record<string, number[]> = {}, apartments: number | undefined, entrances: number, floors: number) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw new RangeError('Entrance plans must be an object');
  const entries = Object.entries(overrides);
  for (const [key, value] of entries) {
    if (!/^[1-9]\d*$/.test(key) || Number(key) > entrances || !Array.isArray(value)) throw new RangeError('Entrance plan must refer to an existing entrance');
    floorPlanFor(value, value.length * (floors - 1), 1, floors);
  }
  const inherited = entrances - entries.length;
  const count = apartments !== undefined && inherited > 0
    ? (apartments / (floors - 1) - entries.reduce((sum, [, p]) => sum + p.length, 0)) / inherited
    : defaultFloorPlan.length;
  const floorPlan = floorPlanFor(plan, (plan?.length ?? count) * (floors - 1), 1, floors);
  const plans = Array.from({ length: entrances }, (_, i) => overrides[String(i + 1)] ?? floorPlan);
  const total = plans.reduce((sum, p) => sum + p.length * (floors - 1), 0);
  if (apartments !== undefined && apartments !== total) throw new RangeError('Apartment count must equal the sum of each entrance plan over the residential floors');
  return { floorPlan, plans, apartments: total };
}
export function apartmentAddress(apartment: number, floors: number, plans: number[][]) {
  if (!Number.isInteger(apartment) || apartment < 1) throw new RangeError('Apartment is outside this building');
  let offset = 0;
  for (const [index, plan] of plans.entries()) {
    const count = (floors - 1) * plan.length;
    if (apartment <= offset + count) return { entrance: index + 1, floor: Math.floor((apartment - offset - 1) / plan.length) + 2, position: (apartment - offset - 1) % plan.length };
    offset += count;
  }
  throw new RangeError('Apartment is outside this building');
}
export function localPoint(section: EntranceSection, p: Point): Point {
  const x = p[0] - section.position[0], z = p[1] - section.position[2];
  const c = Math.cos(section.rotation), s = Math.sin(section.rotation);
  return [x * c - z * s, x * s + z * c];
}
export function worldPoint(section: EntranceSection, [along, depth]: Point): Point {
  const c = Math.cos(section.rotation), s = Math.sin(section.rotation);
  return [section.position[0] + along * c + depth * s, section.position[2] - along * s + depth * c];
}
// Clip surveyed geometry, so cells and the shared core tile the floor exactly.
export function clipOutline(outline: Point[], axis: 0 | 1, bound: number, greater: boolean): Point[] {
  const result: Point[] = [];
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length];
    const inside = (v: Point) => greater ? v[axis] >= bound : v[axis] <= bound;
    if (inside(p)) result.push(p);
    if (inside(p) !== inside(q)) {
      const t = (bound - p[axis]) / (q[axis] - p[axis]);
      result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  });
  return result.filter((p, i) => { const prev = result[(i + result.length - 1) % result.length]; return Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-8; });
}
export function polygonArea(outline: Point[]): number {
  return Math.abs(outline.reduce((sum, p, i) => { const q = outline[(i + 1) % outline.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
}
// Merge touching polygons without retaining their internal seams.
export function joinPolygons(pieces: Point[][]): Point[] {
  return joinPolygonParts(pieces).sort((a, b) => polygonArea(b) - polygonArea(a))[0] ?? [];
}
export function joinPolygonParts(pieces: Point[][]): Point[][] {
  pieces = pieces.map(poly => poly.filter((p, i) => {
    const a = poly[(i + poly.length - 1) % poly.length], b = poly[(i + 1) % poly.length];
    return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-8;
  })).filter(p => polygonArea(p) > 1e-8);
  if (!pieces.length) return [];
  const winding = Math.sign(pieces[0].reduce((s, p, i, all) => { const q = all[(i + 1) % all.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0));
  const near = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
  const vertices = pieces.flat();
  const edges = pieces.flatMap(poly => poly.flatMap((a, i) => {
    const b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    if (l2 < 1e-12) return [];
    const points = vertices.filter(p => Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) < 1e-7 && (p[0] - a[0]) * (p[0] - b[0]) + (p[1] - a[1]) * (p[1] - b[1]) <= 1e-7)
      .sort((p, q) => ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / l2)
      .filter((p, j, all) => !j || !near(p, all[j - 1]));
    return points.slice(0, -1).map((p, j) => [p, points[j + 1]] as [Point, Point]);
  }));
  const boundary = edges.filter(([a, b]) => !edges.some(([p, q]) => near(a, q) && near(b, p)));
  const result: Point[][] = [];
  while (boundary.length) {
    const [start, end] = boundary.shift()!;
    const polygon = [start];
    let tip = end;
    while (!near(tip, start) && boundary.length) {
      polygon.push(tip);
      const prev = polygon[polygon.length - 2], dx = tip[0] - prev[0], dy = tip[1] - prev[1];
      const next = boundary.map(([a, b], i) => ({ i, a, turn: winding * Math.atan2(dx * (b[1] - a[1]) - dy * (b[0] - a[0]), dx * (b[0] - a[0]) + dy * (b[1] - a[1])) })).filter(e => near(e.a, tip)).sort((a, b) => b.turn - a.turn)[0]?.i ?? -1;
      if (next < 0) break;
      tip = boundary.splice(next, 1)[0][1];
    }
    const clean = polygon.filter((p, i) => {
      const a = polygon[(i + polygon.length - 1) % polygon.length], b = polygon[(i + 1) % polygon.length];
      return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-8;
    });
    if (polygonArea(clean) > 1e-8) result.push(clean);
  }
  return result;
}
export function onBoundary(p: Point, polygon: Point[]): boolean {
  return polygon.some((a, i) => {
    const b = polygon[(i + 1) % polygon.length], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    return length > 1e-8 && Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / length < 1e-6 && (p[0] - a[0]) * (p[0] - b[0]) + (p[1] - a[1]) * (p[1] - b[1]) <= 1e-7;
  });
}
export function createApartmentPlan(sections: EntranceSection[], floors: number, plans: number[][], floorHeight: number): ApartmentPlan {
  const cells: ApartmentCell[] = [], windows: FacadeWindow[] = [], cores: CirculationCore[] = [];
  for (const section of sections) {
    const plan = plans[section.entrance - 1];
    const offset = plans.slice(0, section.entrance - 1).reduce((sum, p) => sum + (floors - 1) * p.length, 0);
    let outline = section.outline.map(p => localPoint(section, p));
    const signed = outline.reduce((s, p, i) => { const q = outline[(i + 1) % outline.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
    if (signed < 0) outline = outline.reverse();
    const min = Math.min(...outline.map(p => p[0])), max = Math.max(...outline.map(p => p[0]));
    const back = Math.min(...outline.map(p => p[1])), front = Math.max(...outline.map(p => p[1]));
    const spans = Array.from({ length: 20 }, (_, i) => {
      const at = min + (max - min) * (i + .5) / 20;
      const hits = outline.flatMap((a, j) => {
        const b = outline[(j + 1) % outline.length];
        return at > Math.min(a[0], b[0]) && at < Math.max(a[0], b[0]) ? [a[1] + (b[1] - a[1]) * (at - a[0]) / (b[0] - a[0])] : [];
      });
      return [Math.min(...hits), Math.max(...hits)];
    });
    const sharedBack = Math.max(...spans.map(p => p[0])), sharedFront = Math.min(...spans.map(p => p[1]));
    const box = (x0: number, x1: number, y0: number, y1: number, poly = outline) =>
      clipOutline(clipOutline(clipOutline(clipOutline(poly, 0, x0, true), 0, x1, false), 1, y0, true), 1, y1, false);
    const world = (poly: Point[]) => poly.map(p => worldPoint(section, p));
    const corridor = Math.min(1.8 / 2.5, (sharedFront - sharedBack) * .2);
    const cy = (sharedFront + sharedBack) / 2 - (plan.length >= 3 && plan.length <= 5 ? .3 : 0), high = cy + corridor / 2;
    const coreWidth = Math.min(5.5 / 2.5, (max - min) * .3);
    const stairDepth = Math.min(2.7 / 2.5, (sharedFront - high) * .52);
    const liftSize = Math.min(1.8 / 2.5, (sharedFront - stairDepth - high) * .9, coreWidth * .4);
    let stair: Point[] = [];
    const core: CirculationCore = { entrance: section.entrance, outline: [], stair: [], lifts: [], landing: [], doors: [] };
    cores.push(core);
    type Allocation = { index: number; polygon: Point[]; entry: Point; inward: Point };
    const allocations: Allocation[] = [];
    let areaScale = 1, compactSection = false;
    if (plan.length <= 2) {
      const midpointArea = [0, 42.5, 65, 87.5, 110, 132.5];
      const sidePassage = Math.min(1.6 / 2.5, (max - min) * .1);
      const widths = plan.map(r => Math.sqrt(midpointArea[r] / 6.25));
      areaScale = Math.min(1, ((max - min - coreWidth - 2 * sidePassage) / widths.reduce((s, w) => s + w, 0)) ** 2, (sharedFront - sharedBack) ** 2 / Math.max(...widths.map(w => w * w)));
      const sizes = widths.map(w => w * Math.sqrt(areaScale));
      const leftEdge = min + sizes[0], rightEdge = plan.length === 2 ? max - sizes[1] : Math.min(max, leftEdge + coreWidth + 2 * sidePassage);
      const s0 = (leftEdge + rightEdge - coreWidth) / 2, s1 = s0 + coreWidth;
      const hiY = Math.min(back + Math.min(...sizes) - .08, sharedFront - stairDepth - liftSize - .04), loY = hiY - corridor;
      const main = box(leftEdge, rightEdge, loY, hiY);
      const stairBottom = sharedFront - Math.min(stairDepth, (sharedFront - hiY) * .6);
      const elevatorSize = Math.min(liftSize, (stairBottom - hiY) * .9), liftLeft = (s0 + s1 - elevatorSize) / 2;
      stair = box(s0, s1, stairBottom, front);
      const liftBottom = stairBottom - elevatorSize;
      const elevator = box(liftLeft, liftLeft + elevatorSize, liftBottom, stairBottom);
      const unused = [box(min, leftEdge, back + sizes[0], front), ...(plan.length === 2 ? [box(rightEdge, max, back + sizes[1], front)] : [])];
      const utilities = unused.filter(p => polygonArea(p) > .1);
      const lower = joinPolygons([box(leftEdge, rightEdge, back, loY), ...(plan.length === 1 ? [box(rightEdge, max, back, front)] : [])]);
      if (polygonArea(lower) > .1) utilities.push(lower);
      const landing = joinPolygons([main, box(leftEdge, s0, hiY, front), box(s1, rightEdge, hiY, front), box(s0, liftLeft, hiY, stairBottom), box(liftLeft + elevatorSize, s1, hiY, stairBottom), box(liftLeft, liftLeft + elevatorSize, hiY, liftBottom), ...unused.filter(p => polygonArea(p) <= .1), ...(polygonArea(lower) <= .1 ? [lower] : [])]);
      allocations.length = 0;
      allocations.push({ index: 0, polygon: box(min, leftEdge, back, back + sizes[0]), entry: [leftEdge, (loY + hiY) / 2], inward: [-1, 0] });
      if (plan.length === 2) allocations.push({ index: 1, polygon: box(rightEdge, max, back, back + sizes[1]), entry: [rightEdge, (loY + hiY) / 2], inward: [1, 0] });
      const utilityDoors = utilities.map(poly => {
        const choices: { point: Point; inward: Point }[] = [
          { point: [leftEdge, (Math.max(back + sizes[0], hiY) + front) / 2], inward: [-1, 0] },
          { point: [rightEdge, plan.length === 1 ? (loY + hiY) / 2 : (Math.max(back + sizes[1], hiY) + front) / 2], inward: [1, 0] },
          { point: [(leftEdge + rightEdge) / 2, loY], inward: [0, -1] },
        ];
        return choices.filter(d => onBoundary(d.point, poly) && onBoundary(d.point, landing)).slice(0, 1).map(d => ({ point: worldPoint(section, d.point), inward: worldPoint({ ...section, position: [0, 0, 0] }, d.inward), kind: 'utility' as const }));
      }).flat();
      Object.assign(core, { outline: world(joinPolygons([landing, stair, elevator, ...utilities])), stair: world(stair), lifts: [world(elevator)], landing: world(landing), utilities: utilities.map(world), corridor: world(plan.length === 1 ? box(leftEdge, Math.min(rightEdge, (s0 + liftLeft) / 2 + .6), loY, hiY) : main), doors: [
        { point: worldPoint(section, [(s0 + liftLeft) / 2, stairBottom]), inward: [Math.sin(section.rotation), Math.cos(section.rotation)], kind: 'stair' },
        { point: worldPoint(section, [(s0 + s1) / 2, liftBottom]), inward: [Math.sin(section.rotation), Math.cos(section.rotation)], kind: 'lift' },
        ...utilityDoors,
      ] });
    }
    if (plan.length === 5 && (max - min) * 2.5 >= 18 && (sharedFront - sharedBack) * 2.5 >= 10) {
      // Corner homes wrap the corridor ends. The smaller courtyard homes retain
      // full-depth outer bays; only their inner rear corners meet the landing.
      const bands = [[0, 0], [35, 50], [55, 75], [75, 100], [95, 125], [115, 150]];
      const ranked = plan.map((rooms, index) => ({ rooms, index })).sort((a, b) => b.rooms - a.rooms || a.index - b.index);
      const ends = [ranked[0].index, ranked[1].index].sort((a, b) => a - b);
      const middle = ranked.slice(2).sort((a, b) => a.rooms - b.rooms || Math.abs(b.index - 2) - Math.abs(a.index - 2) || a.index - b.index);
      const left = middle[0].index, right = middle[1].index, street = middle[2].index;
      areaScale = Math.min(1, (polygonArea(outline) * 6.25 - 55) / plan.reduce((sum, r) => sum + (bands[r][0] + bands[r][1]) / 2, 0));
      const availableDepth = sharedFront - back - corridor - 4.01 / 2.5;
      const streetTarget = (bands[plan[street]][0] + (bands[plan[street]][1] - bands[plan[street]][0]) * .325) / 6.25;
      areaScale = Math.min(areaScale, (2.2 * availableDepth ** 2 - 2 * (1.6 / 2.5) * (2.7 / 2.5)) / streetTarget);
      const target = (index: number, fraction: number) => (bands[plan[index]][0] + (bands[plan[index]][1] - bands[plan[index]][0]) * fraction) * areaScale / 6.25;
      const d = sharedFront - sharedBack, baseBottom = sharedBack + Math.max(5.75 / 2.5 * Math.sqrt(areaScale), d * .47);
      const arm = Math.min(1.8 / 2.5, (baseBottom - sharedBack) * .32);
      const stubWidth = Math.min(1.6 / 2.5, (max - min) * .07), stubDepth = arm + .9 / 2.5;
      const layout = (growth: number) => {
        const bottom = Math.max(baseBottom, back + Math.sqrt((target(street, .325 + .675 * growth) + 2 * stubWidth * stubDepth) / 2.2)), upper = bottom + corridor;
        const streetWidth = (target(street, .325 + .675 * growth) + 2 * stubWidth * stubDepth) / (bottom - back);
        const initialCentre = (min + max) / 2;
        const leftOffset = (-coreWidth / 2 * (front - upper) - streetWidth / 2 * corridor - target(left, .75 + .25 * growth)) / (front - bottom);
        const rightOffset = (coreWidth / 2 * (front - upper) + streetWidth / 2 * corridor + target(right, .75 + .25 * growth)) / (front - bottom);
        const leftArea = (initialCentre + leftOffset - min) * (front - back) + (-streetWidth / 2 - leftOffset) * (bottom - back);
        const rightArea = (max - initialCentre - rightOffset) * (front - back) + (rightOffset - streetWidth / 2) * (bottom - back);
        const leftShare = (leftArea + rightArea) * target(ends[0], .5) / (target(ends[0], .5) + target(ends[1], .5));
        const centre = initialCentre + (leftShare - leftArea) / (front - back), b0 = centre - streetWidth / 2, b1 = centre + streetWidth / 2;
        const c0 = centre - coreWidth / 2, c1 = centre + coreWidth / 2;
        const a0 = (c0 * (front - upper) + b0 * corridor - target(left, .75 + .25 * growth)) / (front - bottom);
        const a1 = (c1 * (front - upper) + b1 * corridor + target(right, .75 + .25 * growth)) / (front - bottom);
        const cornerArea = (corner: number, a: number, b: number) => polygonArea(box(Math.min(corner, a), Math.max(corner, a), back, front)) + polygonArea(box(Math.min(a, b), Math.max(a, b), back, bottom));
        const surplus = Math.max(cornerArea(min, a0, b0) - target(ends[0], .9), cornerArea(max, a1, b1) - target(ends[1], .9));
        const fits = min < a0 && a0 < b0 && b0 + stubWidth < c0 && c1 < b1 - stubWidth && b1 < a1 && a1 < max && sharedFront - upper - 1.6 / 2.5 >= 2.4 / 2.5;
        return { bottom, upper, centre, a0, a1, b0, b1, c0, c1, surplus, fits };
      };
      let chosen = layout(0);
      // Use spare area inside the flat bands before falling back to common rooms.
      if (chosen.surplus > 1e-7 && layout(1).surplus <= 1e-7) {
        let lo = 0, hi = 1;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if (layout(mid).surplus > 0) lo = mid; else hi = mid;
        }
        const expanded = layout(hi);
        if (expanded.fits) chosen = expanded;
      }
      const { bottom, upper, centre, a0, a1, b0, b1, c0, c1 } = chosen;
      const sectionalStairDepth = Math.min(stairDepth, sharedFront - upper - 1.6 / 2.5);
      if (min < a0 && a0 < b0 && b0 + stubWidth < c0 && c1 < b1 - stubWidth && b1 < a1 && a1 < max && sectionalStairDepth >= 2.4 / 2.5) {
        compactSection = true;
        const stairBottom = sharedFront - sectionalStairDepth;
        stair = box(c0, c1, stairBottom, front);
        const elevatorSize = Math.min(liftSize, stairBottom - upper);
        const elevator = box(c1 - elevatorSize, c1, upper, upper + elevatorSize);
        const main = box(b0, b1, bottom, upper);
        const stubs = [box(b0, b0 + stubWidth, bottom - stubDepth, bottom), box(b1 - stubWidth, b1, bottom - stubDepth, bottom)];
        const vestibule = [box(c0, c1 - elevatorSize, upper, stairBottom), box(c1 - elevatorSize, c1, upper + elevatorSize, stairBottom)];
        const utilities: Point[][] = [];
        allocations.length = 0;
        for (const [side, index, a, b] of [[-1, ends[0], a0, b0], [1, ends[1], a1, b1]]) {
          const corner = side < 0 ? min : max;
          const full = joinPolygons([box(Math.min(corner, a), Math.max(corner, a), back, front), box(Math.min(a, b), Math.max(a, b), back, bottom)]);
          const utilityTop = bottom - arm;
          let lo = Math.min(corner, b), hi = Math.max(corner, b);
          const desired = Math.max(0, polygonArea(full) - target(index, .9));
          // A utility room below the entry arm opens directly to the side vestibule.
          for (let i = 0; i < 40; i++) {
            const cut = (lo + hi) / 2;
            const area = polygonArea(box(Math.min(cut, b), Math.max(cut, b), back, utilityTop));
            if ((area > desired) === (side < 0)) lo = cut; else hi = cut;
          }
          const cut = desired < .01 ? b : (lo + hi) / 2;
          const utility = box(Math.min(cut, b), Math.max(cut, b), back, utilityTop);
          if (polygonArea(utility) > .01) utilities.push(utility);
          const home = joinPolygons([box(Math.min(corner, cut), Math.max(corner, cut), back, utilityTop), box(Math.min(corner, a), Math.max(corner, a), utilityTop, front), box(Math.min(a, b), Math.max(a, b), utilityTop, bottom)]);
          allocations.push({ index, polygon: home, entry: [b, bottom - arm / 2], inward: [side, 0] });
        }
        allocations.push({ index: left, polygon: joinPolygons([box(a0, c0, upper, front), box(a0, b0, bottom, upper)]), entry: [(b0 + c0) / 2, upper], inward: [0, 1] });
        allocations.push({ index: right, polygon: joinPolygons([box(c1, a1, upper, front), box(b1, a1, bottom, upper)]), entry: [(c1 + b1) / 2, upper], inward: [0, 1] });
        allocations.push({ index: street, polygon: joinPolygons([box(b0, b1, back, bottom - stubDepth), box(b0 + stubWidth, b1 - stubWidth, bottom - stubDepth, bottom)]), entry: [centre, bottom], inward: [0, -1] });
        const landing = joinPolygons([main, ...stubs, ...vestibule]);
        Object.assign(core, { outline: world(joinPolygons([main, ...stubs, box(c0, c1, upper, front), ...utilities])), stair: world(stair), lifts: [world(elevator)], landing: world(landing), utilities: utilities.map(world), corridor: world(main), doors: [
          { point: worldPoint(section, [(c0 + c1 - elevatorSize) / 2, stairBottom]), inward: [Math.sin(section.rotation), Math.cos(section.rotation)], kind: 'stair' },
          { point: worldPoint(section, [c1 - elevatorSize / 2, upper]), inward: [Math.sin(section.rotation), Math.cos(section.rotation)], kind: 'lift' },
          ...[b0, b1].flatMap((b, i) => utilities.some(p => onBoundary([b, bottom - arm - .45 / 2.5], p)) ? [{ point: worldPoint(section, [b, bottom - arm - .45 / 2.5]), inward: worldPoint({ ...section, position: [0, 0, 0] }, [i ? 1 : -1, 0]), kind: 'utility' }] : []),
        ] });
      }
    }
    if (plan.length >= 3 && (!compactSection || (sharedFront - sharedBack) * 2.5 >= 13.3)) {
      // Deeper generic sections can fit two complete rows beside a central core.
      // Reserve the unused frontage for common rooms instead of enlarging homes.
      const midpointArea = [0, 42.5, 65, 87.5, 110, 132.5];
      const sum = (indices: number[]) => indices.reduce((s, i) => s + midpointArea[plan[i]] / 6.25, 0);
      const loY = (sharedFront + sharedBack - corridor) / 2, hiY = loY + corridor;
      const topDepth = front - hiY, bottomDepth = loY - back;
      let boundsRatio = (sharedFront - sharedBack) * 2.5 >= 10 && polygonArea(outline) / ((max - min) * (front - back)) > .9 ? 2.2 : Infinity;
      let topIndices: number[] = [], bottomIndices: number[] = [], capacity = -1;
      for (let attempt = 0; attempt < 2 && capacity < 0; attempt++) {
        if (attempt) boundsRatio = Infinity;
        for (let mask = 1; mask < (1 << plan.length) - 1; mask++) {
          const top = plan.flatMap((_, i) => mask & (1 << i) ? [i] : []), bottom = plan.flatMap((_, i) => mask & (1 << i) ? [] : [i]);
          if (top.length < 2) continue;
          if (top.length * topDepth / boundsRatio > max - min - coreWidth || bottom.length * bottomDepth / boundsRatio > max - min) continue;
          const fit = Math.min((max - min - coreWidth) * topDepth / sum(top), (max - min) * bottomDepth / sum(bottom));
          if (fit > capacity) { capacity = fit; topIndices = top; bottomIndices = bottom; }
        }
      }
      const split = Math.ceil(topIndices.length / 2);
      areaScale = Math.min(1, (max - min - coreWidth) * topDepth / sum(topIndices), (max - min) * bottomDepth / sum(bottomIndices), 2.2 * topDepth ** 2 / Math.max(...topIndices.map(i => midpointArea[plan[i]] / 6.25)), 2.2 * bottomDepth ** 2 / Math.max(...bottomIndices.map(i => midpointArea[plan[i]] / 6.25)));
      const left = topIndices.slice(0, split), right = topIndices.slice(split);
      const span = (indices: number[], depth: number, scale = areaScale) => indices.reduce((s, i) => s + Math.max(midpointArea[plan[i]] / 6.25 * scale / depth, depth / boundsRatio), 0);
      let fitLow = 0, fitHigh = areaScale;
      for (let i = 0; i < 40; i++) {
        const fit = (fitLow + fitHigh) / 2;
        if (span(topIndices, topDepth, fit) <= max - min - coreWidth && span(bottomIndices, bottomDepth, fit) <= max - min) fitLow = fit; else fitHigh = fit;
      }
      areaScale = fitLow;
      const x0 = min + (max - min - coreWidth) * span(left, topDepth) / span(topIndices, topDepth), x1 = x0 + coreWidth;
      const leftStart = x0 - span(left, topDepth), rightEnd = x1 + span(right, topDepth);
      const bottomStart = (min + max - span(bottomIndices, bottomDepth)) / 2, bottomEnd = bottomStart + span(bottomIndices, bottomDepth);
      allocations.length = 0;
      const recesses: Point[][] = [];
      const allocate = (indices: number[], start: number, depth: number, y0: number, y1: number, entryY: number, inward: Point) => {
        let cursor = start;
        for (const index of indices) {
          const area = midpointArea[plan[index]] / 6.25 * areaScale, width = Math.max(area / depth, depth / boundsRatio), end = cursor + width;
          if (width * depth - area < 1e-7) allocations.push({ index, polygon: box(cursor, end, y0, y1), entry: [(cursor + end) / 2, entryY], inward });
          else {
            const neck = Math.min(1.2 / 2.5, width * .5, area / depth * .8), clearDepth = (area - neck * depth) / (width - neck);
            const cut = inward[1] > 0 ? y1 - clearDepth : y0 + clearDepth;
            const home = joinPolygons([box(cursor, cursor + neck, y0, y1), box(cursor + neck, end, inward[1] > 0 ? cut : y0, inward[1] > 0 ? y1 : cut)]);
            recesses.push(box(cursor + neck, end, inward[1] > 0 ? y0 : cut, inward[1] > 0 ? cut : y1));
            allocations.push({ index, polygon: home, entry: [cursor + neck / 2, entryY], inward });
          }
          cursor = end;
        }
      };
      allocate(left, leftStart, topDepth, hiY, front, hiY, [0, 1]);
      allocate(right, x1, topDepth, hiY, front, hiY, [0, 1]);
      allocate(bottomIndices, bottomStart, bottomDepth, back, loY, loY, [0, -1]);
      const doorMin = Math.min(x0, ...allocations.map(a => a.entry[0])) - .3, doorMax = Math.max(x1, ...allocations.map(a => a.entry[0])) + .3;
      const main = box(doorMin, doorMax, loY, hiY);
      const stairBottom = sharedFront - Math.min(stairDepth, (sharedFront - hiY) * .6);
      const elevatorSize = Math.min(liftSize, (stairBottom - hiY) * .9);
      stair = box(x0, x1, stairBottom, front);
      const elevator = box(x1 - elevatorSize, x1, hiY, hiY + elevatorSize);
      const unused = [joinPolygons([box(min, leftStart, hiY, front), box(min, bottomStart, back, loY), box(min, doorMin, loY, hiY)]), joinPolygons([box(rightEnd, max, hiY, front), box(bottomEnd, max, back, loY), box(doorMax, max, loY, hiY)])];
      const utilities = unused.filter(p => polygonArea(p) > .01);
      const landing = joinPolygons([main, box(x0, x1 - elevatorSize, hiY, stairBottom), box(x1 - elevatorSize, x1, hiY + elevatorSize, stairBottom), ...unused.filter(p => polygonArea(p) <= .01), ...recesses]);
      Object.assign(core, { outline: world(joinPolygons([landing, stair, elevator, ...utilities])), stair: world(stair), lifts: [world(elevator)], landing: world(landing), utilities: utilities.map(world), corridor: world(main), doors: [
        { point: worldPoint(section, [(x0 + x1 - elevatorSize) / 2, stairBottom]), inward: [Math.sin(section.rotation), Math.cos(section.rotation)], kind: 'stair' },
        { point: worldPoint(section, [x1 - elevatorSize / 2, hiY]), inward: [Math.sin(section.rotation), Math.cos(section.rotation)], kind: 'lift' },
        ...[doorMin, doorMax].flatMap((x, i) => utilities.some(p => onBoundary([x, (loY + hiY) / 2], p)) ? [{ point: worldPoint(section, [x, (loY + hiY) / 2]), inward: worldPoint({ ...section, position: [0, 0, 0] }, [i ? 1 : -1, 0]), kind: 'utility' }] : []),
      ] });
    }
    const exterior = section.exterior.map(p => localPoint(section, p));
    for (const { index, polygon: allocated, entry, inward } of allocations) {
      const local = allocated.filter((p, i) => {
        const a = allocated[(i + allocated.length - 1) % allocated.length], b = allocated[(i + 1) % allocated.length];
        return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-8;
      });
      const start = Math.min(...local.map(p => p[0])), end = Math.max(...local.map(p => p[0]));
      const polygon = world(local), centre = worldPoint(section, [local.reduce((s, p) => s + p[0], 0) / local.length, local.reduce((s, p) => s + p[1], 0) / local.length]);
      const facades = local.flatMap((a, i) => {
        const b = local[(i + 1) % local.length], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
        if (length < 1e-8) return [];
        return exterior.flatMap((p, j) => {
          const q = exterior[(j + 1) % exterior.length];
          if ([p, q].some(v => Math.abs((v[0] - a[0]) * dy - (v[1] - a[1]) * dx) / length > 1e-6)) return [];
          const t0 = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length ** 2, t1 = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / length ** 2;
          const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(1, Math.max(t0, t1));
          if (hi - lo < .0001) return [];
          const start: Point = [a[0] + dx * lo, a[1] + dy * lo], end: Point = [a[0] + dx * hi, a[1] + dy * hi];
          return [{ a: start, b: end, length: (hi - lo) * length, depth: (start[1] + end[1]) / 2 }];
        });
      });
      if (!facades.length) throw new RangeError(`Apartment cell has no external facade: ${section.entrance}/${index} ${JSON.stringify(local)}`);
      // Use the full daylight frontage, rather than glazing party or core walls.
      const longFaces = facades.filter(e => Math.abs(e.b[0] - e.a[0]) > Math.abs(e.b[1] - e.a[1]));
      const through = longFaces.some(a => longFaces.some(b => Math.abs(a.depth - b.depth) > .5));
      let primary = longFaces.length ? [...longFaces].sort((a, b) => b.depth - a.depth)[0] : [...facades].sort((a, b) => b.length - a.length)[0];
      // A narrow corner arm cannot light every room; use its full end facade.
      if (!through && primary.length * 2.5 / (plan[index] + 1) < 1.8) primary = [...facades].sort((a, b) => b.length - a.length)[0];
      const secondary = through ? [...longFaces].sort((a, b) => a.depth - b.depth).find(e => e !== primary && Math.abs(e.depth - primary.depth) > .5 && e.length * 2.5 / (plan[index] + 1 - Math.ceil(plan[index] / 2)) >= 1.8) : undefined;
      for (let floor = 2; floor <= floors; floor++) {
        const apartment = offset + (floor - 2) * plan.length + index + 1, rooms = plan[index], y = (floor - .5) * floorHeight;
        const wp = worldPoint(section, entry), wi = worldPoint({ ...section, position: [0, 0, 0] }, inward);
        cells.push({ apartment, entrance: section.entrance, floor, rooms, outline: polygon, section, start, end, entry: { point: wp, inward: wi }, area: polygonArea(polygon) * 6.25, centre: [centre[0], y, centre[1]], areaScale });
        for (let w = 0; w <= rooms; w++) {
          const frontCount = secondary ? Math.ceil(rooms / 2) : rooms + 1;
          const edge = w < frontCount ? primary : secondary!;
          const count = edge === primary ? frontCount : rooms + 1 - frontCount;
          const t = (w < frontCount ? w + .5 : w - frontCount + .5) / count;
          const a = worldPoint(section, edge.a), b = worldPoint(section, edge.b);
          const p: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          const frontSide = section.frontSide ?? 'courtyard';
          const side = edge.depth > cy ? frontSide : frontSide === 'courtyard' ? 'street' : 'courtyard';
          windows.push({ id: `apt-${apartment}-${w}`, apartment, position: [p[0], y, p[1]], rotation: Math.atan2(b[1] - a[1], -(b[0] - a[0])), side, width: Math.min(.48, edge.length / count * .65) });
        }
      }
    }
    const stairFacade = stair.map((a, i) => ({ a, b: stair[(i + 1) % stair.length] })).find(e => onBoundary([(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2], exterior));
    if (stairFacade) for (let floor = 2; floor <= floors; floor++) {
      const a = worldPoint(section, stairFacade.a), b = worldPoint(section, stairFacade.b);
      windows.push({ id: `stair-${section.entrance}-${floor}`, apartment: null, position: [(a[0] + b[0]) / 2, floor * floorHeight, (a[1] + b[1]) / 2], rotation: Math.atan2(b[1] - a[1], -(b[0] - a[0])), side: section.frontSide ?? 'courtyard' });
    }
  }
  cells.sort((a, b) => a.apartment - b.apartment);
  return { cells, windows, cores };
}
