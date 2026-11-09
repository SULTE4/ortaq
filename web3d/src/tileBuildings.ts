import type { ManagedBuilding } from './buildingModel.ts';
type Point = number[];
export type Polygon = Point[][];
export type TileBuilding = { id?: string | number; properties: Record<string, unknown>; geometry: { type: string; coordinates?: unknown } };
export function insideRing(point: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function polygons(geometry: TileBuilding['geometry']): Polygon[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates as Polygon] : geometry.type === 'MultiPolygon' ? geometry.coordinates as Polygon[] : [];
}
function managedPolygon(ring: Point[], b: ManagedBuilding): boolean {
  const cos = Math.cos(b.lat * Math.PI / 180);
  const metre = (p: Point) => [(p[0] - b.lon) * 111320 * cos, (p[1] - b.lat) * 111320];
  const outline = b.footprint.map(metre);
  let close = 0;
  for (const p of ring.slice(0, -1).map(metre)) {
    const distance = Math.min(...outline.map((a, i) => {
      const c = outline[(i + 1) % outline.length], dx = c[0] - a[0], dy = c[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    }));
    if (distance < 3) close++;
  }
  return close >= 3 && close >= (ring.length - 1) * .6;
}
// OpenMapTiles batches same-height buildings. Repair only affected feature IDs, preserving every other component.
export function repairBuildings(features: TileBuilding[], buildings: ManagedBuilding[]) {
  const ids = new Set<string | number>();
  const replacements: { id: string | number; type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'Polygon'; coordinates: Polygon } }[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const parts = polygons(feature.geometry);
    const matches = parts.map(p => buildings.some(b => managedPolygon(p[0], b)));
    if (!matches.some(Boolean) || feature.id === undefined) continue;
    ids.add(feature.id);
    parts.forEach((p, i) => {
      if (matches[i]) return;
      const key = JSON.stringify([feature.properties.render_height, feature.properties.render_min_height, p]);
      if (seen.has(key)) return;
      seen.add(key);
      replacements.push({ id: feature.id!, type: 'Feature', properties: feature.properties, geometry: { type: 'Polygon', coordinates: p } });
    });
  }
  return { ids: [...ids], data: { type: 'FeatureCollection' as const, features: replacements } };
}

export function screenPolygon(feature: TileBuilding, point: Point, project: (coordinate: Point, height: number) => Point): Polygon | undefined {
  const parts = polygons(feature.geometry), height = Number(feature.properties.render_height) || 0, base = Number(feature.properties.render_min_height) || 0;
  for (const polygon of parts) {
    const roof = polygon[0].map(p => project(p, height));
    if (insideRing(point, roof)) return polygon;
    const ground = polygon[0].map(p => project(p, base));
    for (let i = 1; i < roof.length; i++) {
      if (insideRing(point, [roof[i - 1], roof[i], ground[i], ground[i - 1]])) return polygon;
    }
  }
  return undefined;
}
export function interiorPoint(polygon: Polygon): Point {
  const ring = polygon[0];
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!length) continue;
    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    for (const sign of [-1, 1]) {
      const p = [midpoint[0] - sign * (b[1] - a[1]) / length * .000001, midpoint[1] + sign * (b[0] - a[0]) / length * .000001];
      if (insideRing(p, ring)) return p;
    }
  }
  return ring[0];
}
