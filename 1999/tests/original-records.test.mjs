import test from 'node:test';
import assert from 'node:assert/strict';
import {createOriginalHistory,originalHistoryOpen,addOriginalHistorySample,insertOriginalGameScore,insertOriginalExamRecord,originalRecordDate,originalHistoryHeight} from '../original-records.js';
test('history keeps source truncation, weighting, and strict increasing slot thresholds',()=>{
 const h=createOriginalHistory();
 addOriginalHistorySample(h,{weight:10,speed:100,accuracy:90,seconds:300.9,date:'2026-10-21'});
 assert.equal(h.slots[0].seconds,300);assert.equal(h.index,0);
 addOriginalHistorySample(h,{weight:30,speed:200,accuracy:100,seconds:59.9,date:'2026-10-21'});
 assert.equal(h.slots[0].speed,175);assert.equal(h.slots[0].accuracy,97);assert.equal(h.index,0);
 addOriginalHistorySample(h,{weight:1,speed:100,accuracy:100,seconds:1,date:'2026-10-21'});
 assert.equal(h.index,1);assert.equal(h.slots[1].date,'2026-10-21');
 addOriginalHistorySample(h,{weight:1,speed:100,accuracy:100,seconds:600,date:'2026-10-21'});assert.equal(h.index,1);
 addOriginalHistorySample(h,{weight:1,speed:100,accuracy:100,seconds:60,date:'2026-10-21'});assert.equal(h.index,2);
 originalHistoryOpen(h,'2026-10-22');assert.equal(h.index,3);
});
test('history rollover retains duplicate last slot, matching source',()=>{
 const h=createOriginalHistory();h.index=359;h.slots[359]={weight:1,speed:7,accuracy:8,seconds:108000,date:'2026-10-20'};
 addOriginalHistorySample(h,{weight:1,speed:9,accuracy:10,seconds:60,date:'2026-10-21'});
 assert.equal(h.index,359);assert.equal(h.slots[358].speed,8);assert.equal(h.slots[359].speed,8);
 assert.equal(h.slots[358].date,'2026-10-20');assert.equal(h.slots[359].date,'2026-10-21');
});
test('game ranking is score then stage, stable ties, global top10',()=>{
 const rows=[{score:200,stage:1,id:'a'},{score:100,stage:2,id:'b'},{score:100,stage:1,id:'c'}];
 const r=insertOriginalGameScore(rows,{score:100,stage:2,id:'d'});
 assert.deepEqual(r.records.map(x=>x.id),['a','b','d','c']);
 assert.equal(insertOriginalGameScore(Array.from({length:10},()=>({score:100,stage:2})),{score:100,stage:2}).inserted,false);
});
test('exam top ties use effective units, recent10 are chronological',()=>{
 let s={top:null,recent:[]};
 s=insertOriginalExamRecord(s,{effectiveUnits:10,seconds:300,id:'a'});
 s=insertOriginalExamRecord(s,{effectiveUnits:11,seconds:300,id:'b'});assert.equal(s.top.id,'b');
 s=insertOriginalExamRecord(s,{effectiveUnits:11,seconds:300,id:'c'});assert.equal(s.top.id,'b');assert.equal(s.recent[0].id,'c');
});
test('source date full year and quantized chart height',()=>{
 assert.equal(originalRecordDate('2026-10-21'),'2026.10.21');
 assert.equal(originalHistoryHeight(109),42);assert.equal(originalHistoryHeight(499),198);assert.equal(originalHistoryHeight(500),200);
});
test('history graph exact x spacing and original later-page bound quirk',async()=>{
 const {originalHistoryPoints}=await import('../original-records.js');
 const h=createOriginalHistory();h.index=2;h.slots[0].date='2026-10-20';h.slots[1].date=h.slots[2].date='2026-10-21';
 let p=originalHistoryPoints(h,0);assert.equal(p.anchor.x,52);assert.deepEqual(p.points.map(p=>p.x),[59,68,77]);assert.deepEqual(p.annotations.map(p=>p.text),['10/21','10/20']);
 h.index=61;assert.equal(originalHistoryPoints(h,1).points.length,0);
 h.index=120;p=originalHistoryPoints(h,1);assert.equal(p.points.length,1);assert.equal(p.points[0].index,60);assert.equal(p.points[0].x,592);
});
test('exam progression preserves its separate non-clamping legacy branch',async()=>{
 const {originalExamProgressionNumerator:n}=await import('../original-records.js');
 assert.equal(n(21,11),10);assert.equal(n(3,5),5);assert.equal(n(5,5),5);assert.equal(n(0,5),0);
});
