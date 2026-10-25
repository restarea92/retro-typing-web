/** Reduced synthetic targets and simulated clocks isolate regression boundaries.
 * These tests are not full-length gameplay, browser pixels, or native OS input. */
import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
const {api,document}=resourceTestsEnabled?await import('./dom-harness.mjs'):{};
const {renderExtras}=resourceTestsEnabled?await import('../extras.js'):{};
const {originalElapsedTicks}=resourceTestsEnabled?await import('../original-metrics.js'):{};
const {originalClockSeconds}=resourceTestsEnabled?await import('../original-idle.js'):{};
const $=selector=>document.querySelector(selector);
function press(element,key,code=key){const e=new document.defaultView.Event('keydown',{bubbles:true,cancelable:true});Object.assign(e,{key,code});element.dispatchEvent(e);return e;}
function beginLong(rows){api.navigate('home');api.setLanguage('en','us');api.startLongFixture(rows.join('\n'));}
function finishRow(text='a'){const input=$('.long-dialog textarea:not([readonly])');assert.ok(input);for(const c of text)press(input,c,'Key'+c.toUpperCase());press(input,'Enter');}
function values(){return [...$('.long-result-dialog').querySelectorAll('dd')].map(e=>e.textContent);}

test('long practice waits on each page, reports page-only fields, and dismisses final short page once',()=>{
 beginLong([...Array(5).fill('a'),...Array(2).fill('bb')]);const before=api.getState().progress.length;
 for(let i=0;i<5;i++)finishRow();
 assert.ok($('.long-result-dialog'));assert.match($('.long-dialog h1').textContent,/p\.\s*1/);assert.equal(api.getLongState().longIndex,5);
 assert.equal(values()[0],'5 타');assert.equal(values()[1],'5 타');assert.equal(values()[4],'100 %');assert.equal(api.getState().progress.length,before+1);
 assert.ok(api.currentInputOwner()===$('.long-result-dialog'));assert.equal($('.practice-caret'),null);
 for(const key of ['PageDown','PageUp','x','Tab'])press(document.activeElement,key);
 api.setCoreIdleLast(originalClockSeconds()-61);api.checkCoreIdle();assert.ok($('.long-result-dialog'));assert.equal(api.getLongState().longIndex,5);
 press(document.activeElement,' ');assert.equal($('.long-result-dialog'),null);assert.equal($('.long-dialog textarea:not([readonly])').value,'');
 finishRow('bb');finishRow('bb');assert.ok($('.long-result-dialog'));assert.match($('.long-dialog h1').textContent,/p\.\s*2/);assert.equal(values()[0],'4 타');assert.equal(values()[1],'4 타');assert.equal(api.getState().progress.length,before+2);
 const final=$('.long-result-dialog');press(final,'Enter');assert.ok($('.long-select'));press(final,'Enter');assert.equal(api.getState().progress.length,before+2);api.navigate('home');
});
test('long page-result Escape and close exit without advancing or duplicate records',()=>{
 for(const close of ['Escape','click']){beginLong(Array(6).fill('a'));for(let i=0;i<5;i++)finishRow();const count=api.getState().progress.length;
 if(close==='click')$('.long-result-dialog button').click();else press(document.activeElement,'Escape');
 assert.ok($('.long-select'));assert.equal(api.getState().progress.length,count);assert.equal(api.getLongState().longIndex,5);}
 api.navigate('home');
});
test('manual and natural forward reentry both discard stale partial page input',()=>{
 beginLong(Array(20).fill('abc'));for(let i=0;i<3;i++)press(document.activeElement,'PageDown');
 finishRow('abc');press(document.activeElement,'a','KeyA');assert.equal(api.getLongState().longTyped[16],'a');
 for(let i=0;i<3;i++)press(document.activeElement,'PageUp');
 for(let page=0;page<3;page++){for(let i=0;i<5;i++)finishRow('abc');press(document.activeElement,'Enter');}
 assert.equal(api.getLongState().longPage,3);assert.equal(api.getLongState().longIndex,15);
 assert.deepEqual(api.getLongState().longTyped.slice(15,20),Array(5).fill(''));assert.ok(api.getLongState().longResults.slice(15,20).every(x=>x===undefined));assert.equal($('.long-dialog textarea:not([readonly])').value,'');
 finishRow('abc');assert.equal(api.getLongState().longIndex,16);assert.equal($('.long-dialog textarea:not([readonly])').value,'');api.navigate('home');
});
for(const kind of ['rain','invaders'])test(`${kind} special blocking wait bypasses idle but resumed gameplay still times out`,()=>{
 api.navigate('home');api.setLanguage('en','us');api.setGameStage(3);kind==='rain'?api.setupRain():api.setupInvaders();api.beginGame();
 const state=api.getGameState();state.awaitingNext=true;const score=api.getState().gameScore;
 api.setCoreIdleLast(originalClockSeconds()-61);api.checkCoreIdle();assert.equal(api.getState().gamePhase,'running');assert.equal(api.getState().gameStage,3);
 press($('#game-input'),' ');assert.equal(api.getState().gameStage,4);assert.equal(api.getState().gamePhase,'intro');assert.ok(api.getState().gameScore>score);
 press($('#game-input'),' ');api.checkCoreIdle();assert.equal(api.getState().gamePhase,'running');
 api.setCoreIdleLast(originalClockSeconds()-61);api.checkCoreIdle();assert.equal(api.getState().gamePhase,'select');api.navigate('home');
});
for(const rows of [1,5,6,17,20])test(`exam EOF heading advances beyond ${rows} rows without changing totals`,()=>{
 api.navigate('home');const container=document.createElement('div');document.body.append(container);const records=[];
 const cleanup=renderExtras(container,'exam',{language:'en',settings:{layout:'us'},longTexts:[{id:'synthetic',language:'en',title:'Synthetic',text:Array(rows).fill('a').join('\n')}],onRecord:r=>records.push(r)});
 press(container.querySelector('[role=listbox]'),'Enter');let input=container.querySelector('textarea');press(input,' ');
 for(let i=0;i<rows;i++){press(input,'a','KeyA');press(input,'Enter');}
 const modal=container.querySelector('.extra-exam-result-modal');assert.ok(modal);assert.match(container.querySelector('.extra-window>h1').textContent,new RegExp('p\\.\\s*'+(Math.ceil(rows/5)+1)+'\\)'));
 assert.equal(records.length,1);assert.equal(records[0].correct,rows);assert.equal(records[0].errors,0);assert.equal(records[0].enteredGlyphs,rows);
 press(modal,' ');assert.ok(container.querySelector('.extra-exam-result-modal'));press(modal,'Enter');assert.ok(container.querySelector('[role=listbox]'));assert.equal(records.length,1);cleanup();container.remove();
});
test('long result keeps wrong-character metrics page-local and excludes modal wait from timing',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(performance,'now');let now=1000;Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
 try{beginLong(Array(6).fill('ab'));
  const finishWrong=()=>{const input=$('.long-dialog textarea:not([readonly])');press(input,'a','KeyA');now+=1000;press(input,'x','KeyX');press(input,'Enter');};
  for(let i=0;i<5;i++)finishWrong();let entry=api.getState().progress.at(-1);assert.equal(entry.entered,10);assert.equal(entry.correct,5);assert.equal(entry.accuracy,50);assert.equal(entry.elapsedTicks,originalElapsedTicks(1000,6000));assert.equal(values()[0],'10 타');assert.equal(values()[1],'5 타');assert.equal(values()[2],(entry.elapsedMs/1000).toFixed(1)+' 초');assert.equal(values()[3],entry.cpm+' 타/분');assert.equal(values()[4],'50 %');
  now+=61000;api.checkCoreIdle();assert.ok($('.long-result-dialog'));press(document.activeElement,'Enter');finishWrong();entry=api.getState().progress.at(-1);assert.equal(entry.entered,2);assert.equal(entry.correct,1);assert.equal(entry.elapsedTicks,originalElapsedTicks(67000,68000));assert.equal(values()[0],'2 타');press(document.activeElement,'Escape');
 }finally{if(descriptor)Object.defineProperty(performance,'now',descriptor);else delete performance.now;api.navigate('home');}
});
test('focused long-result close accepts Enter/Space as exit and stale background input is harmless',()=>{
 for(const key of ['Enter',' ']){beginLong(Array(6).fill('a'));for(let i=0;i<5;i++)finishRow();const background=$('.long-dialog'),stale=[...background.querySelectorAll('textarea')].at(-1);
  assert.equal(background.inert,true);assert.doesNotThrow(()=>press(stale,'x','KeyX'));assert.ok($('.long-result-dialog'));
  const close=$('.long-result-dialog button');close.focus();assert.ok(api.currentInputOwner()===close);press(close,key);assert.ok($('.long-select'));assert.equal(api.getLongState().longIndex,5);
 }api.navigate('home');
});
test('exam deadline result preserves current short-page heading and records only one result',()=>{
 api.navigate('home');const container=document.createElement('div');document.body.append(container);const records=[];
 const descriptor=Object.getOwnPropertyDescriptor(performance,'now'),nativeInterval=globalThis.setInterval;let now=1000,tick;Object.defineProperty(performance,'now',{configurable:true,value:()=>now});globalThis.setInterval=(fn,ms)=>{if(ms===100){tick=fn;return null;}return nativeInterval(fn,ms);};
 let cleanup;try{cleanup=renderExtras(container,'exam',{language:'en',settings:{layout:'us'},longTexts:[{id:'synthetic',language:'en',title:'Synthetic',text:Array(7).fill('a').join('\n')}],onRecord:r=>records.push(r)});
  press(container.querySelector('[role=listbox]'),'Enter');const input=container.querySelector('textarea');press(input,' ');for(let i=0;i<6;i++){press(input,'a','KeyA');press(input,'Enter');}
  now+=300000;assert.equal(typeof tick,'function');tick();const modal=container.querySelector('.extra-exam-result-modal');assert.ok(modal);assert.match(container.querySelector('.extra-window>h1').textContent,/p\.\s*2\)/);assert.equal(records.length,1);assert.equal(records[0].correct,6);assert.equal(records[0].elapsedMs,300000);tick();assert.equal(records.length,1);press(modal,'Enter');assert.ok(container.querySelector('[role=listbox]'));
 }finally{cleanup?.();container.remove();globalThis.setInterval=nativeInterval;if(descriptor)Object.defineProperty(performance,'now',descriptor);else delete performance.now;}
});
