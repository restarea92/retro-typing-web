import test from 'node:test';import assert from 'node:assert/strict';
import {loadOriginalSpeedHistory,appendOriginalSpeedHistory} from '../original-history-store.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
test('native speed history is independent of exercise record cap and advances date once',()=>{const s=storage(),h=loadOriginalSpeedHistory(s,'2026-10-21');appendOriginalSpeedHistory(h,{weight:10,speed:100,accuracy:90,seconds:20,date:'2026-10-21'},s);const next=loadOriginalSpeedHistory(s,'2026-10-22');assert.equal(next.index,1);assert.equal(next.slots[0].speed,100);assert.equal(loadOriginalSpeedHistory(s,'2026-10-22').index,1);});
test('invalid history shape recovers without blocking startup',()=>{const h=loadOriginalSpeedHistory({getItem:()=>'{"index":999,"slots":[]}',setItem(){}},'2026-10-21');assert.equal(h.slots.length,360);assert.equal(h.index,0);});
