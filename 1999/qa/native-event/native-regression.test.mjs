import test, {resourceTestsEnabled} from '../resource-test.mjs';
import assert from 'node:assert/strict';
import {composer,drill,harness,bindComposer,bindKeyPracticeInput,composerText,nativeDrillUnits,glyphs,commits,nativeSequence} from './harness.mjs';

test('native input-only Korean text and colon/semicolon are accepted literally',()=>{
 const h=composer();h.edit('한글:;',{data:'한글:;'});
 assert.equal(composerText(h.c.state),'한글:;');assert.equal(commits(h).length,1);
 assert.equal(commits(h)[0].acceptedKeystrokes,null);h.c.destroy();
});
for(const tail of ['input-first','end-first']){
 test(`native short-text terminal ${tail} commits once; fresh same-data append remains distinct`,()=>{
  const h=composer();nativeSequence(h,['ㄱ','가','간','가나'],tail);
  assert.equal(h.el.value,'가나');assert.equal(commits(h).length,1);
  h.edit('가나가나',{data:'가나'});assert.equal(composerText(h.c.state),'가나가나');assert.equal(commits(h).length,2);h.c.destroy();
 });
 test(`native drill terminal ${tail} scores components once and accepts repeated text`,()=>{
  const h=drill();nativeSequence(h,['ㄱ','가','간','가나'],tail);
  assert.deepEqual(glyphs(h),['ㄱ','ㅏ','ㄴ','ㅏ']);assert.equal(h.el.value,'가나');
  h.edit('가나가나',{data:'가나'});assert.deepEqual(glyphs(h),['ㄱ','ㅏ','ㄴ','ㅏ','ㄱ','ㅏ','ㄴ','ㅏ']);h.c.destroy();
 });
}
test('physical key then first Process/229 native key transfers ownership before compositionstart',()=>{
 const h=composer();h.fire('keydown',{key:'r',code:'KeyR'});
 const e=h.fire('keydown',{key:'Process',code:'KeyS',isComposing:false,keyCode:229});assert.equal(e.defaultPrevented,false);
 nativeSequence(h,['ㄱㄴ','ㄱ나']);assert.equal(h.el.value,'ㄱ나');assert.equal(commits(h).length,2);h.c.destroy();
});
for(const late of [false,true])test(`native commit followed by real hardware survives ${late?'late':'already consumed'} terminal input`,()=>{
 const h=composer();h.fire('compositionstart');h.edit('한',{isComposing:true,inputType:'insertCompositionText'});h.fire('compositionend',{data:'한'});
 if(!late)h.fire('input',{inputType:'insertText',data:'한',isComposing:false});
 h.fire('keydown',{key:'r',code:'KeyR'});h.fire('keydown',{key:'k',code:'KeyK'});
 if(late)h.edit('한',{data:'한'});
 assert.equal(h.el.value,'한가');assert.equal(composerText(h.c.state),'한가');h.c.destroy();
});
for(const factory of [composer,drill]){
 test(`${factory.name}: uppercase hardware KeyO is not Shift; actual Shift is preserved`,()=>{
  for(const [fields,expected]of [[{shiftKey:false},'ㅐ'],[{shiftKey:false,capsLock:true},'ㅐ'],[{shiftKey:true},'ㅒ']]){
   const h=factory();h.fire('keydown',{key:'O',code:'KeyO',...fields});
   assert.equal(factory===composer?h.el.value:glyphs(h)[0],expected);h.c.destroy();
  }
 });
 test(`${factory.name}: code-less autoCaps O and intentional Shift O remain separate in two-set`,()=>{
  for(const [shiftKey,expected]of [[false,'ㅐ'],[true,'ㅒ']]){
   const h=factory();h.fire('keydown',{key:'O',code:'',shiftKey});
   assert.equal(factory===composer?h.el.value:glyphs(h)[0],expected);h.c.destroy();
  }
 });
 test(`${factory.name}: immediate software English-key echo is suppressed exactly once`,()=>{
  const h=factory();const e=h.fire('keydown',{key:'a',code:'',shiftKey:false});assert.equal(e.defaultPrevented,true);
  h.fire('beforeinput',{inputType:'insertText',data:'a',isComposing:false});
  h.edit('a',{data:'a'});
  assert.equal(factory===composer?h.el.value:glyphs(h).join(''),'ㅁ');
  if(factory===drill)assert.equal(h.el.value,'');h.c.destroy();
 });
 test(`${factory.name}: native shifted colon and semicolon stay literal, hardware Shift+Semicolon still works`,()=>{
  const h=factory();const e=h.fire('keydown',{key:':',code:'Semicolon',shiftKey:false});assert.equal(e.defaultPrevented,false);
  h.edit(':',{data:':'});h.edit(':;',{data:';'});
  assert.equal(factory===composer?h.el.value:glyphs(h).join(''),':;');
  h.fire('keydown',{key:':',code:'Semicolon',shiftKey:true});
  assert.equal(factory===composer?h.el.value:glyphs(h).join(''),':;:');h.c.destroy();
 });
 test(`${factory.name}: active native composition has no programmatic buffer/caret writes`,()=>{
  const h=factory();h.fire('compositionstart');
  for(const value of ['ㄱ','가','간','가나']){const edit=h.edit(value,{isComposing:true,inputType:'insertCompositionText'});assert.deepEqual(edit.after,edit.before);}
  h.fire('compositionend',{data:'가나'});assert.equal(h.el.value,'가나');h.c.destroy();
 });
 test(`${factory.name}: focus-policy reset and blur do not destroy native preedit`,()=>{
  const h=factory();h.fire('compositionstart');h.edit('한',{isComposing:true,inputType:'insertCompositionText'});
  const before=[h.el.value,h.el.selectionStart,h.writes,h.selections];h.fire('blur');h.fire('keyboardinputmodechange');h.fire('focus');
  assert.deepEqual([h.el.value,h.el.selectionStart,h.writes,h.selections],before);assert.equal(h.c.isComposing,true);
  h.fire('compositionend',{data:'한'});assert.equal(h.el.value,'한');h.c.destroy();
 });
}
for(const factory of [composer,drill]){
 for(const [gapMs,isFresh]of [[99,false],[100,true]])test(`${factory.name}: controlled ${gapMs} ms ${isFresh?'expired native insertion survives':'matching compatibility echo is suppressed'}`,()=>{
  const h=factory(),originalNow=Date.now;Date.now=h.now;
  try{
   h.fire('keydown',{key:'a',code:factory===composer?'':'KeyA',shiftKey:false});h.advance(gapMs);
   h.fire('beforeinput',{inputType:'insertText',data:factory===composer?'a':'ㅁ',isComposing:false});
   h.edit(factory===composer?'ㅁa':'ㅁ',{data:factory===composer?'a':'ㅁ'});
   if(factory===composer)assert.equal(h.el.value,isFresh?'ㅁa':'ㅁ');
   else {assert.deepEqual(glyphs(h),isFresh?['ㅁ','ㅁ']:['ㅁ']);assert.equal(h.el.value,isFresh?'ㅁ':'');}
  }finally{Date.now=originalNow;h.c.destroy();}
 });
 test(`${factory.name}: ownership reset clears matching echo even within the compatibility window`,()=>{
  const h=factory(),originalNow=Date.now;Date.now=h.now;
  try{
   h.fire('keydown',{key:'a',code:factory===composer?'':'KeyA',shiftKey:false});h.advance(50);h.fire('keyboardinputmodechange');
   h.fire('beforeinput',{inputType:'insertText',data:factory===composer?'a':'ㅁ',isComposing:false});
   h.edit(factory===composer?'ㅁa':'ㅁ',{data:factory===composer?'a':'ㅁ'});
   if(factory===composer)assert.equal(h.el.value,'ㅁa');else assert.deepEqual(glyphs(h),['ㅁ','ㅁ']);
  }finally{Date.now=originalNow;h.c.destroy();}
 });
}
test('native deletion remains live-preview-only before final commit',()=>{
 const h=composer();h.fire('compositionstart');h.edit('한',{isComposing:true,inputType:'insertCompositionText'});
 const deleted=h.edit('하',{isComposing:true,inputType:'deleteCompositionText',data:null});assert.deepEqual(deleted.after,deleted.before);assert.equal(commits(h).length,0);
 h.fire('compositionend',{data:'하'});assert.equal(composerText(h.c.state),'하');assert.equal(commits(h).length,1);h.c.destroy();
});
test('native code-less Backspace is observed once by the drill input delta',()=>{
 const h=drill();h.edit('한');const e=h.fire('keydown',{key:'Backspace',code:''});assert.equal(e.defaultPrevented,false);
 h.edit('하',{inputType:'deleteContentBackward',data:null});assert.deepEqual(glyphs(h),['ㅎ','ㅏ','ㄴ','Backspace']);h.c.destroy();
});
test('input-only conjoining jamo is preserved as supplied in text and decomposed only for drill scoring',()=>{
 const text='\u1100\u1161';const h=composer();h.edit(text);assert.equal(h.el.value,text);assert.equal(composerText(h.c.state),text);
 assert.deepEqual(nativeDrillUnits(text),['ㄱ','ㅏ']);h.c.destroy();
});
test('blur/refocus preserves the same hardware pending syllable under the app policy',()=>{
 const h=composer();h.fire('keydown',{key:'r',code:'KeyR'});h.fire('blur');h.fire('focus');h.fire('keydown',{key:'k',code:'KeyK'});
 assert.equal(h.el.value,'가');h.c.destroy();
});
test('destroyed composer captured late handlers cannot notify or mutate successor owner',()=>{
 const old=composer();old.fire('compositionstart');const lateEnd=old.listeners.get('compositionend')[0],lateInput=old.listeners.get('input')[0];old.c.destroy();old.el.isConnected=false;
 const next=composer();old.set('늦음');lateEnd({data:'늦음'});lateInput({data:'늦음',inputType:'insertText'});
 assert.equal(old.updates.length,0);assert.equal(next.el.value,'');next.fire('keydown',{key:'r',code:'KeyR'});assert.equal(next.el.value,'ㄱ');next.c.destroy();
});
test('destroyed drill captured late handlers cannot score after a successor is created',()=>{
 const old=drill();const lateEnd=old.el.oncompositionend,lateInput=old.el.oninput;old.c.destroy();old.el.isConnected=false;
 const next=drill();old.set('가');lateEnd({data:'가'});lateInput({data:'가',inputType:'insertText'});
 assert.deepEqual(glyphs(old),[]);assert.deepEqual(glyphs(next),[]);next.edit('ㅁ');assert.deepEqual(glyphs(next),['ㅁ']);next.c.destroy();
});
test('drill stops a multi-unit native batch synchronously when its owner is detached',()=>{
 const h=harness();const c=bindKeyPracticeInput(h.el,{hybridInput:true,physicalCharacter:e=>e.key,physicalAscii:e=>e.key,onAttempt:g=>{h.attempts.push(g);h.el.isConnected=false;}});
 h.edit('가나다');assert.deepEqual(h.attempts,['ㄱ']);c.destroy();
});
test('same-element composer rebinding disposes the old callbacks',()=>{
 const h=composer(),oldEnd=h.listeners.get('compositionend')[0],old=h.c;
 const newer=[];h.c=bindComposer(h.el,{hybridInput:true,onInput:r=>newer.push(r)});h.set('가');oldEnd({data:'가'});
 assert.equal(h.updates.length,0);h.fire('input',{data:'가',inputType:'insertText'});assert.equal(newer.length,1);old.destroy();h.c.destroy();
});
for(const factory of [composer,drill]){
 for(const layout of ['3','3-no-shift'])test(`${factory.name}: ${layout} genuine Shift and physical code retain selected mappings`,()=>{
  for(const [event,expected]of [
   [{key:'O',code:'',shiftKey:true},'9'],
   [{key:'O',code:'KeyO',shiftKey:true},'9'],
   [{key:'O',code:'KeyO',shiftKey:false,capsLock:true},'ㅊ'],
   [{key:'o',code:'',shiftKey:false},'ㅊ']
  ]){
   const h=factory({layout});h.fire('keydown',event);
   assert.equal(factory===composer?h.el.value:glyphs(h)[0],expected,JSON.stringify(event));h.c.destroy();
  }
 });
 for(const [layout,upper,lower]of [['us','O','o'],['dvorak','R','r']])test(`${factory.name}: ${layout} software uppercase and real Shift preserve English casing`,()=>{
  for(const [event,expected]of [
   [{key:'O',code:'',shiftKey:false},upper],
   [{key:'O',code:'',shiftKey:true},upper],
   [{key:'o',code:'',shiftKey:false},lower],
   [{key:'O',code:'KeyO',shiftKey:true},upper],
   [{key:'O',code:'KeyO',shiftKey:false},lower]
  ]){
   const h=factory({layout});h.fire('keydown',event);
   assert.equal(factory===composer?h.el.value:glyphs(h)[0],expected,JSON.stringify(event));h.c.destroy();
  }
 });
}
