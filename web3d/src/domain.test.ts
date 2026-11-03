// @ts-nocheck
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apartmentCell,effectiveExpenses,groupExpenses,issuePosition,totalExpenses} from './domain.ts';
test('120 unique apartment cells with apartment 45 at entrance 2, floor 5',()=>{const cells=Array.from({length:120},(_,i)=>apartmentCell(i+1));assert.equal(new Set(cells.map(c=>c.position.join(','))).size,120);assert.deepEqual([cells[44].entrance,cells[44].floor],[2,5]);assert.deepEqual([...new Set(cells.map(c=>c.floor))],[1,2,3,4,5,6,7,8,9]);for(const entrance of [1,2,3])assert.equal(cells.filter(c=>c.entrance===entrance).length,40)});
test('corrections drive exact money totals and category sums',()=>{const report={expenses:[{category:'Cleaning',amount:10}],corrections:[{expenses:[{category:'Cleaning',amount:20},{category:'Cleaning',amount:5},{category:'Salary',amount:30}]}]};const items=effectiveExpenses(report);assert.equal(totalExpenses(items),55);assert.deepEqual(groupExpenses(items),[['Cleaning',25],['Salary',30]]);assert.equal(report.expenses[0].amount,10)});
test('real locations map to distinct building and common-area coordinates',()=>{assert.notDeepEqual(issuePosition({entrance:1,floor:1,area:''}),issuePosition({entrance:2,floor:5,area:''}));assert.deepEqual(issuePosition({entrance:0,floor:0,area:'Playground'}),[-5,1,8])});
