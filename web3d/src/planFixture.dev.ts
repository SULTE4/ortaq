import type { Snapshot } from './types';

// Opt-in screenshot fixture. The Vite middleware serves a canvas drawing, never the backend.
export function withPlanFixture(snapshot: Snapshot): Snapshot {
  if (new URLSearchParams(location.search).get('planFixture') !== '1' || snapshot.building.id !== 1) return snapshot;
  return { ...snapshot, building: { ...snapshot.building, plan_images: { ...snapshot.building.plan_images, '4': '/api/v1/media/1/r11-fixture.png' } } };
}
