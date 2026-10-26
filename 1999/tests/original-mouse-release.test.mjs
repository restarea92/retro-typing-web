import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {installOriginalMouseRelease} from '../original-mouse-release.js';
import {installQaWebAdapter} from '../qa-tool/source/web-adapter.js';
function fixture(){
 const {window,document}=parseHTML('<html><head></head><body><section class="classic"><button id="a">A</button><button id="b">B</button><button id="disabled" disabled>X</button><div id="blank"></div></section></body></html>');
 window.__HTTD_QA_WEB__?.destroy();
 // LinkeDOM has no real capture phase. Model the window click capture ordering
 // explicitly, then let ordinary element/bubble dispatch run unchanged.
 const captures=new Set(),add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
 window.addEventListener=(type,fn,capture)=>type==='click'&&capture?captures.add(fn):add(type,fn,capture);
 window.removeEventListener=(type,fn,capture)=>type==='click'&&capture?captures.delete(fn):remove(type,fn,capture);
 for(const el of document.querySelectorAll('*')){const dispatch=el.dispatchEvent.bind(el);el.dispatchEvent=e=>{if(e.type==='click'){for(const fn of captures)fn(e);if(e.cancelBubble)return !e.defaultPrevented;}return dispatch(e);};}
 const frame=document.querySelector('.classic');frame.getBoundingClientRect=()=>({left:0,top:0,width:640,height:480});
 let pointed=document.querySelector('#blank');document.elementFromPoint=()=>pointed;
 const normal=installOriginalMouseRelease(frame,{document}),api=installQaWebAdapter({document,bridge:{releaseAll(){}},releasePointer:()=>normal.cancel(),getOwner:()=>null});
 const hits=[];for(const id of ['a','b','disabled'])document.querySelector('#'+id).addEventListener('click',e=>hits.push([id,e.detail]));
 return {window,document,api,hits,at:id=>pointed=document.querySelector('#'+id),event(type,fields){const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,fields);pointed.dispatchEvent(e);},close(){normal.destroy();api.destroy();}};
}
test('blank down then button up activates release destination exactly once',()=>{
 const h=fixture();try{h.api.pointer({type:'down',x:1,y:1,buttons:[0]});assert.deepEqual(h.hits,[]);h.at('a');h.api.pointer({type:'move',x:2,y:2,buttons:[0]});assert.deepEqual(h.hits,[]);h.api.pointer({type:'up',x:2,y:2});assert.deepEqual(h.hits,[['a',1]]);}finally{h.close();}
});
test('button down then another button up activates only release destination',()=>{
 const h=fixture();try{h.at('a');h.api.pointer({type:'down',x:1,y:1,buttons:[0]});h.at('b');h.api.pointer({type:'up',x:2,y:2});assert.deepEqual(h.hits,[['b',1]]);}finally{h.close();}
});
test('same button down/up is one click, not normalized plus browser duplicate',()=>{
 const h=fixture();try{h.at('a');h.api.pointer({type:'down',x:1,y:1,buttons:[0]});h.api.pointer({type:'up',x:1,y:1});assert.deepEqual(h.hits,[['a',1]]);}finally{h.close();}
});
test('release on blank does not activate origin, canceled press and right mouse do not activate',()=>{
 const h=fixture();try{h.at('a');h.api.pointer({type:'down',x:1,y:1,buttons:[0]});h.at('blank');h.api.pointer({type:'up',x:1,y:1});assert.deepEqual(h.hits,[]);h.at('a');h.event('pointerdown',{button:0,pointerType:'mouse'});h.event('pointercancel',{});h.event('pointerup',{button:0,pointerType:'mouse'});assert.deepEqual(h.hits,[]);h.api.pointer({type:'down',x:1,y:1,button:2,buttons:[2]});h.api.pointer({type:'up',x:1,y:1,button:2});assert.deepEqual(h.hits,[]);}finally{h.close();}
});
test('keyboard detail zero click remains ordinary and disabled release is ignored',()=>{
 const h=fixture();try{h.at('a');h.event('click',{detail:0});assert.deepEqual(h.hits,[['a',0]]);h.at('disabled');h.api.pointer({type:'down',x:1,y:1,buttons:[0]});h.api.pointer({type:'up',x:1,y:1});assert.equal(h.hits.length,1);}finally{h.close();}
});

test('touch gesture is not normalized or swallowed after a removed mouse click target',()=>{
 const h=fixture();try{h.at('blank');h.event('pointerdown',{button:0,pointerType:'mouse'});h.event('pointerup',{button:0,pointerType:'mouse'});h.at('a');h.event('pointerdown',{button:0,pointerType:'touch'});h.event('pointerup',{button:0,pointerType:'touch'});assert.deepEqual(h.hits,[]);h.event('click',{detail:1});assert.deepEqual(h.hits,[['a',1]]);}finally{h.close();}
});

test('QA releaseAll cancels the production mouse latch before a delayed real pointerup',()=>{
 for(const action of ['releaseAll','disable']){const h=fixture();try{h.at('a');h.api.pointer({type:'down',x:1,y:1,buttons:[0]});if(action==='disable')h.api.setCapture(false);else h.api.releaseAll();h.event('pointerup',{button:0,pointerType:'mouse'});h.event('click',{detail:1});assert.deepEqual(h.hits,[],action);h.api.pointer({type:'down',x:1,y:1,buttons:[0]});h.api.pointer({type:'up',x:1,y:1});assert.deepEqual(h.hits,[['a',1]],'fresh click still works');}finally{h.close();}}
});
test('QA releaseAll also cancels a trusted-style press that is not in adapter downs',()=>{
 const h=fixture();try{h.at('a');h.event('pointerdown',{button:0,pointerType:'mouse'});h.api.releaseAll();h.event('pointerup',{button:0,pointerType:'mouse'});assert.deepEqual(h.hits,[]);}finally{h.close();}
});
