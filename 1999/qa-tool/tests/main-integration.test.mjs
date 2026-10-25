import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../source/main.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
function fixture(){
 const events={},calls=[],intervals=[];let enabled=false,held=[],buttons=[];
 const listener=()=>({addEventListener:(n,f)=>{(events[n]??=[]).push(f);}});
 const elements=new Map();
 const window=listener(),document={...listener(),querySelector:selector=>{if(!elements.has(selector))elements.set(selector,{...listener(),contentWindow:{},focus(){document.activeElement=this;}});return elements.get(selector);},hasFocus:()=>true,hidden:false};
 const router={status:()=>({enabled,held,buttons,running:false}),get enabled(){return enabled;},get pressedCodes(){return held;},log:[],setEnabled:v=>{enabled=v;},releaseAll:r=>{calls.push(['release',r]);held=[];buttons=[];},keyDown:p=>{calls.push(['down',p]);held.push(p.code);},keyUp:c=>{calls.push(['up',c]);held=held.filter(x=>x!==c);},mouseMove:(...x)=>calls.push(['move',...x]),mouseButton:(...x)=>calls.push(['button',...x]),sequence:()=>{},replay:()=>{},click:()=>{},cancelSequence:()=>{},clearLog:()=>{}};
 const context={window,document,createInputRouter:()=>router,createDosAdapter:()=>({destroy:()=>calls.push(['destroy']),state:{ready:false}}),createVisuals:()=>({update:()=>{},event:()=>{},clear:()=>{}}),setInterval:fn=>(intervals.push(fn),1),clearInterval:()=>{},setTimeout:()=>1,URL,Blob,console};
 vm.runInNewContext(source,context);
 return {window,document,router,calls,poll:()=>intervals.forEach(fn=>fn()),setHeld:v=>held=v,setButtons:v=>buttons=v,emit:(type,properties={})=>{const event={type,code:'KeyA',target:{closest:()=>false},preventDefault:()=>{},stopImmediatePropagation:()=>{},...properties};for(const f of events[type]||[])f(event);}};
}
test('host exposes frozen public SDK without hidden state setters',()=>{const f=fixture();assert.ok(Object.isFrozen(f.window.hancomQA));assert.equal(f.window.hancomQA.version,1);for(const forbidden of ['setScore','setSeed','setState','loadMemory'])assert.equal(f.window.hancomQA[forbidden],undefined);});
test('host physical keyboard uses same router as SDK, once',()=>{const f=fixture();f.window.hancomQA.setEnabled(true);f.emit('keydown');assert.equal(f.calls.filter(c=>c[0]==='down').length,1);f.window.hancomQA.keyUp('KeyA');assert.equal(f.calls.filter(c=>c[0]==='up').length,1);});
test('host controls do not send ordinary typing into game',()=>{const f=fixture();f.window.hancomQA.setEnabled(true);f.emit('keydown',{target:{closest:()=>true}});assert.equal(f.calls.length,0);});
test('held key releases even after focus moves onto host control',()=>{const f=fixture();f.window.hancomQA.setEnabled(true);f.setHeld(['KeyA']);f.emit('keyup',{target:{closest:()=>true}});assert.ok(f.calls.some(c=>c[0]==='up'&&c[1]==='KeyA'));});
test('pointer cancellation and off-frame up cancel without synthetic click',()=>{const f=fixture();f.setButtons([0]);f.emit('pointerup',{button:0});assert.ok(f.calls.some(c=>c[0]==='release'));assert.ok(!f.calls.some(c=>c[0]==='button'));f.calls.length=0;f.emit('pointercancel');assert.ok(f.calls.some(c=>c[0]==='release'));});
test('hidden page and page exit release inputs; exit destroys DOS adapter',()=>{const f=fixture();f.document.hidden=true;f.emit('visibilitychange');assert.ok(f.calls.some(c=>c[0]==='release'));f.emit('pagehide');assert.ok(f.calls.some(c=>c[0]==='destroy'));});

test('enabling input moves focus from UI controls to common bridge',()=>{const f=fixture();f.document.activeElement={tagName:'BUTTON'};f.window.hancomQA.setEnabled(true);const bridge=f.document.querySelector('#bridge-node');assert.equal(f.document.activeElement,bridge);assert.equal(bridge.tabIndex,0);});

test('web iframe pointercancel independently releases shared router without parent bubbling',()=>{const f=fixture(),childEvents={};const child=f.document.querySelector('#web-frame').contentWindow;child.addEventListener=(type,fn)=>{(childEvents[type]??=[]).push(fn);};child.__HTTD_QA_WEB__={subscribe:()=>{},setCapture:()=>{},observe:()=>({}),ready:true};f.poll();f.calls.length=0;f.setHeld(['KeyA']);f.setButtons([0]);assert.equal(childEvents.pointercancel.length,1);for(const fn of childEvents.pointercancel)fn({type:'pointercancel'});assert.deepEqual(f.calls,[['release','web-pointer-cancel']]);assert.deepEqual(f.router.status().held,[]);assert.deepEqual(f.router.status().buttons,[]);});
test('readonly preview monitor forwards physical key down/up through shared router',()=>{
 const f=fixture();f.window.hancomQA.setEnabled(true);const target={id:'input-monitor',readOnly:true,closest:()=>true};f.emit('keydown',{target,code:'KeyA'});f.emit('keyup',{target,code:'KeyA'});assert.equal(f.calls.filter(c=>c[0]==='down').length,1);assert.equal(f.calls.filter(c=>c[0]==='up').length,1);assert.deepEqual(f.router.status().held,[]);
});
