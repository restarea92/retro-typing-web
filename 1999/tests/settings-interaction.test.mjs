import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {renderSettings} from '../settings.js';
function fixture(){
 const {window,document}=parseHTML('<html><body><div id="status"></div><div id="language"></div><main></main></body></html>');
 const previous=globalThis.document;globalThis.document=document;let active=null;
 Object.defineProperty(document,'activeElement',{get:()=>active});
 window.HTMLElement.prototype.focus=function(){active=this;this.dispatchEvent(new window.Event('focusin',{bubbles:true}));};
 const controller=renderSettings(document.querySelector('main'),{});
 const q=s=>document.querySelector(s);
 const fire=(el,type,fields={})=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,fields);el.dispatchEvent(e);return e;};
 return {q,controller,fire,active:()=>active,close(){controller.destroy();globalThis.document=previous;}};
}
test('mouse down holds selection; release selects another cycle field; next release cycles',()=>{
 const h=fixture();try{
  const lang=h.q('#setting-language'),layout=h.q('#setting-layout');
  assert.equal(h.active(),lang);assert.equal(h.fire(layout,'pointerdown',{button:0}).defaultPrevented,true);
  assert.equal(h.active(),lang);assert.equal(h.controller.getSettings().layout,'2');
  h.fire(layout,'click',{detail:1,button:0});assert.equal(h.active(),layout);assert.equal(h.controller.getSettings().layout,'2');
  h.fire(layout,'pointerdown',{button:0});assert.equal(h.controller.getSettings().layout,'2');
  h.fire(layout,'click',{detail:1,button:0});assert.equal(h.controller.getSettings().layout,'3');
 }finally{h.close();}
});
test('selected language physical click cycles on release, not pointer down',()=>{
 const h=fixture();try{const lang=h.q('#setting-language');h.fire(lang,'pointerdown',{button:0});assert.equal(h.controller.getSettings().language,'ko');h.fire(lang,'click',{detail:1,button:0});assert.equal(h.controller.getSettings().language,'en');}finally{h.close();}
});
test('Enter and Space cycle on down and keep the same selected field; up does not cycle',()=>{
 for(const [key,code]of [['Enter','Enter'],[' ','Space']]){const h=fixture();try{const lang=h.q('#setting-language');assert.equal(h.fire(lang,'keydown',{key,code}).defaultPrevented,true);assert.equal(h.controller.getSettings().language,'en');assert.equal(h.active(),lang);h.fire(lang,'keyup',{key,code});assert.equal(h.controller.getSettings().language,'en');}finally{h.close();}}
});
test('Tab remains ignored and arrows still move field selection',()=>{
 const h=fixture();try{const lang=h.q('#setting-language');assert.equal(h.fire(lang,'keydown',{key:'Tab',code:'Tab'}).defaultPrevented,true);assert.equal(h.active(),lang);h.fire(lang,'keydown',{key:'ArrowDown',code:'ArrowDown'});assert.equal(h.active(),h.q('#setting-layout'));assert.equal(h.controller.getSettings().layout,'2');}finally{h.close();}
});

test('cycle field labels select on first release and cycle on second without forwarded duplicate click',()=>{
 const h=fixture();try{const label=h.q('label[for="setting-layout"]'),layout=h.q('#setting-layout');
  assert.equal(h.fire(label,'pointerdown',{button:0}).defaultPrevented,true);assert.equal(h.active(),h.q('#setting-language'));
  assert.equal(h.fire(label,'click',{detail:1,button:0}).defaultPrevented,true);assert.equal(h.active(),layout);assert.equal(h.controller.getSettings().layout,'2');
  h.fire(label,'click',{detail:1,button:0});assert.equal(h.controller.getSettings().layout,'3');
 }finally{h.close();}
});

test('settings language HUD updates immediately with draft language and layout, before close',()=>{
 const h=fixture();try{const lang=h.q('#setting-language'),layout=h.q('#setting-layout');assert.equal(h.q('#language').textContent,'한글-2');h.fire(lang,'keydown',{key:' ',code:'Space'});assert.equal(h.q('#language').textContent,'영문-미');h.fire(lang,'keydown',{key:'ArrowDown',code:'ArrowDown'});h.fire(layout,'keydown',{key:'Enter',code:'Enter'});assert.equal(h.q('#language').textContent,'영문-드');}finally{h.close();}
});
