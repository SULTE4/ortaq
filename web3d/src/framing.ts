import type { Vec3 } from "./types.ts";
import { buildingFootprint } from "./domain.ts";

export type Rect = { left: number; top: number; right: number; bottom: number };
export type Bounds = { min: Vec3; max: Vec3; points?: Vec3[] };
export const homeBounds: Bounds = {
  min: [-17.5, 0, -12], max: [25.5, 12.7, 16],
  // Empty air above the courtyard must not push the camera back like a solid box.
  points: [
    ...buildingFootprint.flatMap(([x, z]) => [[x, 0, z], [x, 12.7, z]] as Vec3[]),
    ...[-7, 20.2].flatMap(x => [-1, 8.4].map(z => [x, 0, z] as Vec3)),
  ],
};

export function filmBounds(time: number): Bounds {
  const smooth = (start: number, end: number) => {
    const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
    return t * t * (3 - 2 * t);
  };
  const spread = smooth(76, 84), fund = smooth(40, 50) * (1 - smooth(60, 70));
  const points: Vec3[] = [
    ...homeBounds.points!.map(([x, y, z]) => [x - (x < 0 ? 16 * fund : 0), y, z] as Vec3),
    ...homeBounds.points!.map(([x, y, z]) => [x * (1 + spread * 3), y, z * (1 + spread * 3)] as Vec3),
  ];
  return {
    min: [Math.min(...points.map(p => p[0])), 0, Math.min(...points.map(p => p[2]))],
    max: [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1])), Math.max(...points.map(p => p[2]))],
    points,
  };
}

// Fit in the HUD's clear rectangle, including perspective depth at every corner.
export function fittedShot(target: Vec3, direction: Vec3, bounds: Bounds, area: Rect, width: number, height: number, fill = .92) {
  const length = Math.hypot(...direction), d = direction.map(v => v / length);
  const horizontal = Math.hypot(d[0], d[2]);
  const right = [d[2] / horizontal, 0, -d[0] / horizontal];
  const up = [d[1] * right[2], d[2] * right[0] - d[0] * right[2], -d[1] * right[0]];
  const tangent = Math.tan(43 * Math.PI / 360);
  const fitX = tangent * (area.right - area.left) / height * fill;
  const fitY = tangent * (area.bottom - area.top) / height * fill;
  let distance = 12;
  const points = bounds.points ?? [bounds.min[0], bounds.max[0]].flatMap(x =>
    [bounds.min[1], bounds.max[1]].flatMap(y => [bounds.min[2], bounds.max[2]].map(z => [x, y, z] as Vec3)));
  for (const [x, y, z] of points) {
    const p = [x - target[0], y - target[1], z - target[2]];
    const dot = (axis: number[]) => p.reduce((sum, v, i) => sum + v * axis[i], 0);
    distance = Math.max(distance, dot(d) + Math.abs(dot(right)) / fitX, dot(d) + Math.abs(dot(up)) / fitY);
  }
  return {
    position: target.map((v, i) => v + d[i] * distance) as Vec3,
    target, distance,
    offset: [width / 2 - (area.left + area.right) / 2, height / 2 - (area.top + area.bottom) / 2],
  };
}

export function entranceBounds(entrance: number, position: Vec3): Bounds {
  return entrance === 3
    ? { min: [position[0] - 1, 0, position[2] - 5.3], max: [position[0] + 1.5, 12.7, position[2] + 5.3] }
    : { min: [position[0] - 6.7, 0, position[2] - 1], max: [position[0] + 6.7, 12.7, position[2] + 1.5] };
}

export function labelPlacement(x: number, y: number, width: number, height: number, area: Rect, obstacles: Rect[]): Rect | null {
  const intersects = (a: Rect, b: Rect) => a.left < b.right + 8 && a.right > b.left - 8 && a.top < b.bottom + 8 && a.bottom > b.top - 8;
  for (const [dx, dy] of [[-width / 2, -height - 12], [-width - 18, -height / 2], [18, -height / 2], [-width / 2, 18]]) {
    const box = { left: x + dx, top: y + dy, right: x + dx + width, bottom: y + dy + height };
    if (box.left >= area.left && box.right <= area.right && box.top >= area.top && box.bottom <= area.bottom && !obstacles.some(other => intersects(box, other))) return box;
  }
  return null;
}

// Metre-space map fit is independent of the map's previous padding and zoom.
export function mapFitZoom(points: [number, number][], buildingMetres: number, latitude: number, bearingDegrees: number, pitchDegrees: number, width: number, height: number): number {
  const bearing = bearingDegrees * Math.PI / 180, pitch = pitchDegrees * Math.PI / 180;
  const horizontal = points.map(([east, north]) => east * Math.cos(bearing) - north * Math.sin(bearing));
  const vertical = points.map(([east, north]) => east * Math.sin(bearing) + north * Math.cos(bearing));
  const spanX = Math.max(1, Math.max(...horizontal) - Math.min(...horizontal));
  const spanY = Math.max(1, (Math.max(...vertical) - Math.min(...vertical)) * Math.cos(pitch) + buildingMetres * Math.sin(pitch));
  const pixelsPerMetre = Math.min(width * .8 / spanX, height * .8 / spanY);
  return Math.min(20, Math.log2(pixelsPerMetre * 40075016.686 * Math.cos(latitude * Math.PI / 180) / 512));
}
