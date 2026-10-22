/** Reconstructed source-boundary DOM checks. Explicit accepted-key calls test
 * row/quota ordering, not DOS rendering speed, OS auto-repeat or native timing. */
import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
const {api,document} = resourceTestsEnabled ? await import('./dom-harness.mjs') : {};
const {ORIGINAL_RANDOM_MULTIPLIER} = resourceTestsEnabled ? await import('../original-random.js') : {};
const $=selector=>document.querySelector(selector);
const afterDraws=(state,n)=>{while(n--)state=(Math.imul(state,ORIGINAL_RANDOM_MULTIPLIER)+1)>>>0;return state;};
for(const repeat of [false,true])test(`warmup ${repeat?'four-press repeat':'single press'} consumes exactly five rows, then focuses empty40-line study`,()=>{
 api.setLanguage('ko','2');api.setStage(1);api.getState().appSettings.repeat=repeat;api.navigate('words');
 const input=$('#key-input'),profile=JSON.stringify(api.getState().originalKeyProfile),records=api.getState().progress.length;
 const history=JSON.stringify(api.getState().originalSpeedHistory);
 for(let row=0;row<5;row++){
  const initialState=api.getState().originalRandomState;
  assert.equal($('#key-score').textContent,`[횟수:${String(5-row).padStart(3,' ')}]`);
  for(let column=0;column<10;column++){
   const target=api.getKeyTarget();
   for(let press=0;press<(repeat?4:1);press++){
    if(repeat&&press===3){api.keyPress('wrong');assert.equal(api.getKeyTarget(),target);}
    api.keyPress(target);
    if(repeat&&press<3){assert.equal(api.getKeyTarget(),target);assert.equal(api.getState().wordPhase,'warmup');}
   }
  }
  if(row<4){assert.equal(api.getState().wordPhase,'warmup');assert.equal($('#key-input'),input);assert.equal(api.getState().originalRandomState,afterDraws(initialState,10),'each rollover selects exactly10 new targets');}
 }
 assert.equal(api.getState().wordPhase,'study');assert.equal(api.getState().textPractice.quota,40);
 assert.equal(api.getState().textPractice.completed,0);assert.equal($('#typing').value,'');assert.equal(document.activeElement,$('#typing'));
 assert.equal(input.isConnected,false);assert.equal(JSON.stringify(api.getState().originalKeyProfile),profile);assert.equal(api.getState().progress.length,records);assert.equal(JSON.stringify(api.getState().originalSpeedHistory),history);
 api.navigate('home');
});
