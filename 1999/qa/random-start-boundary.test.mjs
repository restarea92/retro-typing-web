/** Simulated DOM/clock fixtures; actual DOS behavior is independently traced at
 *16ec4 (wait),16efc (Esc),16f17 (InitTypingData),14afc (srand). */
import test,{resourceTestsEnabled}from'./resource-test.mjs';import assert from'node:assert/strict';
import{createOriginalRandom,browserTimeSeed}from'../original-random.js';
const{api,document}=resourceTestsEnabled?await import('./dom-harness.mjs'):{};
function press(key,code=key){const e=new document.defaultView.Event('keydown',{bubbles:true,cancelable:true});Object.assign(e,{key,code});document.querySelector('#game-input').dispatchEvent(e);}
for(const kind of['rain','invaders']){
 test(`${kind} intro/cancel consumes no RNG; start uses acceptance-time seed exactly once`,()=>{
  api.navigate('home');api.setLanguage('en','us');const before=api.getState().originalRandomState;
  const setup=()=>kind==='rain'?api.setupRain():api.setupInvaders();setup();assert.equal(api.getState().gamePhase,'intro');assert.equal(api.getGameState(),null);assert.equal(api.getState().originalRandomState,before);
  press('Escape');assert.equal(api.getState().gamePhase,'select');assert.equal(api.getState().originalRandomState,before);
  const RealDate=Date;let now=new RealDate(2026,0,1,12,0,0).getTime();
  globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
  try{setup();now+=11000;assert.equal(api.getState().originalRandomState,before);const expected=createOriginalRandom(browserTimeSeed(new Date()));for(let i=0;i<70;i++)expected.nextInt();press(' ','Space');assert.equal(api.getState().gamePhase,'running');assert.equal(api.getState().originalRandomState,expected.state);const started=api.getState().originalRandomState;now+=10000;api.beginGame();assert.equal(api.getState().originalRandomState,started);
  }finally{globalThis.Date=RealDate;api.navigate('home');}
 });
}
