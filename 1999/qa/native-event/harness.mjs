import {resourceTestsEnabled} from '../resource-test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {after} from 'node:test';

export const sourceDir=new URL('../../',import.meta.url);
const files=['app.js','input-composer.js','key-practice-input.js','keyboard-input-bridge.js'];
export const hashes=()=>Object.fromEntries(files.map(file=>[
 file,crypto.createHash('sha256').update(fs.readFileSync(new URL(file,sourceDir))).digest('hex')
]));
const before=hashes();
console.log('SOURCE_SHA256',JSON.stringify(before));
console.log('EVIDENCE: isolated simulated DOM/event packets only; no UI, OS IME, Safari, iPhone, deployment, or paste evidence.');
after(()=>assert.deepEqual(hashes(),before,'runtime files must remain unchanged'));

export const {bindComposer,composerText,physicalKey,renderMappedKey,isNativeInputKey,isCompositionCommit}=resourceTestsEnabled ? await import(new URL('input-composer.js',sourceDir)) : {};
export const {bindKeyPracticeInput,nativeDrillUnits}=resourceTestsEnabled ? await import(new URL('key-practice-input.js',sourceDir)) : {};

// Deliberately minimal deterministic event model. Native edits are supplied by
// tests, not executed by a real browser. Retained callbacks test disposal guards.
export function harness(){
 const listeners=new Map(),updates=[],attempts=[],trace=[];let value='',writes=0,selections=0,time=1000;
 const el={isConnected:true,readOnly:false,disabled:false,selectionStart:0,selectionEnd:0,
  get value(){return value},set value(v){value=String(v);writes++;trace.push({write:value})},
  addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list)},
  removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(x=>x!==fn))},
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;selections++}
 };
 const fire=(type,fields={})=>{
  const event={type,target:el,currentTarget:el,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},...fields};
  trace.push({at:time,type,...fields});el['on'+type]?.(event);
  for(const fn of [...(listeners.get(type)||[])])fn(event);
  return event;
 };
 const set=(text,start=text.length,end=start)=>{el.value=text;el.selectionStart=start;el.selectionEnd=end};
 const edit=(text,{inputType='insertText',data=text,isComposing=false,...fields}={})=>{
  set(text);const counts=[writes,selections];
  const event=fire('input',{inputType,data,isComposing,...fields});
  return {event,before:counts,after:[writes,selections]};
 };
 return {el,listeners,updates,attempts,trace,fire,set,edit,now:()=>time,advance(ms){time+=ms},
  get writes(){return writes},get selections(){return selections}};
}
export function composer(options={}){
 const h=harness();h.c=bindComposer(h.el,{layout:'2',hybridInput:true,nativePreview:true,commitOnBlur:false,onInput:r=>h.updates.push(r),...options});return h;
}
export function drill(options={}){
 const h=harness(),layout=options.layout||'2';
 h.c=bindKeyPracticeInput(h.el,{hybridInput:true,now:h.now,
  physicalAscii:e=>physicalKey(e,layout),
  physicalCharacter:e=>{const p=physicalKey(e,layout);return p===null?null:renderMappedKey(layout,p)},
  onAttempt:(glyph,ascii)=>h.attempts.push({glyph,ascii}),...options});return h;
}
export const glyphs=h=>h.attempts.map(x=>x.glyph);
export const commits=h=>h.updates.filter(x=>!x.nativeComposing);
export function nativeSequence(h,values,tail='end-first'){
 h.fire('compositionstart');
 for(const value of values)h.edit(value,{isComposing:true,inputType:'insertCompositionText'});
 const end=()=>h.fire('compositionend',{data:values.at(-1)});
 const input=()=>h.fire('input',{isComposing:false,inputType:'insertText',data:values.at(-1)});
 if(tail==='end-first'){end();input()}else{input();end()}
}
