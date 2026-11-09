import { apartmentAddress, clipOutline, createApartmentPlan, floorPlansFor, localPoint, sauranEntrancePlans, worldPoint, type ApartmentCell, type CirculationCore, type EntranceSection } from './apartmentPlan.ts';
import type { Vec3 } from './types.ts';
import { sauranSections, buildingFootprint, entranceLayout, floorHeight, mapToScene, type FacadeWindow } from './domain.ts';

export type ManagedBuilding = {
  id: number; name: string; address: string; floors: number;
  lat: number; lon: number; footprint: [number, number][];
  osm_id?: number; entrances?: number; apartments?: number; floor_plan?: number[];
  entrance_plans?: Record<string, number[]>;
  plan_images?: Record<string, string>;
};
export type BuildingModel = {
  building: ManagedBuilding; footprint: [number, number][]; height: number;
  entrances: typeof entranceLayout; windows: FacadeWindow[]; cells: ApartmentCell[]; cores: CirculationCore[];
  location: (apartment: number) => { entrance: number; floor: number };
};
export const sauran: ManagedBuilding = {
  id: 1, name: 'ЖК Ortaq Demo', address: '6 Sauran St, Astana',
  floors: 9, entrances: 3, apartments: 120, floor_plan: [3, 1, 2, 1, 3], osm_id: 425124327,
  entrance_plans: sauranEntrancePlans,
  lat: 51.122618, lon: 71.423048,
  footprint: [[71.4225657, 51.1225401], [71.422685, 51.122859], [71.422867, 51.1228321], [71.4227873, 51.1226193], [71.4237113, 51.1224831], [71.4236716, 51.122377]],
};
export const bearing = Math.atan2(-15.06, 64.56);
export const isSauran = (b: ManagedBuilding) => b.osm_id === 425124327 ||
  (b.id === 1 && Math.abs(b.lat - sauran.lat) < .00001 && Math.abs(b.lon - sauran.lon) < .00001);
export function validBuilding(b: ManagedBuilding): boolean {
  return !!b && Number.isInteger(b.id) && b.id > 0 && typeof b.address === "string" && Number.isFinite(b.lat) && Math.abs(b.lat) <= 85 && Number.isFinite(b.lon) && Math.abs(b.lon) <= 180 &&
    Array.isArray(b.footprint) && b.footprint.length >= 3 && b.footprint.length <= 200 && Number.isFinite(b.floors) && Number.isInteger(b.floors) && b.floors > 0 &&
    b.footprint.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 85);
}
// Mercator metres at the centre preserve tile alignment, including in another district.
export function localFootprint(b: ManagedBuilding): [number, number][] {
  const rad = Math.PI / 180, radius = 6378137;
  const north = (lat: number) => radius * Math.log(Math.tan(Math.PI / 4 + lat * rad / 2));
  return b.footprint.map(([lon, lat]) => mapToScene([
    (lon - b.lon) * rad * radius * Math.cos(b.lat * rad),
    (north(lat) - north(b.lat)) * Math.cos(b.lat * rad),
  ]));
}
export function modelFor(building: ManagedBuilding): BuildingModel {
  const floors = Math.max(2, Math.floor(building.floors));
  const count = Math.max(1, Math.floor(building.entrances ?? (isSauran(building) ? 3 : 1)));
  const { floorPlan: floor_plan, plans, apartments } = floorPlansFor(building.floor_plan, building.entrance_plans, building.apartments, count, floors);
  const normalized = { ...building, apartments, entrances: count, floor_plan };
  const location = (apt: number) => { const { entrance, floor } = apartmentAddress(apt, floors, plans); return { entrance, floor }; };
  if (isSauran(building) && floors === 9 && count === 3) {
    const plan = createApartmentPlan(sauranSections, floors, plans, floorHeight);
    plan.cells.forEach(cell => {
      const index = apartmentAddress(cell.apartment, floors, plans).position;
      cell.loggiaSides = index === 0 || index === 3 ? (['courtyard', 'street'] as const).filter(side => {
        const pane = plan.windows.find(w => w.apartment === cell.apartment && w.side === side);
        return pane && Math.abs(Math.sin(pane.rotation - cell.section.rotation)) <= .01;
      }) : [];
    });
    return { building: normalized, footprint: buildingFootprint, height: floors * floorHeight, entrances: entranceLayout,
      ...plan, location };
  }
  const footprint = localFootprint(building);
  const signedArea = footprint.reduce((a, p, i) => { const q = footprint[(i + 1) % footprint.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
  const edges = footprint.map((p, i) => {
    const q = footprint[(i + 1) % footprint.length], dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz);
    const sign = signedArea > 0 ? 1 : -1;
    return { p, q, length, rotation: Math.atan2(sign * dz, -sign * dx) };
  }).filter(e => e.length > .1).sort((a, b) => b.length - a.length);
  if (!edges.length) throw new Error('Building outline has no usable edges');
  const main = edges[0];
  // Orient the longest facade left to right when seen from outside the building.
  const basis: EntranceSection = { entrance: 0, position: [main.p[0], 0, main.p[1]], rotation: main.rotation, length: main.length, outline: footprint, exterior: footprint };
  const local = footprint.map(p => localPoint(basis, p));
  const min = Math.min(...local.map(p => p[0])), max = Math.max(...local.map(p => p[0]));
  const sections: EntranceSection[] = Array.from({ length: count }, (_, i) => {
    const start = min + (max - min) * i / count, end = min + (max - min) * (i + 1) / count;
    const outline = clipOutline(clipOutline(local, 0, start, true), 0, end, false).map(p => worldPoint(basis, p));
    const p = worldPoint(basis, [(start + end) / 2, 0]);
    return { entrance: i + 1, position: [p[0], 0, p[1]], rotation: main.rotation, length: end - start, outline, exterior: footprint };
  });
  const plan = createApartmentPlan(sections, floors, plans, floorHeight);
  return { building: normalized, footprint, height: floors * floorHeight, entrances: sections, ...plan, location };
}
export function modelFocus(model: BuildingModel, apartment: number): Vec3 {
  return model.cells.find(c => c.apartment === apartment)?.centre ?? [0, model.height / 2, 0];
}

export function modelIssue(model: BuildingModel, l: { entrance: number; floor: number; area: string }): Vec3 {
  // Area-only reports use a building anchor until a mapped feature ID is supplied.
  const entrance = model.entrances[Math.max(0, l.entrance - 1)] ?? model.entrances[0];
  return [entrance.position[0] + Math.sin(entrance.rotation) * .55,
    l.area ? .8 : (Math.min(model.building.floors, Math.max(1, l.floor)) - .5) * floorHeight,
    entrance.position[2] + Math.cos(entrance.rotation) * .55];
}
