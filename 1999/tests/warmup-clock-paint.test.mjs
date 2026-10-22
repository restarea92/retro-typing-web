import test, {resourceTestsEnabled} from '../qa/resource-test.mjs';
import assert from 'node:assert/strict';
const {createKeyPaintState,paintKeyGlyph,paintWarmupClockCue,warmupClockGuide} = resourceTestsEnabled ? await import('../original-key-paint.js') : {};
const {renderMappedKey} = resourceTestsEnabled ? await import('../input-composer.js') : {};
const rows=[['`',...'1234567890-=\\','BS'],['Tab',...'qwertyuiop[]'],['Caps',..."asdfghjkl;'",'Enter'],['Shift',...'zxcvbnm,./','Shift'],['Ctrl','Alt',' ','Alt','Ctrl']];
const state=layout=>createKeyPaintState(layout,rows);
test('initialized clock404 paints rawANK148 on KoreanG, not normalized jamo',()=>{
 const s=state('2');paintWarmupClockCue(s,404);
 assert.equal(s.cells.get('2:5').paint,'active');assert.equal(s.cells.get('2:5').label.codePointAt(0),0xf2094);
 assert.deepEqual([...s.fingers],[3]);assert.notEqual(s.cells.get('2:5').label,'ㅎ');
});
test('clock426 and next-row F retain independent finger writes; semicolon clears only its finger',()=>{
 const s=state('2');paintWarmupClockCue(s,426);paintKeyGlyph(s,renderMappedKey('2','f'),5);
 assert.deepEqual([...s.fingers].sort(),[3,7]);assert.equal(s.cells.get('1:10').label.codePointAt(0),0xf20aa);
 paintKeyGlyph(s,';',6);assert.deepEqual([...s.fingers],[3]);assert.equal(s.cells.get('1:10').paint,'active');
 assert.equal(s.cells.get('1:10').label.codePointAt(0),0xf20aa);
});
test('ordinary correct cleanup restores overwritten cap label and clears its own finger',()=>{
 const s=state('2');paintWarmupClockCue(s,404);paintKeyGlyph(s,renderMappedKey('2','g'),6);
 assert.equal(s.cells.get('2:5').paint,'stipple');assert.equal(s.cells.get('2:5').label,'ㅎ');assert.equal(s.fingers.size,0);
});
test('unmatched clock byte does not reset retained caps or fingers',()=>{
 const s=state('2');paintWarmupClockCue(s,426);const before=JSON.stringify([...s.cells]);paintWarmupClockCue(s,256);
 assert.equal(JSON.stringify([...s.cells]),before);assert.deepEqual([...s.fingers],[7]);
});
test('raw matching uses selected layout and original duplicate policy',()=>{
 assert.equal(warmupClockGuide('us',321).matches[0].ascii,'A');
 assert.equal(warmupClockGuide('dvorak',321).matches[0].ascii,'A');
 assert.deepEqual(warmupClockGuide('3',429).matches.map(m=>m.ascii),['v','/']);
 for(const layout of ['2','3-no-shift','us','dvorak','hiragana','katakana'])for(let byte=0;byte<256;byte++)assert.ok(warmupClockGuide(layout,256+byte).matches.length<=1);
});
test('whole-word BS and Space specials paint caps only, unlike low-byte aliases',()=>{
 for(const [word,cell,label]of [[8,'0:14','BS'],[32,'4:2','']]){
  const s=state('2');paintWarmupClockCue(s,word);assert.equal(s.cells.get(cell).paint,'active');assert.equal(s.cells.get(cell).label,label);assert.equal(s.fingers.size,0);
  const alias=state('2');paintWarmupClockCue(alias,word+256);assert.equal(alias.cells.get(cell).paint,'normal');assert.equal(alias.fingers.size,0);
 }
});
test('whole-word grave and tilde retain native negative-column ghost finger',()=>{
 const grave=state('us');paintWarmupClockCue(grave,96);assert.deepEqual([...grave.fingers],[-1]);assert.equal(grave.cells.get('0:0').paint,'active');
 const tilde=state('us');paintWarmupClockCue(tilde,126);assert.deepEqual([...tilde.fingers],[-1,7]);assert.equal(tilde.cells.get('3:11').paint,'active');
 for(const word of [352,382]){const s=state('us');paintWarmupClockCue(s,word);assert.equal(s.fingers.size,0);assert.equal(s.cells.get('0:0').paint,'normal');}
});
test('clock source is modulo256 only after whole-word specials, not screenshot constants',()=>{
 for(const word of [148,404,660,916,1172,1428,1684,1940,2196,2452,2708,2964,3220,3476]){
  const s=state('2');paintWarmupClockCue(s,word);assert.equal(s.cells.get('2:5').label.codePointAt(0),0xf2094);
 }
});
