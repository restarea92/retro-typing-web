/** Independent header-ownership regressions. Simulated DOM and explicit button defaults,
 * not real browser Tab/default-action/touch evidence. Runtime files are read only. */
import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const {parseHTML} = resourceTestsEnabled ? await import('linkedom') : {};

const appURL=new URL('../app.js',import.meta.url);
const source=fs.readFileSync(appURL,'utf8');
console.log('SOURCE_SHA256',crypto.createHash('sha256').update(source).digest('hex'));
console.log('EVIDENCE: isolated DOM with modeled native button defaults; no browser/CUA action.');
const imported={};
if(resourceTestsEnabled)for(const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)){
 const module=await import(new URL(m[2],appURL));
 for(const name of m[1].split(',').map(x=>x.trim()))imported[name]=module[name];
}
const HEADERS=['home','keys','words','textmenu','play','stats','help'];
const LABELS=['한컴타자','자리연습','낱말연습','글연습','놀이','통계','도움말'];
const MEMORY={home:1,keys:9,words:6,textmenu:2,play:1,stats:3,help:1};
const ACTIONS={home:'exit',keys:'keys:9',words:'words:6',textmenu:'notepad',play:'rain',stats:'stats-keyAccuracy',help:'about'};
function setup(){
 const {window,document}=parseHTML(fs.readFileSync(new URL('index.html',appURL),'utf8'));
 Object.assign(globalThis,{window,document});
 const saved=new Map();
 window.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,String(value))};
 window.location={reload(){}};
 window.HTMLElement.prototype.focus=function(){
  if(document._active===this)return;
  document._active?.dispatchEvent(new window.Event('focusout',{bubbles:true}));
  document._active=this;this.dispatchEvent(new window.Event('focusin',{bubbles:true}));
 };
 Object.defineProperty(document,'activeElement',{get:()=>document._active||document.body});
 window.HTMLElement.prototype.scrollIntoView=function(){};
 Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{get:()=>640,configurable:true});
 const bindings={...imported,pauseFor:()=>new Promise(()=>{}),createVirtualKeyboard:(_node,options={})=>({
  setLayout(){},setPressed(){},setModifiers(){},releaseAll(){},destroy(){},
  setVisible(visible){options.onVisibilityChange?.(visible)}
 })};
 const body=source.replace(/^import .*;$/mg,'').replace(/import\('\.\//g,`import('${new URL('.',appURL).href}`);
 const api=new Function(...Object.keys(bindings),'setInterval',body+`\nreturn {
  navigate,openMenu,showStageDialog,currentInputOwner,
  bridge:()=>keyboardBridge,
  state:()=>({mode,openMenuId,openMenuIndex,mainMenuId,mainMenuIndex,navigationVersion,menuSelections:{...menuSelections}}),
  spyActions:fn=>{handleMenuAction=fn},spyNavigation:fn=>{navigate=fn}
 };`)(...Object.values(bindings),()=>0);
 const q=selector=>document.querySelector(selector);
 function event(target,type,fields={}){
  const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,fields);target.dispatchEvent(e);return e;
 }
 function key(key,target=document.activeElement,extra={}){
  const code=key===' '?'Space':key;
  const down=event(target,'keydown',{key,code,...extra});
  // Explicit model only: button Enter clicks after keydown; Space clicks after keyup.
  if(key==='Enter'&&!down.defaultPrevented&&target.tagName==='BUTTON'&&target.isConnected)target.click();
  const up=event(target,'keyup',{key,code,...extra});
  if(key===' '&&!down.defaultPrevented&&!up.defaultPrevented&&target.tagName==='BUTTON'&&target.isConnected&&document.activeElement===target)target.click();
  return {down,up};
 }
 function pointer(target){
  const down=event(target,'pointerdown',{pointerType:'mouse',button:0,detail:1});
  const mouse=down.defaultPrevented?null:event(target,'mousedown',{button:0,detail:1});
  if(!down.defaultPrevented&&!mouse?.defaultPrevented)(target.closest('button,input,textarea,[tabindex]')||document.body).focus();
  event(target,'pointerup',{pointerType:'mouse',button:0,detail:1});event(target,'mouseup',{button:0,detail:1});
  return event(target,'click',{button:0,detail:1,pointerType:'mouse'});
 }
 function bridge(key){const code=key===' '?'Space':key;api.bridge().keyDown({code,key});api.bridge().keyUp({code});}
 return {api,q,key,event,pointer,bridge,document,stored:()=>[...saved]};
}
function seeded(){
 const u=setup();u.api.navigate('home');
 for(const id of HEADERS)u.api.openMenu(id,MEMORY[id]);
 u.api.openMenu('textmenu',2);u.routes=[];u.api.spyActions(action=>u.routes.push(action));return u;
}
function focusHeader(u,id='help'){const header=u.q(`#menu [data-mode="${id}"]`);header.focus();return header;}
function assertMenu(u,id,index,action){
 assert.equal(u.api.state().mode,'home');assert.equal(u.api.state().openMenuId,id);assert.equal(u.api.state().openMenuIndex,index);
 assert.equal(u.document.querySelectorAll('.dropdown-menu').length,1);assert.equal(u.document.querySelectorAll('.dropdown-menu .chosen').length,1);
 if(action)assert.equal(u.q('.dropdown-menu .chosen').dataset.action,action);
}

for(const id of HEADERS)for(const key of ['Enter',' '])test(`physical ${JSON.stringify(key)} on focused ${id} header uses its own button once and restores memory`,()=>{
 const u=seeded(),header=focusHeader(u,id),stored=u.stored(),version=u.api.state().navigationVersion;let clicks=0;
 header.addEventListener('click',()=>clicks++);const {down}=u.key(key);
 assert.equal(down.defaultPrevented,false,'header activation stays with its native button default');
 assert.equal(clicks,1,'one button activation');assertMenu(u,id,MEMORY[id],ACTIONS[id]);
 assert.deepEqual(u.routes,[],'header never activates a destination');assert.equal(u.api.state().navigationVersion,version);
 assert.deepEqual(u.stored(),stored);assert.deepEqual([...u.q('#menu').children].map(x=>x.textContent),LABELS);
});

const NAVIGATION=[
 ['ArrowDown','textmenu',3,'exam'],['ArrowUp','textmenu',1,'long'],
 ['Home','textmenu',0,'sentences'],['PageUp','textmenu',0,'sentences'],
 ['End','textmenu',4,'examResults'],['PageDown','textmenu',4,'examResults'],
 ['ArrowRight','play',1,'rain'],['ArrowLeft','words',6,'words:6']
];
for(const [key,id,index,action]of NAVIGATION)test(`focused different header ${key} navigates the current semantic menu, not that header`,()=>{
 const u=seeded();focusHeader(u);const version=u.api.state().navigationVersion;
 const {down}=u.key(key);assert.equal(down.defaultPrevented,true,'menu navigation consumes its key');
 assertMenu(u,id,index,action);assert.deepEqual(u.routes,[]);assert.equal(u.api.state().navigationVersion,version);
 assert.equal(u.api.state().menuSelections.help,1,'inactive Help memory not reset');
});

test('focused-header Escape is a native no-op, without replacing the current dropdown',()=>{
 const u=seeded();focusHeader(u);const before=u.api.state(),menu=u.q('.dropdown-menu');u.key('Escape');
 assert.deepEqual(u.api.state(),before);assert.ok(u.q('.dropdown-menu')===menu);assert.deepEqual(u.routes,[]);
});
for(const shiftKey of [false,true])test(`focused header ${shiftKey?'Shift+Tab':'Tab'} remains browser-owned`,()=>{
 const u=seeded();const header=focusHeader(u),before=u.api.state(),menu=u.q('.dropdown-menu');
 const {down}=u.key('Tab',header,{shiftKey});assert.equal(down.defaultPrevented,false);assert.deepEqual(u.api.state(),before);
 assert.ok(u.q('.dropdown-menu')===menu);assert.deepEqual(u.routes,[]);
 // No assertion about next focus target: this DOM has no real Tab traversal.
});
test('ordinary unrelated character on focused header preserves menu and header focus',()=>{
 const u=seeded(),header=focusHeader(u),before=u.api.state();const {down}=u.key('q',header,{code:'KeyQ'});
 assert.equal(down.defaultPrevented,false);assert.deepEqual(u.api.state(),before);assert.ok(u.document.activeElement===header);assert.deepEqual(u.routes,[]);
});

test('focused active header is the bridge owner only in main mode',()=>{
 const u=seeded(),header=focusHeader(u);assert.ok(u.api.currentInputOwner()===header);
 u.q('#help-toggle').focus();assert.ok(u.api.currentInputOwner()===u.q('.dropdown-menu'));
 u.q('#close').focus();assert.ok(u.api.currentInputOwner()===u.q('#close'));
});
for(const key of ['Enter',' '])test(`input bridge ${JSON.stringify(key)} on active Help header opens Help, never the selected text action`,()=>{
 const u=seeded(),header=focusHeader(u);let clicks=0;header.addEventListener('click',()=>clicks++);u.bridge(key);
 assertMenu(u,'help',1,'about');assert.equal(clicks,1);assert.deepEqual(u.routes,[]);
});
for(const [key,id,index,action]of NAVIGATION)test(`input bridge ${key} with header focus still navigates the semantic menu`,()=>{
 const u=seeded();focusHeader(u);u.bridge(key);assertMenu(u,id,index,action);assert.deepEqual(u.routes,[]);
});
for(const key of ['Enter',' '])test(`external ${JSON.stringify(key)} after header focus preserves native button ownership`,()=>{
 const u=seeded(),header=focusHeader(u);let clicks=0;header.addEventListener('click',()=>clicks++);
 u.pointer(u.q(`[data-control-key="${key}"]`));assertMenu(u,'help',1,'about');assert.equal(clicks,1);assert.deepEqual(u.routes,[]);
});
test('external Down after header focus navigates the existing text menu',()=>{
 const u=seeded();focusHeader(u);u.pointer(u.q('[data-control-key="ArrowDown"]'));assertMenu(u,'textmenu',3,'exam');assert.deepEqual(u.routes,[]);
});
for(const key of ['Enter',' '])test(`physical ${JSON.stringify(key)} on an outside helper remains outside the app`,()=>{
 const u=seeded();u.q('#help-toggle').focus();const before=u.api.state();const {down}=u.key(key);
 assert.equal(down.defaultPrevented,false);assert.equal(u.q('#outside-help').hidden,false);assert.deepEqual(u.api.state(),before);assert.deepEqual(u.routes,[]);
});
test('explicit external Down after outside-helper focus resumes semantic menu, not stale header',()=>{
 const u=seeded();focusHeader(u);u.q('#help-toggle').focus();u.pointer(u.q('[data-control-key="ArrowDown"]'));
 assertMenu(u,'textmenu',3,'exam');assert.deepEqual(u.routes,[]);
});
for(const key of ['Enter',' '])test(`external ${JSON.stringify(key)} after outside focus activates current menu row once`,()=>{
 const u=seeded();focusHeader(u);u.q('#help-toggle').focus();u.pointer(u.q(`[data-control-key="${key}"]`));
 assert.deepEqual(u.routes,['notepad']);assertMenu(u,'textmenu',2,'notepad');
});

for(const key of ['Enter',' '])test(`startup inactive Help header physical ${JSON.stringify(key)} cannot open a menu or confirm No`,()=>{
 const u=setup();u.api.showStageDialog();u.key('ArrowRight');const dialog=u.q('.stage-dialog'),actions=[];
 u.api.spyNavigation(action=>actions.push(action));focusHeader(u);assert.ok(u.api.currentInputOwner()===u.q('#stage-no'));
 u.key(key);assert.deepEqual(actions,[]);assert.equal(u.api.state().mode,'stage');assert.ok(u.q('.stage-dialog')===dialog,'same startup dialog');
 assert.equal(dialog.dataset.selectedChoice,'1');assert.equal(u.q('.dropdown-menu'),null);assert.ok(u.document.activeElement===u.q('#stage-no'));
});
for(const key of ['Enter',' '])test(`startup bridge ${JSON.stringify(key)} with inactive header focus targets selected No, not header`,()=>{
 const u=setup();u.api.showStageDialog();u.key('ArrowRight');const actions=[],realNavigate=u.api.navigate;u.api.spyNavigation(action=>{actions.push(action);if(action==='home')realNavigate(action);});focusHeader(u);
 u.bridge(key);assert.deepEqual(actions,['home']);assertMenu(u,'home',0,'settings');assert.equal(u.q('.stage-dialog'),null);
});
test('startup external Left with inactive header focus toggles the selected answer only',()=>{
 const u=setup();u.api.showStageDialog();u.key('ArrowRight');focusHeader(u);u.pointer(u.q('[data-control-key="ArrowLeft"]'));
 assert.equal(u.api.state().mode,'stage');assert.equal(u.q('.stage-dialog').dataset.selectedChoice,'0');assert.equal(u.q('.dropdown-menu'),null);
});
test('welcome bridge Enter with inactive header focus opens prompt once, never a menu',()=>{
 const u=setup(),actions=[];u.api.spyNavigation(action=>actions.push(action));focusHeader(u);u.bridge('Enter');
 assert.equal(u.api.state().mode,'stage');assert.equal(u.q('.stage-dialog').dataset.selectedChoice,'0');assert.equal(u.q('.dropdown-menu'),null);assert.deepEqual(actions,[]);
});

for(const key of ['Enter',' '])test(`header ${JSON.stringify(key)} bridge release and duplicate old keyup cannot activate a submenu`,()=>{
 const u=seeded(),header=focusHeader(u),bridge=u.api.bridge(),code=key===' '?'Space':key;let clicks=0;
 header.addEventListener('click',()=>clicks++);bridge.keyDown({code,key});
 if(key==='Enter'){assertMenu(u,'help',1,'about');assert.equal(clicks,1);assert.deepEqual(bridge.pressedCodes,[],'header switch cancels original held Enter');}
 else{assertMenu(u,'textmenu',2,'notepad');assert.equal(clicks,0);assert.deepEqual(bridge.pressedCodes,['Space']);}
 bridge.keyUp({code});assertMenu(u,'help',1,'about');assert.equal(clicks,1);assert.deepEqual(bridge.pressedCodes,[]);
 bridge.keyUp({code});u.event(header,'keyup',{key,code});
 assertMenu(u,'help',1,'about');assert.equal(clicks,1);assert.deepEqual(u.routes,[]);assert.deepEqual(bridge.pressedCodes,[]);
});
test('pending header Space is cancelled by a newer header click and cannot win on old keyup',()=>{
 const u=seeded(),header=focusHeader(u),bridge=u.api.bridge();let oldClicks=0;header.addEventListener('click',()=>oldClicks++);
 bridge.keyDown({code:'Space',key:' '});assert.deepEqual(bridge.pressedCodes,['Space']);
 u.pointer(u.q('#menu [data-mode="stats"]'));assertMenu(u,'stats',3,'stats-keyAccuracy');assert.deepEqual(bridge.pressedCodes,[]);
 bridge.keyUp({code:'Space'});u.event(header,'keyup',{key:' ',code:'Space'});
 assertMenu(u,'stats',3,'stats-keyAccuracy');assert.equal(oldClicks,0);assert.deepEqual(u.routes,[]);
});
test('semantic row navigation from header focus drains its original bridge key on release',()=>{
 const u=seeded();const header=focusHeader(u),bridge=u.api.bridge();bridge.keyDown({code:'ArrowDown',key:'ArrowDown'});
 assertMenu(u,'textmenu',3,'exam');bridge.keyUp({code:'ArrowDown'});u.event(header,'keyup',{key:'ArrowDown',code:'ArrowDown'});
 assertMenu(u,'textmenu',3,'exam');assert.deepEqual(bridge.pressedCodes,[]);assert.deepEqual(u.routes,[]);
});
