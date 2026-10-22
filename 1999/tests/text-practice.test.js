import test from 'node:test';import assert from 'node:assert/strict';import {analyzePracticeInput}from'../text-practice.js';
test('ASCII error occupies whole Korean target cell',()=>{const r=analyzePracticeInput('가나','x나');assert.equal(r.complete,true);assert.equal(r.entries[0].columns,2);assert.equal(r.correctUnits,2)});
test('CJK input crossing ASCII then two-byte glyph aligns3columns',()=>{const r=analyzePracticeInput('a가b','나b');assert.equal(r.entries[0].columns,3);assert.equal(r.complete,true);assert.equal(r.correctUnits,1)});
test('full target accepts no extra character and reports terminating poll',()=>{const r=analyzePracticeInput('abc','abcd');assert.equal(r.acceptedText,'abc');assert.equal(r.overflow,'d');assert.equal(r.correctUnits,3);assert.equal(r.targetUnits,3)});
test('backspace recomputation restores aligned cursor and counters',()=>{const a=analyzePracticeInput('a가b','나b'),b=analyzePracticeInput('a가b','나');assert.equal(a.consumedColumns,4);assert.equal(b.consumedColumns,3);assert.equal(b.correctUnits,0);assert.equal(b.complete,false)});
test('original layout weights govern target metrics',()=>{const r=analyzePracticeInput('값','값','2');assert.equal(r.correctUnits,3);assert.equal(r.targetUnits,3)});

test('chart codes retain native malformed cross-width target-byte behavior',()=>{
 const ascii=analyzePracticeInput('가','x').entries[0];assert.equal(ascii.targetCode,0x88);
 const wide=analyzePracticeInput('a가b','나b').entries[0];assert.equal(wide.targetCode,0x6188);
});
