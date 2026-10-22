import test from 'node:test';
import assert from 'node:assert/strict';
import { score, makeSession, updateSession, finishSession, sessionScore, readProgress, saveProgress, parseImportedText } from '../engine.js';
test('Korean committed text accuracy and speed', () => {
  assert.deepEqual(score('가나다', '가마', 60000), { correct:1, errors:1, entered:2, total:3, accuracy:50,cpm:1,complete:false,perfect:false });
});
test('unicode normalization and astral characters', () => { assert.equal(score('가😀', '\u1100\u1161😀', 60000).correct,2); });
test('empty input never divides by zero', () => { assert.equal(score('가','',0).cpm,0); });
test('overtyping is not perfect', () => { assert.equal(score('가','가나',1000).perfect,false); });
test('timer starts at first input, freezes at finish', () => {
 let s = updateSession(makeSession('가'), '가', 5000); s = finishSession(s,65000);
 assert.equal(sessionScore(s,125000).cpm,1); assert.equal(updateSession(s,'나',90000),s);
});
test('storage failures and malformed data are tolerated', () => {
 const broken = {getItem(){throw Error()},setItem(){throw Error()}};
 assert.deepEqual(readProgress(broken),[]); assert.equal(saveProgress(broken,[],{mode:'keys',cpm:10,accuracy:100}).length,1);
 assert.deepEqual(readProgress({getItem(){return '{}'}}),[]);
});
test('import normalizes line endings and BOM', () => { assert.equal(parseImportedText('\uFEFF가\r\n나\r'), '가\n나'); });
test('backspace corrects positional errors before submission',()=>{
 let s=makeSession('가나다');s=updateSession(s,'가마',1000);s=updateSession(s,'가',2000);s=updateSession(s,'가나다',61000);
 assert.equal(sessionScore(s,61000).accuracy,100);assert.equal(sessionScore(s,61000).cpm,3);
});
test('unfinished blank session does not start timing',()=>{const s=updateSession(makeSession('나'),' ',100);assert.equal(s.startedAt,100);assert.equal(updateSession(makeSession('나'),'',100).startedAt,null)});
test('storage retains at most last 100 records',()=>{let saved='';const store={setItem(k,v){saved=v}};const p=saveProgress(store,Array.from({length:100},()=>({mode:'keys',cpm:1,accuracy:100})),{mode:'words',cpm:2,accuracy:99});assert.equal(p.length,100);assert.equal(JSON.parse(saved).at(-1).mode,'words')});
test('text import capped before rendering',()=>{assert.equal(parseImportedText('a'.repeat(60000)).length,50000)});
import {keyUnits,originalGlyphUnits} from '../engine.js';
test('original partial Korean glyph aliases use component units',()=>{const alias=raw=>String.fromCodePoint(0xf0000+raw);assert.equal(originalGlyphUnits(alias(0x8000|(1<<10)|(2<<5)|2)),1);assert.equal(keyUnits(alias(0x8000|(2<<10)|(2<<5)|4)),3);assert.equal(keyUnits(alias(0x1f00)),1);assert.equal(originalGlyphUnits('a'),null)});
