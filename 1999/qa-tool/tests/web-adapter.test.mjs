import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {installQaWebAdapter} from '../source/web-adapter.js';
function fixture(){
 const {window,document}=parseHTML('<html><head></head><body><section class="classic"><header class="titlebar">Test</header><span id="language">한글-2</span><button id="ok"><span id="left">왼쪽</span><span id="right">오른쪽</span></button><button id="disabled" disabled>Disabled</button><div inert><button id="inert">Inert</button></div><input id="input" value="abc"></section><aside id="outside"></aside></body></html>');
 window.__HTTD_QA_WEB__?.destroy();
 const frame=document.querySelector('.classic');frame.getBoundingClientRect=()=>({left:10,top:20,width:320,height:240});
 let pointed=document.querySelector('#left'),focused=document.querySelector('#input');
 document.elementFromPoint=()=>pointed;Object.defineProperty(document,'activeElement',{get:()=>focused,configurable:true});
 for(const el of document.querySelectorAll('button,input'))el.focus=()=>{focused=el;};
 const calls=[];const bridge={keyDown:p=>(calls.push(['down',p]),true),keyUp:p=>(calls.push(['up',p]),true),releaseAll:()=>calls.push(['release'])};
 const api=installQaWebAdapter({document,bridge,getOwner:()=>focused,getState:()=>({mode:'home'})});
 return {window,document,frame,calls,bridge,api,pointTo:id=>pointed=document.querySelector(id)};
}
test('adapter installs one opt-in same-origin API and reports truthful transport',()=>{
 const f=fixture();assert.equal(f.window.__HTTD_QA_WEB__,f.api);assert.equal(f.api.ready,true);assert.equal(f.api.observe().inputTransport,'synthetic-normal-input');assert.equal(f.api.observe().nativeImeSynchronized,false);assert.equal(f.api.observe().text,'abc');
 assert.throws(()=>installQaWebAdapter({document:f.document,bridge:{},getOwner:()=>null}),/already installed/);f.api.destroy();assert.equal(f.window.__HTTD_QA_WEB__,undefined);assert.equal(f.api.ready,false);
});
test('synthetic pointer uses scaled viewport coordinates and input marker',()=>{
 const f=fixture();let got;f.document.querySelector('#left').addEventListener('mousedown',e=>got=e);
 f.api.pointer({type:'down',x:100,y:80,buttons:[0]});assert.equal(got.clientX,60);assert.equal(got.clientY,60);assert.equal(got.qaBridgePointer,true);assert.equal(got.buttons,1);
});
test('click uses shared button ancestor when down/up land on distinct child spans',()=>{
 const f=fixture();let clicks=0;f.document.querySelector('#ok').addEventListener('click',()=>clicks++);
 f.api.pointer({type:'down',x:1,y:1,buttons:[0]});f.pointTo('#right');f.api.pointer({type:'up',x:2,y:1,buttons:[]});assert.equal(clicks,1);
});
test('releaseAll clears pressed visuals and does not synthesize click',()=>{
 const f=fixture();let clicks=0;f.document.querySelector('#ok').addEventListener('click',()=>clicks++);f.api.pointer({type:'down',x:1,y:1,buttons:[0]});assert.ok(f.document.querySelector('#ok').hasAttribute('data-qa-active'));f.api.releaseAll();assert.ok(!f.document.querySelector('#ok').hasAttribute('data-qa-active'));f.api.pointer({type:'up',x:1,y:1});assert.equal(clicks,0);
});
test('inert targets cannot receive synthetic input',()=>{
 const f=fixture();f.pointTo('#inert');let clicks=0;f.document.querySelector('#inert').addEventListener('click',()=>clicks++);assert.equal(f.api.pointer({type:'down',x:1,y:1}),false);assert.equal(clicks,0);
});
test('disabled button cannot be activated by synthetic click',()=>{
 const f=fixture();f.pointTo('#disabled');let clicks=0;f.document.querySelector('#disabled').addEventListener('click',()=>clicks++);f.api.pointer({type:'down',x:1,y:1,buttons:[0]});f.api.pointer({type:'up',x:1,y:1});assert.equal(clicks,0);
});
test('outside frame cannot become a synthetic target',()=>{
 const f=fixture();f.pointTo('#outside');assert.equal(f.api.pointer({type:'down',x:10,y:10}),false);
});
test('invalid pointer packets rejected',()=>{
 const f=fixture();for(const p of [{type:'click',x:0,y:0},{type:'down',x:640,y:0},{type:'down',x:0,y:480},{type:'down',x:0,y:0,button:1}])assert.throws(()=>f.api.pointer(p));
});
test('keyboard SDK invokes existing bridge and preserves packet',()=>{
 const f=fixture();const p={code:'KeyA',shiftKey:true};f.api.keyDown(p);f.api.keyUp({code:'KeyA'});assert.deepEqual(f.calls.slice(0,2),[['down',p],['up',{code:'KeyA'}]]);
});
test('blur clears pressed state and synthetic hover marks',()=>{
 const f=fixture();f.api.pointer({type:'down',x:1,y:1,buttons:[0]});f.window.dispatchEvent(new f.window.Event('blur'));assert.equal(f.document.querySelectorAll('[data-qa-active],[data-qa-hover]').length,0);assert.ok(f.calls.some(c=>c[0]==='release'));
});
test('bridge key observation exposes a defensive lastKey without recapturing or changing text',()=>{
 const f=fixture();let forwarded=0;f.api.subscribe({key:()=>forwarded++});f.api.setCapture(true);assert.equal(f.api.observe().lastKey,null);
 const event=new f.window.Event('keydown',{bubbles:true});Object.assign(event,{keyboardBridgeEvent:true,code:'KeyA',key:'ㅁ'});f.window.dispatchEvent(event);
 assert.deepEqual(f.api.observe().lastKey,{code:'KeyA',key:'ㅁ'});assert.equal(f.api.observe().text,'abc');assert.equal(forwarded,0);assert.equal(f.calls.length,0);
 const observed=f.api.observe();observed.lastKey.key='mutated';assert.equal(f.api.observe().lastKey.key,'ㅁ');
 const up=new f.window.Event('keyup');Object.assign(up,{keyboardBridgeEvent:true,code:'KeyA',key:''});f.window.dispatchEvent(up);assert.equal(f.api.observe().lastKey.key,'ㅁ');
});

test('keyup already released by navigation succeeds only when normal bridge confirms absence',()=>{
 const f=fixture();f.bridge.keyUp=p=>(f.calls.push(['up',p]),false);f.bridge.pressedCodes=[];
 assert.equal(f.api.keyUp({code:'KeyA'}),true);assert.equal(f.calls.length,1);
 f.bridge.pressedCodes=['KeyA'];assert.equal(f.api.keyUp({code:'KeyA'}),false);assert.deepEqual(f.bridge.pressedCodes,['KeyA']);
 const before=f.calls.length;assert.equal(f.api.keyUp({code:'Unidentified'}),false);assert.equal(f.api.keyUp({code:'MetaLeft'}),false);assert.equal(f.calls.length,before);
 delete f.bridge.pressedCodes;assert.equal(f.api.keyUp({code:'KeyA'}),false);
});
