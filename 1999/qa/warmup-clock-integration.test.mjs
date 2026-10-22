/** Controlled Date.now fixtures exercise the source clock read; they do not
 * claim that a real DOS run or browser was captured at these clock values. */
import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
const {api,document} = resourceTestsEnabled ? await import('./dom-harness.mjs') : {};
const {originalKeyGuide} = resourceTestsEnabled ? await import('../original-key-guide.js') : {};
const {ORIGINAL_RANDOM_MULTIPLIER} = resourceTestsEnabled ? await import('../original-random.js') : {};
const $=s=>document.querySelector(s),afterDraws=(s,n)=>{while(n--)s=(Math.imul(s,ORIGINAL_RANDOM_MULTIPLIER)+1)>>>0;return s;};
function clock(seconds){return new Date(2026,9,22,12,Math.floor(seconds/60),seconds%60).getTime();}
function fresh(repeat=false){api.setLanguage('ko','2');api.setStage(0);api.getState().appSettings.repeat=repeat;api.navigate('words');}
test('real warmup binding samples the final input clock and preserves10-draw row order',()=>{
 const now=Date.now;try{Date.now=()=>clock(256);fresh();for(let i=0;i<9;i++)api.keyPress(api.getKeyTarget());
 const rng=api.getState().originalRandomState;assert.ok(!$('[data-physical="g"]').classList.contains('active-key'));
 Date.now=()=>clock(404);api.keyPress(api.getKeyTarget());
 assert.equal($('#key-score').textContent,'[횟수:  4]');assert.equal(api.getState().originalRandomState,afterDraws(rng,10));
 assert.equal($('[data-physical="g"]').textContent.codePointAt(0),0xf2094);assert.ok($('[data-physical="g"]').classList.contains('active-key'));
 const expected=new Set([3,...originalKeyGuide('2',api.getKeyTarget()).fingers]);
 assert.deepEqual([...document.querySelectorAll('.fingers i.lit')].map(x=>Number(x.dataset.finger)).sort(),[...expected].sort());
 }finally{Date.now=now;api.navigate('home');}
});
test('repeat partial presses and wrong keys never trigger clock cue before the tenth completed target',()=>{
 const now=Date.now;try{Date.now=()=>clock(256);fresh(true);for(let i=0;i<36;i++)api.keyPress(api.getKeyTarget());
 Date.now=()=>clock(426);for(let i=0;i<3;i++)api.keyPress(api.getKeyTarget());api.keyPress('wrong');
 assert.ok(!$('[data-physical="p"]').classList.contains('active-key'));assert.equal($('#key-score').textContent,'[횟수:  5]');
 api.keyPress(api.getKeyTarget());assert.equal($('[data-physical="p"]').textContent.codePointAt(0),0xf20aa);assert.equal($('#key-score').textContent,'[횟수:  4]');
 }finally{Date.now=now;api.navigate('home');}
});
test('clock ghost appears only when painted, with no hand-connector duplication',()=>{
 const now=Date.now;try{Date.now=()=>clock(96);fresh();assert.equal($('.clock-ghost-fingers'),null);
 for(let i=0;i<10;i++)api.keyPress(api.getKeyTarget());assert.ok($('.clock-ghost-fingers i.lit'));
 assert.equal(document.querySelectorAll('.clock-ghost-fingers').length,1);assert.equal($('.clock-ghost-fingers').getAttribute('aria-hidden'),'true');
 }finally{Date.now=now;api.navigate('home');}
});
test('all50 targets keep counters, empty charts and study entry; final cue leaves no residue',()=>{
 const now=Date.now;try{Date.now=()=>clock(426);fresh();const profile=JSON.stringify(api.getState().originalKeyProfile),history=JSON.stringify(api.getState().originalSpeedHistory),progress=api.getState().progress.length;
 for(let i=0;i<49;i++)api.keyPress(api.getKeyTarget());Date.now=()=>clock(96);api.keyPress(api.getKeyTarget());
 assert.equal(api.getState().wordPhase,'study');assert.equal(api.getState().textPractice.quota,40);assert.equal(api.getState().session.typed,'');
 assert.equal($('.key-dialog'),null);assert.equal($('.clock-ghost-fingers'),null);assert.equal(document.activeElement,$('#typing'));
 assert.equal(JSON.stringify(api.getState().originalKeyProfile),profile);assert.equal(JSON.stringify(api.getState().originalSpeedHistory),history);assert.equal(api.getState().progress.length,progress);
 }finally{Date.now=now;api.navigate('home');}
});
