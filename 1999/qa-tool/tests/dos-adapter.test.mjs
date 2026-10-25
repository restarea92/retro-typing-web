import test from 'node:test';
import assert from 'node:assert/strict';
import {createDosAdapter} from '../source/dos-adapter.js';
function fixture(){
 const calls=[],listeners=new Map();
 globalThis.location={origin:'https://qa.example'};
 globalThis.window={addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:(n,f)=>{if(listeners.get(n)===f)listeners.delete(n);}};
 const player={state:()=>({ready:true}),load:async f=>calls.push(['load',f]),key:(k,p)=>calls.push(['key',k,p]),move:(x,y)=>calls.push(['move',x,y]),button:(b,p)=>calls.push(['button',b,p]),releaseAll:()=>calls.push(['release']),stop:async()=>calls.push(['stop'])};
 const iframe={contentWindow:{hancomDosPlayer:player}};const status=[];const api=createDosAdapter({iframe,onState:s=>status.push(s)});return{api,player,iframe,calls,listeners,status};
}
test('DOS adapter maps physical keys to documented js-dos code values',()=>{
 const f=fixture();f.api.keyDown({code:'Enter'});f.api.keyUp({code:'Enter'});assert.deepEqual(f.calls,[['key',257,true],['key',257,false]]);
});
test('DOS unsupported keys do not reach emulator',()=>{
 const f=fixture();for(const code of ['MetaLeft','ContextMenu','Unidentified'])assert.equal(f.api.keyDown({code}),false);assert.equal(f.calls.length,0);
});
test('DOS mouse normalizes640x480 and maps DOM right2 toDOS right1',()=>{
 const f=fixture();f.api.mouseMove(320,240);f.api.mouseButton(2,true);f.api.mouseButton(2,false);assert.deepEqual(f.calls,[['move',.5,.5],['button',1,true],['button',1,false]]);
});
test('DOS rejects invalid coordinates and middle button',()=>{
 const f=fixture();for(const pair of [[640,0],[0,480],[-1,0],[Infinity,0]])assert.throws(()=>f.api.mouseMove(...pair),RangeError);assert.throws(()=>f.api.mouseButton(1,true),RangeError);assert.equal(f.calls.length,0);
});
test('DOS status message requires correct source AND exact origin',()=>{
 const f=fixture(),receive=f.listeners.get('message');const valid={source:f.iframe.contentWindow,origin:'https://qa.example',data:{type:'hancom-dos-status',state:{ready:true,phase:'ready'}}};receive({...valid,origin:'https://attacker.example'});receive({...valid,source:{}});assert.equal(f.status.length,0);receive(valid);assert.equal(f.status.length,1);assert.equal(f.status[0].phase,'ready');
});
test('DOS ready reflects actual player rather than spoofed status payload',()=>{
 const f=fixture();f.player.state=()=>({ready:false});f.listeners.get('message')({source:f.iframe.contentWindow,origin:'https://qa.example',data:{type:'hancom-dos-status',state:{ready:true}}});assert.equal(f.api.ready,false);
});
test('DOS destroy releases keys, stops player and removes status listener',()=>{
 const f=fixture();f.api.destroy();assert.ok(f.calls.some(c=>c[0]==='release'));assert.ok(f.calls.some(c=>c[0]==='stop'));assert.equal(f.listeners.has('message'),false);
});
