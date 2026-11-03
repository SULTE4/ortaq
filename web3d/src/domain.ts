import type { Expense, Location, Report, Vec3 } from "./types.ts";
export const statusColors = {
  New: "#ef6b77",
  "In Progress": "#f2b64f",
  Resolved: "#38c79e",
};
export const categoryColors: Record<string, string> = {
  Cleaning: "#49c8c2",
  Elevator: "#9c8aee",
  Security: "#f0b65e",
  Utilities: "#62a6fa",
  Repairs: "#ef8585",
  Salary: "#83a8c5",
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(n);
export function effectiveExpenses(r: Report): Expense[] {
  return r.corrections.length
    ? r.corrections[r.corrections.length - 1].expenses
    : r.expenses;
}
// 40 cells per entrance; the demo's apt 45 and apt 61 exchange cells so apt 45 is on floor 5.
export function apartmentCell(apt: number): {
  position: Vec3;
  entrance: number;
  floor: number;
} {
  const entrance = Math.floor((apt - 1) / 40) + 1;
  let local = (apt - 1) % 40;
  if (apt === 45) local = 20;
  if (apt === 61) local = 4;
  let floor: number, col: number;
  if (local < 20) {
    floor = Math.floor(local / 5) + 1;
    col = local % 5;
  } else {
    floor = Math.floor((local - 20) / 4) + 5;
    col = (local - 20) % 4;
  }
  const count = floor < 5 ? 5 : 4;
  return {
    position: [
      (entrance - 2) * 8 + (col - (count - 1) / 2) * 1.2,
      1.1 + (floor - 0.5) * 1.16,
      2.16,
    ],
    entrance,
    floor,
  };
}
export function issuePosition(l: Location): Vec3 {
  if (l.area) {
    return (
      (
        {
          Courtyard: [0, 1, 8],
          Playground: [-5, 1, 8],
          Parking: [9, 1, 10],
          Gate: [-12, 1, 12],
        } as Record<string, Vec3>
      )[l.area] ?? [0, 1, 8]
    );
  }
  return [(l.entrance - 2) * 8, 1.2 + (l.floor - 0.5) * 1.16, 3.15];
}
export function groupExpenses(items: Expense[]): [string, number][] {
  const groups = new Map<string, number>();
  for (const e of items)
    groups.set(e.category, (groups.get(e.category) ?? 0) + e.amount);
  return [...groups];
}
export const totalExpenses = (items: Expense[]) =>
  items.reduce((sum, e) => sum + e.amount, 0);
