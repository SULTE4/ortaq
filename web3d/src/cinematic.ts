import type { Issue, Vec3 } from "./types.ts";
import { S } from "./strings.ts";
export const duration = 90;
// Precise GSAP time for frame animation; UI state is sampled at 10 Hz.
export const cinematicClock = { time: 0 };
export function chapterAt(time: number): number {
  return Math.min(8, Math.max(0, Math.floor(time / 10)));
}
export function scriptIssue(time: number): Issue {
  const status = time >= 40 ? "Resolved" : time >= 30 ? "In Progress" : "New";
  return {
    id: "cinematic-radiator",
    building_id: 1,
    reporter: 4,
    title: S.scriptedIssue,
    description: S.scriptedDescription,
    category: "Heating",
    location: { entrance: 2, floor: 5, area: "" },
    photo: "/media/seed/issue.png",
    status,
    contractor: time >= 30 ? "Astana Plumbing" : "",
    result_photo: time >= 40 ? "/media/seed/result.png" : "",
    history: [],
    supporters: time >= 20 ? [44, 46, 49] : [],
    created_at: "2026-01-01T00:00:00Z",
  };
}
const shots: { position: Vec3; target: Vec3 }[] = [
  { position: [-40, 25, 35], target: [0, 5, 1] },
  { position: [15, 12, 24], target: [0, 6, 2] },
  { position: [7, 10, 22], target: [0, 6, 2] },
  { position: [16, 9, 24], target: [-3, 3, 6] },
  { position: [8, 12, 23], target: [0, 6, 2] },
  { position: [-30, 21, 28], target: [-12, 5, 0] },
  { position: [24, 23, 33], target: [0, 6, 1] },
  { position: [15, 21, 30], target: [0, 8, 0] },
  { position: [40, 33, 53], target: [-8, 6, -10] },
  { position: [48, 38, 62], target: [-8, 6, -12] },
];
export function cameraAt(time: number): { position: Vec3; target: Vec3 } {
  const chapter = chapterAt(time);
  let t = Math.min(1, (time - chapter * 10) / 10);
  t = t * t * (3 - 2 * t);
  const from = shots[chapter],
    to = shots[chapter + 1];
  const lerp = (a: Vec3, b: Vec3) =>
    a.map((v, i) => v + (b[i] - v) * t) as Vec3;
  const position = lerp(from.position, to.position);
  if (chapter === 0) {
    const angle =
      Math.atan2(from.position[0], from.position[2]) +
      (Math.atan2(to.position[0], to.position[2]) -
        Math.atan2(from.position[0], from.position[2])) *
        t;
    const radius =
      Math.hypot(from.position[0], from.position[2]) +
      (Math.hypot(to.position[0], to.position[2]) -
        Math.hypot(from.position[0], from.position[2])) *
        t;
    position[0] = Math.sin(angle) * radius;
    position[2] = Math.cos(angle) * radius;
  }
  return { position, target: lerp(from.target, to.target) };
}
export function scriptVotes(time: number): number {
  return time < 70 ? 0 : Math.min(100, Math.floor((time - 70) * 14));
}
