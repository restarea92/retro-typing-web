/** Numeric-only observations from the original40-line run. BIOS ticks are
 * source-constrained reconstructions, not native memory reads. No corpus,
 * screenshot, font, source executable or private filesystem path is needed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOriginalHistory,originalHistoryOpen,addOriginalHistorySample} from '../original-records.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/native-word40-history-20261022.json',import.meta.url),'utf8'));
test('all40 native word observations reproduce the saved history bit-for-bit',()=>{
 const date='2026-10-22',state=originalHistoryOpen(createOriginalHistory(),date),expected=fixture.expected;
 assert.equal(fixture.lines.length,40);
 assert.equal(fixture.lines.reduce((n,r)=>n+r.targetUnits,0),expected.totalTargetUnits);
 assert.equal(fixture.lines.reduce((n,r)=>n+r.correctUnits,0),expected.totalCorrectUnits);
 assert.equal(fixture.lines.reduce((n,r)=>n+r.elapsedTicks,0),expected.totalElapsedTicks);
 assert.equal(Math.max(...fixture.lines.map(r=>r.observedSpeed)),expected.bestLineSpeed);
 for(const row of fixture.lines)addOriginalHistorySample(state,{weight:row.correctUnits,speed:row.observedSpeed,accuracy:row.observedAccuracy,seconds:Math.fround(row.elapsedTicks*1800/32767),date});
 assert.equal(state.index,expected.historyIndex);
 assert.deepEqual(state.slots[0],{weight:expected.historyWeight,speed:expected.historySpeed,accuracy:expected.historyAccuracy,seconds:expected.historySeconds,date});
 const bytes=Buffer.alloc(4);bytes.writeFloatLE(state.slots[0].seconds);assert.equal(bytes.toString('hex'),expected.historySecondsFloat32LittleEndianHex);
 assert.ok(state.slots.slice(1).every(s=>!s.weight&&!s.speed&&!s.accuracy&&!s.seconds&&s.date===null));
 assert.notEqual(state.slots[0].speed,expected.cumulativeSpeed,'native history is weighted per-line speed, not aggregate session speed');
});
