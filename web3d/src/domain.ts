import {
  apartmentAddress,
  clipOutline,
  createApartmentPlan,
  defaultFloorPlan,
  sauranEntrancePlans,
  type EntranceSection,
} from "./apartmentPlan.ts";
import type { Expense, Location, Report, Vec3 } from "./types.ts";

export const statusColors = {
  New: "#C94B4B",
  "In Progress": "#C78018",
  Resolved: "#1D835C",
};

export const categoryColors: Record<string, string> = {
  Cleaning: "#0E6E7D",
  Elevator: "#6C7D8E",
  Security: "#D18629",
  Utilities: "#3C88A0",
  Repairs: "#B46550",
  Salary: "#1D835C",
};

export const money = (n: number) =>
  "₸" +
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
    .format(n)
    .replace(/,/g, " ");

export function effectiveExpenses(r: Report): Expense[] {
  return r.corrections.length
    ? r.corrections[r.corrections.length - 1].expenses
    : r.expenses;
}

// OSM way 425124327, docs/ux-review/real-building-footprint.json.
// Rotate the surveyed outline as a whole; one scene unit is 2.5 metres.
export const footprintMetres: [number, number][] = [
  [-33.7, -8.66],
  [-25.36, 26.59],
  [-12.65, 23.62],
  [-18.21, 0.1],
  [46.35, -14.96],
  [43.57, -26.69],
];
const bearing = Math.atan2(-15.06, 64.56);
export function mapToScene([x, north]: readonly number[]): [number, number] {
  return [
    (x * Math.cos(bearing) + north * Math.sin(bearing)) * 0.4,
    (-x * Math.sin(bearing) + north * Math.cos(bearing)) * 0.4,
  ];
}
export const buildingFootprint = footprintMetres.map(mapToScene);
export const floorHeight = 1.2;
export const buildingHeight = 9 * floorHeight;
export const entranceLayout = [
  { entrance: 1, position: [-0.4, 0, -1.62] as Vec3, rotation: 0, length: 13 },
  {
    entrance: 2,
    position: [12.7, 0, -1.62] as Vec3,
    rotation: 0,
    length: 13,
  },
  {
    entrance: 3,
    position: [-7.08, 0, 3.2] as Vec3,
    rotation: Math.PI / 2,
    length: 9.4,
  },
];
export function apartmentLocation(apt: number): {
  entrance: number;
  floor: number;
} {
  const { entrance, floor } = apartmentAddress(apt, 9, sauranPlans);
  return { entrance, floor };
}
export type { ApartmentWindow, FacadeWindow } from "./apartmentPlan.ts";
const [
  westBase,
  westEnd,
  courtyardEnd,
  courtyardCorner,
  eastCourtyard,
  eastStreet,
] = buildingFootprint;
const streetRatio =
  (courtyardCorner[0] - westBase[0]) / (eastStreet[0] - westBase[0]);
const streetCorner: [number, number] = [
  courtyardCorner[0],
  westBase[1] + (eastStreet[1] - westBase[1]) * streetRatio,
];
const southWing = [streetCorner, courtyardCorner, eastCourtyard, eastStreet];
export const sauranSections: EntranceSection[] = entranceLayout.map(
  (layout, i) => ({
    ...layout,
    rotation: i === 2 ? -Math.PI / 2 : layout.rotation,
    frontSide: i === 2 ? "street" : "courtyard",
    exterior: buildingFootprint,
    outline:
      i === 2
        ? [westBase, westEnd, courtyardEnd, courtyardCorner, streetCorner]
        : clipOutline(southWing, 0, 6.15, i === 1),
  }),
);
const sauranPlans = sauranSections.map(
  (section) => sauranEntrancePlans[String(section.entrance)] ?? defaultFloorPlan,
);
export const sauranPlan = createApartmentPlan(
  sauranSections,
  9,
  sauranPlans,
  floorHeight,
);
export function apartmentWindows(apt: number) {
  apartmentLocation(apt);
  return sauranPlan.windows.filter(
    (w) => w.apartment === apt,
  ) as import("./apartmentPlan.ts").ApartmentWindow[];
}
export const allApartmentWindows = sauranPlan.windows.filter(
  (w) => w.apartment !== null,
);
export const stairwellWindows = sauranPlan.windows.filter(
  (w) => w.apartment === null,
);
export const allFacadeWindows = sauranPlan.windows;
export function apartmentFocus(apt: number): Vec3 {
  apartmentLocation(apt);
  return sauranPlan.cells.find((c) => c.apartment === apt)!.centre;
}
function facadePosition(
  entrance: number,
  along: number,
  y: number,
  depth: number,
): Vec3 {
  const layout = entranceLayout[entrance - 1];
  const c = Math.cos(layout.rotation),
    s = Math.sin(layout.rotation);
  return [
    layout.position[0] + along * c + depth * s,
    y,
    layout.position[2] - along * s + depth * c,
  ];
}
export function issuePosition(l: Location): Vec3 {
  if (l.area) return facadePosition(1, 0, 0.8, 0.55);
  return facadePosition(l.entrance, 0, (l.floor - 0.5) * floorHeight, 0.55);
}
export function groupExpenses(items: Expense[]): [string, number][] {
  const groups = new Map<string, number>();
  for (const e of items)
    groups.set(e.category, (groups.get(e.category) ?? 0) + e.amount);
  return [...groups];
}
export const totalExpenses = (items: Expense[]) =>
  items.reduce((sum, e) => sum + e.amount, 0);
