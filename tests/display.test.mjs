import test from 'node:test';
import assert from 'node:assert/strict';
import {displayGeometry,readCrtPreference,CRT_STORAGE_KEY} from '../1999/display.js';
for(const [w,h] of [[1920,1080],[1024,768],[1280,720],[390,844],[844,390],[640,480]])test(`fullscreen ${w}x${h} preserves 4:3 fixed surface and height`,()=>{
 const g=displayGeometry(w,h,true,2);assert.equal(g.height,h);assert.equal(g.width/g.height,4/3);assert.equal(g.left,(w-g.width)/2);
 if(w/h<4/3)assert.ok(g.left<0,'narrow fullscreen intentionally crops both sides');else assert.ok(g.left>=0);
});
test('windowed scales down only, preserving fixed internal layout',()=>{assert.equal(displayGeometry(320,800).scale,.5);assert.equal(displayGeometry(1000,800).scale,1);});
test('scanlines fade away below resolvable output density',()=>{assert.equal(displayGeometry(320,800,false,1).scanlineOpacity,0);assert.ok(displayGeometry(640,800,false,2).scanlineOpacity>0);});
test('mask uses physical output pixels rather than source pixels',()=>{assert.equal(displayGeometry(640,480,false,2).maskPixel,.5);});
test('CRT defaults off for image QA; explicit saved on and off remain respected',()=>{assert.equal(readCrtPreference({getItem:()=>null}),false);assert.equal(readCrtPreference({getItem:k=>k===CRT_STORAGE_KEY?'off':null}),false);assert.equal(readCrtPreference({getItem:()=> 'on'}),true);});
test('blocked, missing or unrecognized storage leaves CRT off',()=>{assert.equal(readCrtPreference({getItem(){throw new Error('blocked');}}),false);assert.equal(readCrtPreference(undefined),false);for(const value of ['', 'true', 'invalid'])assert.equal(readCrtPreference({getItem:()=>value}),false);});

import {installDisplay} from '../1999/display.js';
function fixture(saved=new Map()){
 function element(){const listeners={},attributes={},classes=new Set();return {style:{},children:[],listeners,attributes,clientWidth:640,classList:{toggle(k,on){on?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)},append(el){this.children.push(el);},setAttribute(k,v){attributes[k]=v;},addEventListener(k,fn){listeners[k]=fn;}};}
 const viewport=element(),frame=element(),full=element(),exit=element(),normal=element(),inside=element(),toolbar=element(),help=element();
 const selectors={'#display-viewport':viewport,'#frame-box':frame,'#fullscreen':full,'[data-fullscreen-exit]':exit,'#outside-help':help};
 const doc={body:element(),fullscreenElement:null,createElement:element,createElementNS:element,querySelector:s=>selectors[s],querySelectorAll:s=>s==='[data-crt-toggle]'?[normal,inside]:s==='.fullscreen-display-controls'?[toolbar]:[],listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},async exitFullscreen(){this.fullscreenElement=null;this.listeners.fullscreenchange();}};
 viewport.requestFullscreen=async()=>{doc.fullscreenElement=viewport;doc.listeners.fullscreenchange();};
 const win={innerWidth:1920,innerHeight:1080,devicePixelRatio:2,localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},listeners:{},addEventListener(k,fn){this.listeners[k]=fn;}};
 const api=installDisplay(doc,win);return {doc,win,api,viewport,frame,full,exit,normal,inside,toolbar,help};
}
test('fresh load is unfiltered; both toggles synchronize and persist each explicit choice',()=>{
 const saved=new Map(),f=fixture(saved);assert.equal(f.api.enabled,false);assert.equal(f.viewport.classList.contains('crt-enabled'),false);assert.equal(f.normal.attributes['aria-pressed'],'false');assert.equal(f.inside.attributes['aria-pressed'],'false');assert.equal(saved.has(CRT_STORAGE_KEY),false,'reading the default must not overwrite user storage');
 f.normal.listeners.click();assert.equal(f.api.enabled,true);assert.equal(f.viewport.classList.contains('crt-enabled'),true);assert.equal(f.inside.attributes['aria-pressed'],'true');assert.equal(saved.get(CRT_STORAGE_KEY),'on');
 const reloadOn=fixture(saved);assert.equal(reloadOn.api.enabled,true);reloadOn.inside.listeners.click();assert.equal(reloadOn.normal.attributes['aria-pressed'],'false');assert.equal(saved.get(CRT_STORAGE_KEY),'off');const reloadOff=fixture(saved);assert.equal(reloadOff.api.enabled,false);assert.equal(reloadOff.viewport.classList.contains('crt-enabled'),false);
});
test('fullscreen request uses viewport, repeat exit and resize restore window geometry',async()=>{
 const f=fixture();await f.full.listeners.click();assert.equal(f.doc.fullscreenElement,f.viewport);assert.equal(f.frame.style.transform,'scale(2.25)');assert.equal(f.frame.style.left,'240px');
 f.win.innerWidth=390;f.win.innerHeight=844;f.win.listeners.resize();assert.equal(f.frame.style.left,`${(390-640*(844/480))/2}px`);
 await f.exit.listeners.click();assert.equal(f.doc.fullscreenElement,null);assert.equal(f.frame.style.transform,'scale(1)');assert.equal(f.frame.style.left,'0px');assert.equal(f.viewport.style.height,'480px');
 await f.full.listeners.click();await f.full.listeners.click();assert.equal(f.doc.fullscreenElement,null);
});
test('fullscreen rejection is nonfatal with an honest fallback',async()=>{const f=fixture();f.viewport.requestFullscreen=async()=>{throw Error('unsupported');};await f.full.listeners.click();assert.equal(f.doc.fullscreenElement,null);assert.equal(f.help.hidden,false);assert.match(f.help.textContent,/지원하지/);});
test('fullscreen controls do not send keys into the typing game',()=>{const f=fixture();let stopped=false;f.toolbar.listeners.keydown({stopPropagation(){stopped=true;}});assert.equal(stopped,true);});
import {readFileSync} from 'node:fs';
test('CRT CSS is opt-in, noninteractive, nonanimated and prevents focus scrolling',()=>{const css=readFileSync(new URL('../1999/display.css',import.meta.url),'utf8');assert.match(css,/\.crt-enabled \.classic\{filter:url/);assert.match(css,/\.crt-overlay\{display:none;[^}]*pointer-events:none/);assert.match(css,/overflow:clip/);assert.match(css,/forced-colors:active/);assert.doesNotMatch(css,/@keyframes|animation:/);});

test('initial HTML toggle labels and accessibility state match the off default',()=>{const html=readFileSync(new URL('../1999/index.html',import.meta.url),'utf8');const toggles=[...html.matchAll(/<button[^>]*data-crt-toggle[^>]*>[^<]*<\/button>/g)].map(match=>match[0]);assert.equal(toggles.length,2);for(const button of toggles){assert.match(button,/aria-pressed="false"/);assert.match(button,/>CRT 꺼짐</);}});
