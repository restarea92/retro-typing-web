import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const {parseHTML} = resourceTestsEnabled ? await import('linkedom') : {};

const appURL=new URL('../app.js',import.meta.url);
const source=fs.readFileSync(appURL,'utf8');
console.log('SOURCE_SHA256',crypto.createHash('sha256').update(source).digest('hex'));
console.log('EVIDENCE: simulated DOM; browser default focus/activation explicitly modeled; not real browser or iOS.');
const imports={};
if(resourceTestsEnabled)for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)){
  const mod=await import(new URL(match[2],appURL));
  for(const key of match[1].split(',').map(x=>x.trim()))imports[key]=mod[key];
}

function setup({delayed=[]}={}){
  const {window,document}=parseHTML(fs.readFileSync(new URL('index.html',appURL),'utf8'));
  Object.assign(globalThis,{window,document});
  let reloads=0,resolveBoot;const pending=new Map();
  const saved=new Map();
  window.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v))};
  window.location={reload(){reloads++}};
  window.HTMLElement.prototype.focus=function(){
    if(document._active===this)return;
    document._active?.dispatchEvent(new window.Event('focusout',{bubbles:true}));
    document._active=this;
    this.dispatchEvent(new window.Event('focusin',{bubbles:true}));
  };
  Object.defineProperty(document,'activeElement',{get:()=>document._active||document.body});
  window.HTMLElement.prototype.scrollIntoView=function(){};
  Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{get(){return 640},configurable:true});
  // Renderer/audio are excluded from the next-main logical tests. The real bridge remains active.
  const binding={...imports,createVirtualKeyboard:(_container,options={})=>({
    setLayout(){},setPressed(){},setModifiers(){},releaseAll(){},destroy(){},
    setVisible(visible){options.onVisibilityChange?.(visible)}
  }),pauseFor:action=>action==='boot'?new Promise(resolve=>resolveBoot=resolve):delayed.includes(action)?new Promise(resolve=>pending.set(action,resolve)):Promise.resolve()};
  const body=source.replace(/^import .*;$/mg,'').replace(/import\('\.\//g,`import('${new URL('.',appURL).href}`);
  const run=new Function(...Object.keys(binding),'setInterval',body+`
    return {
      navigate,openMenu,showStageDialog,endApplication,handleMenuAction,bridge:()=>keyboardBridge,
      state:()=>({mode,openMenuId,openMenuIndex,mainMenuId,mainMenuIndex,navigationVersion,selectedStage}),
      setModeForScopeTest:value=>{mode=value},
      spyActions:fn=>{handleMenuAction=fn},spyNavigation:fn=>{navigate=fn}
    };
  `);
  const api=run(...Object.values(binding),()=>0);
  const q=selector=>document.querySelector(selector);
  const event=(target,type,fields={})=>{
    const e=new window.Event(type,{bubbles:true,cancelable:true});
    Object.assign(e,fields);target.dispatchEvent(e);return e;
  };
  const key=(key,target=document.activeElement,{activate=true,...extra}={})=>{
    const e=event(target,'keydown',{key,code:key===' '?'Space':key,...extra});
    if(activate&&!e.defaultPrevented&&target.tagName==='BUTTON'&&(key==='Enter'||key===' '))target.click();
    event(target,'keyup',{key,code:key===' '?'Space':key,...extra});return e;
  };
  const pointer=(target,pointerType='mouse')=>{
    const p=event(target,'pointerdown',{pointerType,button:0,detail:1});
    const m=p.defaultPrevented?null:event(target,'mousedown',{button:0,detail:1});
    if(!p.defaultPrevented&&!m?.defaultPrevented){
      const focusable=target.closest('button,input,textarea,[tabindex]');
      (focusable||document.body).focus();
    }
    event(target,'pointerup',{pointerType,button:0,detail:1});
    event(target,'mouseup',{button:0,detail:1});
    return event(target,'click',{button:0,detail:1,pointerType});
  };
  return {api,q,document,key,pointer,event,resolvePause:action=>{assert.ok(pending.has(action),'requested pause exists');pending.get(action)();},finishBoot:async()=>{resolveBoot();await Promise.resolve()},reloads:()=>reloads,stored:()=>[...saved]};
}

function main(id='home',index=0){const u=setup();u.api.navigate('home');u.api.openMenu(id,index);return u;}
function choice(){const u=setup();u.api.showStageDialog();return u;}
function helper(u,key){u.pointer(u.q(`[data-control-key="${key}"]`));}


// Additional welcome lifecycle coverage only. No lesson/game or browser input.
test('uninterrupted boot opens one Yes-focused prompt exactly once',async()=>{
 const u=setup();assert.ok(u.q('.welcome-original'));const before=u.api.state().navigationVersion;
 await u.finishBoot();const dialog=u.q('.stage-dialog');assert.ok(dialog);assert.equal(u.api.state().mode,'stage');
 assert.equal(u.api.state().navigationVersion,before+1);assert.equal(u.document.activeElement,u.q('#stage-yes'));
 await u.finishBoot();assert.equal(u.q('.stage-dialog'),dialog);assert.equal(u.api.state().navigationVersion,before+1);
});
test('early physical Space cancels its old event; stale boot cannot replace the prompt',async()=>{
 const u=setup(),actions=[];u.api.spyNavigation(action=>actions.push(action));
 const down=u.key(' ',u.document.body);assert.equal(down.defaultPrevented,true);const dialog=u.q('.stage-dialog');
 assert.ok(dialog);assert.equal(u.document.activeElement,u.q('#stage-yes'));assert.deepEqual(actions,[]);
 const version=u.api.state().navigationVersion;await u.finishBoot();assert.equal(u.q('.stage-dialog'),dialog);
 assert.equal(u.api.state().navigationVersion,version);assert.deepEqual(actions,[]);
});
test('early Escape dismisses welcome only; second Escape cancels and invalidates stale boot',async()=>{
 const u=setup();u.key('Escape',u.document.body);assert.equal(u.api.state().mode,'stage');
 u.key('Escape');assert.equal(u.api.state().mode,'home');assert.equal(u.api.state().openMenuId,'home');
 const menu=u.q('.dropdown-menu'),version=u.api.state().navigationVersion;await u.finishBoot();
 assert.equal(u.q('.dropdown-menu'),menu);assert.equal(u.q('.stage-dialog'),null);assert.equal(u.api.state().navigationVersion,version);
});
test('all seven pure modifier keys leave welcome alone until its independent boot deadline',async()=>{
 const u=setup();for(const key of ['Shift','Control','Alt','Meta','CapsLock','NumLock','ScrollLock']){
  u.key(key,u.document.body);assert.ok(u.q('.welcome-original'));assert.equal(u.q('.stage-dialog'),null);
 }
 await u.finishBoot();assert.equal(u.api.state().mode,'stage');assert.equal(u.document.activeElement,u.q('#stage-yes'));
});
test('held virtual Space crosses welcome once; old release never accepts the new Yes owner',()=>{
 const u=setup(),actions=[];u.api.spyNavigation(action=>actions.push(action));const bridge=u.api.bridge();
 bridge.keyDown({code:'Space'});assert.equal(u.api.state().mode,'stage');assert.deepEqual(actions,[]);
 bridge.keyUp({code:'Space'});assert.deepEqual(actions,[]);assert.deepEqual(bridge.pressedCodes,[]);
 bridge.keyDown({code:'Space'});bridge.keyUp({code:'Space'});assert.deepEqual(actions,['keys']);
});
test('a separate later typematic Space remains eligible after startup prompt has appeared',()=>{
 const u=setup(),actions=[];u.api.spyNavigation(action=>actions.push(action));u.key(' ',u.document.body);
 assert.deepEqual(actions,[]);u.key(' ',u.document.activeElement,{repeat:true});assert.deepEqual(actions,['keys']);
});
test('three real handler About boundary cycles restore Help/About after different dismissal sources',async()=>{
 const u=main('help',1);for(const dismiss of ['Escape','pointer',' ']){
  await u.api.handleMenuAction('about');assert.equal(u.api.state().mode,'about');assert.ok(u.q('.welcome-original'));
  if(dismiss==='pointer')u.pointer(u.q('.welcome-original'));else u.key(dismiss,u.document.body);
  assert.equal(u.api.state().mode,'home');assert.equal(u.api.state().openMenuId,'help');assert.equal(u.api.state().openMenuIndex,1);
  assert.equal(u.document.querySelectorAll('.dropdown-menu').length,1);assert.equal(u.q('.stage-dialog'),null);
 }
});
test('read-only lifecycle run left the exact frozen app unchanged',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(appURL)).digest('hex'),crypto.createHash('sha256').update(source).digest('hex'));
});
