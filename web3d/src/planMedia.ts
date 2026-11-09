import type { ManagedBuilding } from './buildingModel';
import { apartmentAddress, floorPlansFor } from './apartmentPlan';

export function planImageFor(building: ManagedBuilding, apartment: number): string | undefined {
  try {
    const { plans } = floorPlansFor(building.floor_plan, building.entrance_plans, building.apartments, building.entrances ?? 1, building.floors);
    const { entrance, position } = apartmentAddress(apartment, building.floors, plans);
    const key = building.entrance_plans?.[String(entrance)] ? `${entrance}:${position}` : String(position);
    return building.plan_images?.[key];
  } catch { return; }
}

export async function loadPlanMedia(path: string, building: number, token: string, signal: AbortSignal) {
  // Only the current building's authenticated media route may receive the token.
  const prefix = `/api/v1/media/${building}/`;
  if (!token || !path.startsWith(prefix) || !/^[\w.-]+$/.test(path.slice(prefix.length)))
    throw Error('Invalid plan media');
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, signal, redirect: 'error' });
  if (!response.ok) throw Error('Plan unavailable');
  const blob = await response.blob();
  const type = blob.type.split(';')[0].toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(type) || !blob.size)
    throw Error('Unsupported plan media');
  return { blob, pdf: type === 'application/pdf' };
}
