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
      navigate,openMenu,showStageDialog,endApplication,handleMenuAction,
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

test('welcome Enter only opens startup choice, never also chooses Yes',()=>{
  const u=setup(),actions=[];u.api.spyNavigation(x=>actions.push(x));u.key('Enter',u.document.body);
  assert.equal(u.api.state().mode,'stage');assert.ok(u.document.activeElement===u.q('#stage-yes'),'Yes owns focus');assert.deepEqual(actions,[]);
});
test('welcome helper Enter only opens startup choice once',()=>{
  const u=setup(),actions=[];u.api.spyNavigation(x=>actions.push(x));helper(u,'Enter');
  assert.equal(u.api.state().mode,'stage');assert.deepEqual(actions,[]);
});
test('welcome pointer only dismisses welcome, without choosing Yes',()=>{
  const u=setup(),actions=[];u.api.spyNavigation(x=>actions.push(x));u.pointer(u.q('.welcome-original'));
  assert.equal(u.api.state().mode,'stage');assert.deepEqual(actions,[]);
});
test('stale boot completion does not reopen or steal focus after manual dismissal',async()=>{
  const u=setup();u.key('Enter',u.document.body);u.key('ArrowRight');u.key('Enter');
  const version=u.api.state().navigationVersion,focus=u.document.activeElement;await u.finishBoot();
  assert.equal(u.api.state().mode,'home');assert.equal(u.api.state().navigationVersion,version);assert.ok(u.document.activeElement===focus,'focus unchanged');
});
test('startup arrows choose No and physical Enter activates once',()=>{
  const u=choice(),actions=[];u.api.spyNavigation(x=>actions.push(x));u.key('ArrowRight');
  assert.ok(u.document.activeElement===u.q('#stage-no'),'No owns focus');u.key('ArrowLeft');
  assert.ok(u.document.activeElement===u.q('#stage-yes'),'Yes owns focus');u.key('Enter');assert.deepEqual(actions,['keys']);
});
test('startup helper Enter activates Yes exactly once',()=>{
  const u=choice(),actions=[];u.api.spyNavigation(x=>actions.push(x));helper(u,'Enter');assert.deepEqual(actions,['keys']);
});
for(const exit of ['Escape','close','No'])test(`startup ${exit} returns Home and can reopen choice`,()=>{
  const u=choice();if(exit==='Escape')u.key('Escape');else if(exit==='No'){u.key('ArrowRight');u.key('Enter')}else u.pointer(u.q('.stage-dialog .dialog-close'));
  assert.equal(u.api.state().mode,'home');assert.equal(u.api.state().openMenuId,'home');assert.ok(u.document.activeElement===u.q('.dropdown-menu'),'menu owns focus');
  u.api.showStageDialog();assert.equal(u.api.state().mode,'stage');assert.ok(u.document.activeElement===u.q('#stage-yes'),'Yes owns focus');
});
test('startup unselected No first selects and second activation confirms',()=>{
  const u=choice();u.pointer(u.q('#stage-no'));assert.equal(u.api.state().mode,'stage','first different-answer click selects only');
  assert.ok(u.document.activeElement===u.q('#stage-no'),'selected No owns focus');
  u.pointer(u.q('#stage-no'));assert.equal(u.api.state().mode,'home');assert.equal(u.api.state().openMenuId,'home');
});
test('startup changing pointer selection back to Yes does not activate it prematurely',()=>{
  const u=choice(),actions=[];u.api.spyNavigation(x=>actions.push(x));u.pointer(u.q('#stage-no'));u.pointer(u.q('#stage-yes'));
  assert.deepEqual(actions,[]);u.pointer(u.q('#stage-yes'));assert.deepEqual(actions,['keys']);
});
for(const phase of ['welcome','stage','menu'])test(`keyboard-open never navigates from ${phase}`,()=>{
  const u=phase==='stage'?choice():phase==='menu'?main('words',2):setup();
  const before=u.api.state(),actions=[];u.api.spyNavigation(x=>actions.push(x));u.pointer(u.q('#focus-input'));
  assert.deepEqual(actions,[]);assert.equal(u.api.state().mode,before.mode);assert.equal(u.api.state().openMenuId,before.openMenuId);
});
test('visibility helper owns physical arrows while explicit controls retain semantic menu ownership',()=>{
  const u=main('textmenu',2);u.pointer(u.q('#focus-input'));u.q('#focus-input').focus();u.key('ArrowDown');
  assert.equal(u.api.state().openMenuId,'textmenu');assert.equal(u.api.state().openMenuIndex,2);
  helper(u,'ArrowDown');assert.equal(u.api.state().openMenuId,'textmenu');assert.equal(u.api.state().openMenuIndex,3);
});
test('same-header pointer remains a no-op with arrows still operating selected menu',()=>{
  const u=main('textmenu',2);u.pointer(u.q('#menu [data-mode="textmenu"]'));
  assert.equal(u.api.state().openMenuId,'textmenu');assert.equal(u.api.state().openMenuIndex,2);
  u.key('ArrowDown');assert.equal(u.api.state().openMenuIndex,3);u.key('ArrowRight');assert.equal(u.api.state().openMenuId,'play');
});
test('blank-frame pointer is a no-op with arrows still operating selected menu',()=>{
  const u=main('textmenu',2);u.pointer(u.q('#workspace'));
  assert.equal(u.api.state().openMenuId,'textmenu');assert.equal(u.api.state().openMenuIndex,2);
  u.key('ArrowDown');assert.equal(u.api.state().openMenuIndex,3);u.key('ArrowRight');assert.equal(u.api.state().openMenuId,'play');
});
test('Escape keeps main dropdown, selection, and keyboard operation intact',()=>{
  const u=main('textmenu',2);const menu=u.q('.dropdown-menu');u.key('Escape');
  assert.ok(u.q('.dropdown-menu')===menu,'same menu remains open');assert.equal(u.api.state().openMenuIndex,2);u.key('ArrowDown');assert.equal(u.api.state().openMenuIndex,3);
});
test('different header switches directly and remains keyboard operable',()=>{
  const u=main('textmenu',2);u.pointer(u.q('#menu [data-mode="stats"]'));assert.equal(u.api.state().openMenuId,'stats');
  u.key('ArrowDown');assert.equal(u.api.state().openMenuIndex,1);
});
test('Up and Down wrap; Home/PageUp and End/PageDown bound selection',()=>{
  const u=main('textmenu',0);for(const [key,expected]of [['ArrowUp',4],['ArrowDown',0],['End',4],['Home',0],['PageDown',4],['PageUp',0]]){
    u.key(key);assert.equal(u.api.state().openMenuIndex,expected,key);
  }
});
test('Left and Right wrap all seven headers and remember item selection',()=>{
  const u=main('textmenu',3);u.key('ArrowRight');u.key('ArrowLeft');assert.equal(u.api.state().openMenuIndex,3);
  u.api.openMenu('home',0);u.key('ArrowLeft');assert.equal(u.api.state().openMenuId,'help');u.key('ArrowRight');assert.equal(u.api.state().openMenuId,'home');
});
test('every menu item emits exactly one selected route without entering destination',()=>{
  const u=main(),actions=[];u.api.spyActions(x=>actions.push(x));
  for(const id of ['home','keys','words','textmenu','play','stats','help']){
    u.api.openMenu(id,0);const expected=[...u.q('.dropdown-menu').children].map(x=>x.dataset.action);
    for(const [index,action]of expected.entries()){
      for(const key of ['Enter',' ']){actions.length=0;u.api.openMenu(id,index);u.key(key);assert.deepEqual(actions,[action],`${id} ${index} ${key}`);}
    }
  }
});
test('helper Enter and Space activate menu action once, with no duplicate bubble activation',()=>{
  for(const key of ['Enter',' ']){const u=main('textmenu',3),actions=[];u.api.spyActions(x=>actions.push(x));helper(u,key);assert.deepEqual(actions,['exam']);}
});
test('menu pointer and touch-like activation emit one selected route',()=>{
  for(const pointerType of ['mouse','touch']){const u=main('textmenu',3),actions=[];u.api.spyActions(x=>actions.push(x));u.pointer(u.q('[data-action="exam"]'),pointerType);assert.deepEqual(actions,['exam']);}
});
test('control toggle itself does not navigate and preserves menu arrow operation',()=>{
  const u=main('textmenu',2);u.pointer(u.q('#control-toggle'));assert.equal(u.q('#external-controls').hidden,false);
  u.key('ArrowDown');assert.equal(u.api.state().openMenuIndex,3);
});
test('startup parent blank click cannot strand choice keyboard operation',()=>{
  const u=choice();u.pointer(u.q('#workspace'));u.key('ArrowRight');assert.ok(u.document.activeElement===u.q('#stage-no'),'No owns focus');
});
test('explicit exited state keeps distinct restart behavior',()=>{
  const u=main();u.api.endApplication();assert.equal(u.api.state().mode,'exited');assert.equal(u.q('#focus-input').textContent,'다시 시작');
  u.pointer(u.q('#focus-input'));assert.equal(u.reloads(),1);
});
for(const phase of ['welcome','stage','menu'])test(`physical Enter belongs to focused outside helper in ${phase}`,()=>{
  const u=phase==='stage'?choice():phase==='menu'?main('textmenu',2):setup();
  const before=u.api.state();u.q('#help-toggle').focus();const e=u.key('Enter');
  assert.equal(e.defaultPrevented,false,'native-screen handler cannot swallow helper Enter');
  assert.equal(u.q('#outside-help').hidden,false,'helper activates normally');
  assert.equal(u.api.state().mode,before.mode);assert.equal(u.api.state().openMenuId,before.openMenuId);assert.equal(u.api.state().openMenuIndex,before.openMenuIndex);
});
test('helper controls recover current menu owner after focus on an unrelated outside control',()=>{
  const u=main('textmenu',2);u.q('#help-toggle').focus();helper(u,'ArrowDown');assert.equal(u.api.state().openMenuId,'textmenu');assert.equal(u.api.state().openMenuIndex,3);
});
test('pure modifier does not dismiss welcome',()=>{
  const u=setup();for(const key of ['Shift','Control','Alt','Meta'])u.key(key,u.document.body);
  assert.equal(u.api.state().mode,'home');assert.ok(u.q('.welcome-original'));assert.equal(u.q('.stage-dialog'),null);
});
test('F1 dispatches help once while Alt-X and Alt-H exit instead',()=>{
  const u=main('textmenu',2),actions=[];u.api.spyNavigation(x=>actions.push(x));u.key('F1');assert.deepEqual(actions,['help']);
  for(const code of ['KeyX','KeyH']){const next=main();next.key(code.slice(-1).toLowerCase(),next.document.activeElement,{altKey:true,code});assert.equal(next.api.state().mode,'exited');}
});

// Additional main-screen focus-ownership regression cases.
for(const key of ['Enter',' '])test(`focused startup close owns ${key===' '?'Space':key} and cannot accept Yes`,()=>{
  const u=choice(),actions=[];u.api.spyNavigation(value=>actions.push(value));
  u.q('.stage-dialog .dialog-close').focus();u.key(key);
  assert.deepEqual(actions,['home'],'close must route cancel once, never the selected Yes lesson');
});
for(const key of ['Enter',' '])test(`focused main close owns ${key===' '?'Space':key} and exits exactly once`,()=>{
  const u=main('textmenu',2);u.q('#close').focus();u.key(key);
  assert.equal(u.api.state().mode,'exited');assert.equal(u.q('#frame-box').hidden,true);assert.equal(u.reloads(),0);
});
test('all six startup choice navigation keys toggle rather than select menu endpoints',()=>{
  const u=choice(),actions=[];u.api.spyNavigation(value=>actions.push(value));
  for(const key of ['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown']){
    u.key(key);assert.equal(u.q('.stage-dialog').dataset.selectedChoice,'1',key+' selects No from Yes');
    u.key(key);assert.equal(u.q('.stage-dialog').dataset.selectedChoice,'0',key+' selects Yes from No');
  }
  assert.deepEqual(actions,[]);
});
test('all seven menus retain one owner and obey every boundary without routing',()=>{
  const u=main(),actions=[];u.api.spyActions(value=>actions.push(value));
  const headers=['home','keys','words','textmenu','play','stats','help'];
  assert.deepEqual([...u.q('#menu').children].map(button=>button.dataset.mode),headers);
  for(const header of headers){
    u.api.openMenu(header,0);const last=u.q('.dropdown-menu').children.length-1;assert.ok(last>=0);
    for(const [key,index]of [['ArrowUp',last],['ArrowDown',0],['End',last],['Home',0],['PageDown',last],['PageUp',0]]){
      u.key(key);assert.equal(u.api.state().openMenuIndex,index,header+' '+key);
      assert.equal(u.document.querySelectorAll('.dropdown-menu').length,1);assert.equal(u.document.querySelectorAll('.dropdown-menu .chosen').length,1);
    }
    u.key('End');u.key('ArrowRight');u.key('ArrowLeft');assert.equal(u.api.state().openMenuId,header);assert.equal(u.api.state().openMenuIndex,last);
  }
  assert.deepEqual(actions,[]);
});
test('main unselected row activates on its first pointer gesture unlike startup answers',()=>{
  const u=main('textmenu',0),actions=[];u.api.spyActions(value=>actions.push(value));u.pointer(u.q('[data-action="exam"]'));
  assert.deepEqual(actions,['exam']);
});
for(const selector of ['.titlebar>span','#status'])test(`main inert frame ${selector} preserves nonzero row and physical key ownership`,()=>{
  const u=main('textmenu',2),actions=[];u.api.spyActions(value=>actions.push(value));u.pointer(u.q(selector));
  assert.equal(u.api.state().openMenuId,'textmenu');assert.equal(u.api.state().openMenuIndex,2);
  u.key('ArrowDown');assert.equal(u.api.state().openMenuIndex,3);u.key('Enter');assert.deepEqual(actions,['exam']);
});
for(const selector of ['.stage-copy','#menu [data-mode="help"]'])test(`startup inert parent ${selector} cannot strand selected answer`,()=>{
  const u=choice(),actions=[];u.api.spyNavigation(value=>actions.push(value));u.pointer(u.q(selector));
  assert.equal(u.api.state().mode,'stage');assert.equal(u.q('.stage-dialog').dataset.selectedChoice,'0');
  u.key('ArrowRight');assert.equal(u.q('.stage-dialog').dataset.selectedChoice,'1');u.key('Enter');assert.deepEqual(actions,['home']);
});
test('older delayed route cannot overwrite a later selected main menu',async()=>{
  const u=setup({delayed:['stats-speed']});u.api.navigate('home');const pending=u.api.handleMenuAction('stats-speed');
  u.api.navigate('home');u.api.openMenu('textmenu',2);const menu=u.q('.dropdown-menu'),version=u.api.state().navigationVersion;
  u.resolvePause('stats-speed');await pending;
  assert.equal(u.api.state().mode,'home');assert.equal(u.api.state().openMenuId,'textmenu');assert.equal(u.api.state().openMenuIndex,2);
  assert.equal(u.api.state().navigationVersion,version);assert.equal(u.q('.dropdown-menu'),menu);assert.equal(u.q('#workspace').hasAttribute('aria-busy'),false);
});
test('three safe About cycles return to the remembered Help About row',()=>{
  const u=main('help',1);
  for(let i=0;i<3;i++){u.api.navigate('about');u.pointer(u.q('.welcome-original'));assert.equal(u.api.state().mode,'home');assert.equal(u.api.state().openMenuId,'help');assert.equal(u.api.state().openMenuIndex,1);assert.equal(u.document.querySelectorAll('.dropdown-menu').length,1);}
});

// Independent additive focus-scope suite. Reuses the unchanged prepared harness,
// not its assertions. Pointer/default focus are a simulation, not browser proof.
const mainInert=['#workspace','.titlebar>span','#status','#language','#clock','.statusbar','.titlebar','.classic','#menu'];
for(const selector of mainInert)test(`inert main ${selector} restores existing menu without state/write/DOM mutation`,()=>{
 const u=main('textmenu',2),menu=u.q('.dropdown-menu'),state=u.api.state(),stored=u.stored(),actions=[];
 u.api.spyActions(action=>actions.push(action));u.q('#help-toggle').focus();u.pointer(u.q(selector));
 assert.deepEqual(u.api.state(),state);assert.deepEqual(u.stored(),stored);assert.ok(u.q('.dropdown-menu')===menu,'existing menu retained');assert.ok(u.document.activeElement===menu,'existing menu owns focus');assert.deepEqual(actions,[]);
 u.key('Escape');assert.ok(u.q('.dropdown-menu')===menu,'existing menu retained');assert.equal(u.api.state().openMenuIndex,2);
 u.key('ArrowDown');assert.equal(u.api.state().openMenuIndex,3);u.key('Enter');assert.deepEqual(actions,['exam']);
});
const promptInert=['#workspace','.stage-copy','.stage-question','.stage-dialog h1','.stage-dialog','.titlebar>span','#status','#menu [data-mode="help"]','#close'];
for(const selector of promptInert)test(`inert startup ${selector} restores selected No without state/write/DOM mutation`,()=>{
 const u=choice();u.key('ArrowRight');const dialog=u.q('.stage-dialog'),state=u.api.state(),stored=u.stored(),actions=[];
 u.api.spyNavigation(action=>actions.push(action));u.q('#help-toggle').focus();u.pointer(u.q(selector));
 assert.deepEqual(u.api.state(),state);assert.deepEqual(u.stored(),stored);assert.ok(u.q('.stage-dialog')===dialog,'existing dialog retained');assert.equal(dialog.dataset.selectedChoice,'1');assert.ok(u.document.activeElement===u.q('#stage-no'),'selected No owns focus');assert.deepEqual(actions,[]);
 u.key('ArrowLeft');assert.equal(dialog.dataset.selectedChoice,'0');u.key('ArrowRight');u.key('Enter');assert.deepEqual(actions,['home']);
});
for(const phase of ['menu','stage'])test(`inert ${phase} click recovers semantic owner, not focused close`,()=>{
 const u=phase==='stage'?choice():main('textmenu',2);if(phase==='stage')u.key('ArrowRight');
 const close=phase==='stage'?u.q('.stage-dialog .dialog-close'):u.q('#close');close.focus();u.pointer(u.q('#status'));
 assert.ok(u.document.activeElement===(phase==='stage'?u.q('#stage-no'):u.q('.dropdown-menu')),'semantic owner restored');
});
for(const phase of ['menu','stage'])for(const selector of ['#focus-input','#help-toggle'])test(`outside ${selector} retains pointer/physical-key ownership during ${phase}`,()=>{
 const u=phase==='stage'?choice():main('textmenu',2),state=u.api.state();u.pointer(u.q(selector));assert.ok(u.document.activeElement===u.q(selector),'outside helper owns focus');
 assert.deepEqual(u.api.state(),state);u.key('ArrowRight');assert.deepEqual(u.api.state(),state);
});
for(const phase of ['menu','stage'])for(const selector of ['#frame-box','.app-wrap','#virtual-keyboard-panel','#outside-help'])test(`outside blank ${selector} does not reclaim focus during ${phase}`,()=>{
 const u=phase==='stage'?choice():main('textmenu',2),state=u.api.state();u.pointer(u.q(selector));assert.ok(u.document.activeElement===u.document.body,'no frame focus recovery');assert.deepEqual(u.api.state(),state);
});
test('main same header retains existing menu while different header switches exactly once',()=>{
 const u=main('textmenu',2),menu=u.q('.dropdown-menu'),state=u.api.state();u.pointer(u.q('#menu [data-mode="textmenu"]'));assert.ok(u.q('.dropdown-menu')===menu,'existing menu retained');assert.deepEqual(u.api.state(),state);
 u.pointer(u.q('#menu [data-mode="stats"]'));assert.equal(u.api.state().openMenuId,'stats');assert.equal(u.api.state().openMenuIndex,0);assert.equal(u.document.querySelectorAll('.dropdown-menu').length,1);assert.ok(u.document.activeElement===u.q('.dropdown-menu'),'new menu owns focus');
});
test('main row active click dispatches just once without focus-repair recreation',()=>{
 const u=main('textmenu',0),actions=[],menu=u.q('.dropdown-menu');u.api.spyActions(action=>actions.push(action));u.pointer(u.q('[data-action="exam"]'));
 assert.deepEqual(actions,['exam']);assert.ok(u.q('.dropdown-menu')===menu,'existing menu retained');assert.equal(u.api.state().openMenuIndex,3);
});
test('startup answer clicks retain select-then-confirm semantics in both directions',()=>{
 const u=choice(),actions=[];u.api.spyNavigation(action=>actions.push(action));u.pointer(u.q('#stage-no'));assert.equal(u.q('.stage-dialog').dataset.selectedChoice,'1');assert.deepEqual(actions,[]);
 u.pointer(u.q('#stage-yes'));assert.equal(u.q('.stage-dialog').dataset.selectedChoice,'0');assert.deepEqual(actions,[]);u.pointer(u.q('#stage-yes'));assert.deepEqual(actions,['keys']);
});
test('startup active close still cancels once instead of being redirected to selected Yes',()=>{
 const u=choice(),actions=[];u.api.spyNavigation(action=>actions.push(action));u.pointer(u.q('.stage-dialog .dialog-close'));assert.deepEqual(actions,['home']);
});
test('main active close exits, without recreating the menu',()=>{
 const u=main('textmenu',2);u.pointer(u.q('#close'));assert.equal(u.api.state().mode,'exited');assert.equal(u.q('.dropdown-menu'),null);assert.ok(u.document.activeElement===u.q('#focus-input'),'restart owns focus');
});
test('pending asynchronous route does not gain a fabricated menu from inert clicks',async()=>{
 const u=setup({delayed:['stats-speed']});u.api.navigate('home');const pending=u.api.handleMenuAction('stats-speed'),state=u.api.state();
 u.pointer(u.q('#status'));assert.deepEqual(u.api.state(),state);assert.equal(u.q('.dropdown-menu'),null);assert.ok(u.document.activeElement===u.document.body,'no frame focus recovery');
 // Cancel the bounded route before completion. Do not enter an interior screen.
 u.api.navigate('home');u.resolvePause('stats-speed');await pending;
});
for(const mode of ['settings','keys','words','sentences','long','play','exited'])test(`inert repair remains inactive in synthetic ${mode} mode`,()=>{
 const u=main('textmenu',2);u.api.setModeForScopeTest(mode);const state=u.api.state();u.pointer(u.q('#status'));assert.deepEqual(u.api.state(),state);assert.ok(u.document.activeElement===u.document.body,'no frame focus recovery');
});
for(const phase of ['menu','stage'])test(`canceled inert click is not overridden during ${phase}`,()=>{
 const u=phase==='stage'?choice():main('textmenu',2),target=u.q('#status'),state=u.api.state();target.addEventListener('click',event=>event.preventDefault());
 u.pointer(target);assert.deepEqual(u.api.state(),state);assert.ok(u.document.activeElement===u.document.body,'canceled click does not reclaim focus');
});
for(const phase of ['menu','stage'])for(const button of [1,2])test(`non-primary inert button ${button} is ignored during ${phase}`,()=>{
 const u=phase==='stage'?choice():main('textmenu',2),target=u.q('#status'),state=u.api.state();u.q('#help-toggle').focus();u.event(target,'click',{button});
 assert.deepEqual(u.api.state(),state);assert.ok(u.document.activeElement===u.q('#help-toggle'),'non-primary click preserves external focus');
});
for(const phase of ['menu','stage'])for(const tag of ['button','input','select','textarea','a','div'])test(`active ${tag} fixture inside ${phase} is not focus-stolen`,()=>{
 const u=phase==='stage'?choice():main('textmenu',2),control=u.document.createElement(tag),state=u.api.state();
 if(tag==='a')control.href='#fixture';if(tag==='div')control.setAttribute('contenteditable','true');
 (phase==='stage'?u.q('.stage-dialog'):u.q('#workspace')).append(control);control.focus();u.event(control,'click',{button:0});
 assert.deepEqual(u.api.state(),state);assert.ok(u.document.activeElement===control,'active fixture retains focus');
});
