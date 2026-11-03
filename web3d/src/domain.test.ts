// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apartmentCell,
  effectiveExpenses,
  groupExpenses,
  issuePosition,
  totalExpenses,
} from "./domain.ts";
test("120 unique apartment cells with apartment 45 at entrance 2, floor 5", () => {
  const cells = Array.from({ length: 120 }, (_, i) => apartmentCell(i + 1));
  assert.equal(new Set(cells.map((c) => c.position.join(","))).size, 120);
  assert.deepEqual([cells[44].entrance, cells[44].floor], [2, 5]);
  assert.deepEqual(
    [...new Set(cells.map((c) => c.floor))],
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  for (const entrance of [1, 2, 3])
    assert.equal(cells.filter((c) => c.entrance === entrance).length, 40);
});
test("corrections drive exact money totals and category sums", () => {
  const report = {
    expenses: [{ category: "Cleaning", amount: 10 }],
    corrections: [
      {
        expenses: [
          { category: "Cleaning", amount: 20 },
          { category: "Cleaning", amount: 5 },
          { category: "Salary", amount: 30 },
        ],
      },
    ],
  };
  const items = effectiveExpenses(report);
  assert.equal(totalExpenses(items), 55);
  assert.deepEqual(groupExpenses(items), [
    ["Cleaning", 25],
    ["Salary", 30],
  ]);
  assert.equal(report.expenses[0].amount, 10);
});
test("real locations map to distinct building and common-area coordinates", () => {
  assert.notDeepEqual(
    issuePosition({ entrance: 1, floor: 1, area: "" }),
    issuePosition({ entrance: 2, floor: 5, area: "" }),
  );
  assert.deepEqual(
    issuePosition({ entrance: 0, floor: 0, area: "Playground" }),
    [-5, 1, 8],
  );
});
import { cameraAt, chapterAt, scriptIssue, scriptVotes } from "./cinematic.ts";
test("cinematic chapters and issue workflow are deterministic at boundaries", () => {
  assert.equal(chapterAt(0), 0);
  assert.equal(chapterAt(90), 8);
  assert.equal(scriptIssue(10).status, "New");
  assert.equal(scriptIssue(20).supporters.length, 3);
  assert.equal(scriptIssue(30).status, "In Progress");
  assert.equal(scriptIssue(40).status, "Resolved");
  assert.equal(scriptVotes(79), 100);
  assert.equal(scriptVotes(69), 0);
});
test("camera follows a finite continuous path at all chapter boundaries", () => {
  for (let time = 0; time <= 90; time += 0.1) {
    const camera = cameraAt(time);
    assert.ok([...camera.position, ...camera.target].every(Number.isFinite));
  }
  for (let time = 10; time < 90; time += 10) {
    const before = cameraAt(time - 0.001).position,
      after = cameraAt(time).position;
    assert.ok(Math.hypot(...before.map((v, i) => v - after[i])) < 0.01);
  }
});
