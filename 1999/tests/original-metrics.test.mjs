import test from 'node:test';
import assert from 'node:assert/strict';
import {originalGlyphCode as code,originalKeyUnits as unit,originalTextUnits as total,BIOS_TICK_MS,originalElapsedTicks,originalMetrics,originalSeconds} from '../original-metrics.js';
test('original supported encoding and partial aliases',()=>{assert.equal(code('가'),0x8861);assert.equal(code('ㄱ'),0x8841);assert.equal(code('あ'),0x1f02);assert.equal(code(String.fromCodePoint(0xf0000+0x8442)),0x8442);assert.equal(code('🙂'),null);});
test('layout-specific packed Johab stroke weighting',()=>{
 assert.equal(total('가나다','korean2'),6);
 assert.equal(unit('까','korean2'),2);assert.equal(unit('까','korean3'),3);assert.equal(unit('까','korean3NoShift'),3);
 assert.equal(unit('의','korean2'),3);assert.equal(unit('의','korean3'),2);assert.equal(unit('의','korean3NoShift'),2);
 assert.equal(unit('괜','korean2'),4);assert.equal(unit('값','korean2'),3);assert.equal(unit('값','korean3'),3);
 assert.equal(unit('갂','korean2'),3);assert.equal(unit('갂','korean3'),3);assert.equal(unit('갂','korean3NoShift'),4);
 assert.equal(unit('갔','korean2'),3);assert.equal(unit('갔','korean3'),3);assert.equal(unit('갔','korean3NoShift'),3);
 assert.equal(unit('が','hiragana'),1);assert.equal(unit('パ','katakana'),1);assert.equal(total('ABC xyz','us'),7);
});
test('all11172 modern syllables encode to expected original field tables and sane units',()=>{
 for(let u=0xac00;u<=0xd7a3;u++)for(const layout of ['korean2','korean3','korean3NoShift']){const n=unit(String.fromCodePoint(u),layout);assert.ok(n>=2&&n<=6);assert.equal(n,unit(code(String.fromCodePoint(u)),layout));}
});
test('original exact BIOS ratio and zero-time fallback',()=>{
 assert.equal(originalSeconds(32767),1800);assert.ok(Math.abs(BIOS_TICK_MS-54.9333)<0.001);
 assert.equal(originalElapsedTicks(BIOS_TICK_MS*0.9,BIOS_TICK_MS*1.1),1);
 const r=originalMetrics({correctUnits:5,targetUnits:9,elapsedTicks:32767});assert.equal(r.accuracy,55);assert.equal(r.speed,0);
 const zero=originalMetrics({correctUnits:1,targetUnits:1,elapsedTicks:0});assert.equal(zero.speed,59999);assert.equal(zero.accuracy,100);
 assert.equal(originalMetrics({correctUnits:10,targetUnits:10,elapsedTicks:18}).speed,606);
 assert.equal(originalMetrics({correctUnits:10,targetUnits:10,elapsedMs:1000}).elapsedTicks,18);
});

test('original exam penalty and denominator are independent of practice target',async()=>{
 const {originalExamMetrics,ORIGINAL_SOUND_SEQUENCES}=await import('../original-metrics.js');
 const m=originalExamMetrics({correctUnits:100,wrongGlyphs:10,usedGlyphs:70,correctGlyphs:60,elapsedTicks:32767});
 assert.equal(m.effectiveUnits,90);assert.equal(m.accuracy,90);assert.equal(m.speed,3);
 assert.equal(originalExamMetrics({correctUnits:4,wrongGlyphs:9,elapsedTicks:18}).effectiveUnits,0);
 assert.equal(originalExamMetrics({elapsedTicks:0}).accuracy,0);
 assert.deepEqual(ORIGINAL_SOUND_SEQUENCES[2],[{hz:450,ms:55},{hz:650,ms:50},{hz:1000,ms:45}]);
});

 test('StringTypeLeng ignores a terminal lead but pairs an inserted space',()=>{
  assert.equal(total('あいだあい\u001f','hiragana'),5);
  assert.equal(total('あいだあい\u001f あ','hiragana'),7);
  assert.equal(total('a\0b','us'),1);
  assert.equal(unit(0x1f00,'hiragana'),1);
 });
