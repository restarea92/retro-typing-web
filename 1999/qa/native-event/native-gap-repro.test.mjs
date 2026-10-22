import test, {resourceTestsEnabled} from '../resource-test.mjs';
import assert from 'node:assert/strict';
import {composer,drill,glyphs,composerText} from './harness.mjs';

// Regression acceptance assertions: red on the previous frozen runtime,
// green with the bounded stale-echo and selected-layout corrections.
// Event packets are synthetic; their occurrence on an actual iPhone is unknown.
test('GAP-01: drill hardware echo must not consume a new input-only native glyph after 2000 ms',()=>{
 const h=drill();h.fire('keydown',{key:'a',code:'KeyA',shiftKey:false});assert.deepEqual(glyphs(h),['ㅁ']);
 h.advance(2000);h.fire('beforeinput',{inputType:'insertText',data:'ㅁ',isComposing:false});h.edit('ㅁ',{data:'ㅁ'});
 console.log('GAP-01 observed',JSON.stringify({gapMs:2000,glyphs:glyphs(h),buffer:h.el.value,trace:h.trace}));h.c.destroy();
 assert.deepEqual(glyphs(h),['ㅁ','ㅁ']);
});
test('GAP-02: software Latin fallback echo must not erase a fresh input-only literal after 2000 ms',()=>{
 const h=composer(),originalNow=Date.now;let now=1000;Date.now=()=>now;
 try{
  h.fire('keydown',{key:'O',code:'',shiftKey:false});assert.equal(h.el.value,'ㅐ');
  now+=2000;h.advance(2000);h.fire('beforeinput',{inputType:'insertText',data:'O',isComposing:false});h.edit('ㅐO',{data:'O'});
  console.log('GAP-02 observed',JSON.stringify({gapMs:2000,value:h.el.value,state:composerText(h.c.state),trace:h.trace}));
  assert.equal(h.el.value,'ㅐO');
 }finally{Date.now=originalNow;h.c.destroy();}
});
test('GAP-03: code-less autoCaps O/no Shift must agree across composer and drill in both three-set layouts',()=>{
 const observed=[];
 for(const layout of ['3','3-no-shift']){
  const c=composer({layout}),d=drill({layout});const event={key:'O',code:'',shiftKey:false};c.fire('keydown',event);d.fire('keydown',event);
  observed.push({layout,composer:c.el.value,drill:glyphs(d)[0],ascii:d.attempts[0]?.ascii});c.c.destroy();d.c.destroy();
 }
 console.log('GAP-03 observed',JSON.stringify(observed));
 assert.deepEqual(observed,[{layout:'3',composer:'ㅊ',drill:'ㅊ',ascii:'o'},{layout:'3-no-shift',composer:'ㅊ',drill:'ㅊ',ascii:'o'}]);
});
