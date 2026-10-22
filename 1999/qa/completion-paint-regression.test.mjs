/** Source-grounded completion tests, reconstructed after runtime recovery.
 * Reduced quotas and short targets isolate transitions; these are DOM state
 * tests, not natural-duration native/browser screenshots or pixel proof. */
import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
const {api,document} = resourceTestsEnabled ? await import('./dom-harness.mjs') : {};
const {requestedKey} = resourceTestsEnabled ? await import('../drill-rules.js') : {};
const $=selector=>document.querySelector(selector);
function press(input,key,code=key){
 const event=new document.defaultView.Event('keydown',{bubbles:true,cancelable:true});
 Object.assign(event,{key,code});input.selectionStart=input.value?.length||0;input.selectionEnd=input.selectionStart;input.dispatchEvent(event);return event;
}
function keyFixture({stage=0,repeat=false,position=0}={}){
 api.setLanguage('ko','2');api.setStage(stage);api.getState().appSettings.repeat=repeat;api.navigate('keys');
 if(position)api.startKeys(position);
 api.getState().keyDrill.rounds=1;
 return api.getState().keyDrill;
}
function correctKey(){api.keyPress(api.getKeyTarget(),requestedKey(api.getState().keyDrill));}
function reachLastPress(){
 let guard=0;
 while(++guard<10000){const state=api.getState().keyDrill;
  if(state.completedTargets===state.pool.physicalKeys.length-1&&(state.stage===0||state.phase==='home')&&state.phaseCorrect===(state.repeat?3:0))return state;
  correctKey();
 }
 throw new Error('Did not reach final accepted press');
}
function capFor(physical){return [...document.querySelectorAll('.key-dialog .physical-key')].find(cap=>cap.dataset.physical===physical);}
for(const fixture of [
 {name:'basic target',stage:0,expected:'stipple'},
 {name:'later home outside its stage pool',stage:1,expected:'normal'},
 {name:'later home inside its stage pool',stage:9,expected:'stipple'},
 {name:'fourth repeated basic target',stage:0,repeat:true,expected:'stipple'},
])test(`completion cleans ${fixture.name} before modal without drawing another target`,()=>{
 keyFixture(fixture);const last=reachLastPress(),physical=requestedKey(last),target=api.getKeyTarget();
 const randomState=api.getState().originalRandomState,cap=capFor(physical);
 assert.equal(cap.dataset.nativePaint,'active');assert.ok(document.querySelectorAll('.fingers .lit').length>0);
 if(fixture.repeat){api.keyPress('wrong','\0');assert.equal(api.getState().keyDrill.phaseCorrect,3);assert.equal($('.repeat-dialog'),null);}
 correctKey();
 assert.ok($('.repeat-dialog'));assert.equal(api.getKeyTarget(),target);assert.equal($('#key-target').textContent,target);
 assert.equal(api.getState().originalRandomState,randomState,'completion must not draw another random target');
 assert.equal(cap.dataset.nativePaint,fixture.expected);
 assert.equal(document.querySelectorAll('.key-dialog .active-key').length,0);
 assert.equal(document.querySelectorAll('.fingers .lit').length,0);
 assert.equal($('#key-score').hidden,true);
 if(fixture.stage)assert.equal(cap.classList.contains('native-home-ring'),fixture.expected==='stipple');
 api.navigate('home');
});
test('Next into a smaller key pool resets out-of-range increment to zero, not modulo',()=>{
 keyFixture({position:6});reachLastPress();correctKey();assert.equal(api.getState().keyDrill.position,5);
 press(document.activeElement,'ArrowRight');press(document.activeElement,'Enter');
 assert.equal(api.getState().selectedStage,1);assert.equal(api.getState().keyDrill.position,0);assert.equal(requestedKey(api.getState().keyDrill),'q');
 assert.equal($('#key-score').hidden,false);assert.equal(document.querySelectorAll('.fingers .lit').length,1);api.navigate('home');
});
for(const mode of ['words','sentences'])test(`${mode} modal preserves final metrics/errors but removes count and caret`,()=>{
 api.setLanguage('en','us');api.setStage(0);api.getState().appSettings.repeat=false;api.navigate(mode);
 if(mode==='words')press($('#key-input'),'Escape');
 const state=api.getState();state.textPractice.quota=1;state.session.target='ab';
 const input=$('#typing');press(input,'a','KeyA');press(input,'x','KeyX');
 assert.ok($('.practice-caret'));assert.equal($('#used-keys').textContent,'0타');
 press(input,'Enter');
 assert.ok($('.repeat-dialog'));assert.equal($('#target').textContent,'ab');
 assert.equal($('#used-keys').textContent,'2타');assert.equal($('#correct-keys').textContent,'1타');assert.equal($('#accuracy').textContent,'50%');
 assert.equal(document.querySelectorAll('.practice-error').length,1);assert.equal($('#practice-typed-render').textContent,'ax');
 assert.equal(Boolean($('.practice-caret')),false);assert.equal($('.sentence-dialog h1>span').hidden,true);
 const retainedBest=$('#best-bar').textContent;
 press(document.activeElement,'Enter');
 assert.equal($('.repeat-dialog'),null);assert.equal(api.getState().textPractice.completed,0);
 assert.equal($('#used-keys').textContent,'0타');assert.equal($('#best-bar').textContent,retainedBest);assert.ok($('.practice-caret'));
 assert.equal($('.sentence-dialog h1>span').hidden,false);api.navigate('home');
});
function beginWords(){api.setLanguage('en','us');api.setStage(0);api.getState().appSettings.repeat=false;api.navigate('words');press($('#key-input'),'Escape');}
function finishOneLetter(){api.getState().session.target='a';const input=$('#typing');press(input,'a','KeyA');press(input,'Enter');}
const keyProfile=()=>JSON.stringify(api.getState().originalKeyProfile);
const historyWeight=()=>api.getState().originalSpeedHistory.slots.reduce((total,slot)=>total+slot.weight,0);
test('39 word lines save speed history but abandoning round discards buffered glyph charts',()=>{
 beginWords();const profile=keyProfile(),history=historyWeight(),records=api.getState().progress.length;
 for(let i=0;i<39;i++)finishOneLetter();
 assert.equal(api.getState().textPractice.completed,39);assert.equal(api.getState().progress.length,records+39);
 assert.equal(historyWeight(),history+39);assert.equal(keyProfile(),profile);
 press($('#typing'),'Escape');assert.equal(api.getState().mode,'home');assert.equal(keyProfile(),profile);
 assert.equal($('.dropdown-menu .chosen').dataset.action,'words:0');
});
test('word quota writes charts before modal, Continue does not duplicate and uses a clean buffer',()=>{
 beginWords();const before=api.getState().originalKeyProfile.current['en:64']?.correct||0;
 for(let i=0;i<40;i++)finishOneLetter();
 assert.ok($('.repeat-dialog'));assert.equal(api.getState().originalKeyProfile.current['en:64'].correct,before+40);
 const history=historyWeight(),records=api.getState().progress.length;
 press(document.activeElement,'Enter');assert.equal(api.getState().wordPhase,'study');assert.equal(api.getState().textPractice.keyRecords.length,0);
 assert.equal(api.getState().originalKeyProfile.current['en:64'].correct,before+40);assert.equal(historyWeight(),history);assert.equal(api.getState().progress.length,records);
 finishOneLetter();press($('#typing'),'Escape');assert.equal(api.getState().originalKeyProfile.current['en:64'].correct,before+40);
});
test('short saves completed-line charts immediately and discards the unfinished next line',()=>{
 api.setLanguage('en','us');api.navigate('sentences');const before=api.getState().originalKeyProfile.current['en:64']?.correct||0;
 finishOneLetter();assert.equal(api.getState().originalKeyProfile.current['en:64'].correct,before+1);
 const profile=keyProfile(),history=historyWeight();api.getState().session.target='ab';press($('#typing'),'a','KeyA');press($('#typing'),'Escape');
 assert.equal(keyProfile(),profile);assert.equal(historyWeight(),history);assert.equal($('.dropdown-menu .chosen').dataset.action,'sentences');
});
test('qualifying key completion advances only once after modal dismissal, even on Escape',()=>{
 window.localStorage.setItem('retro-typing-stage-2','1');window.localStorage.setItem('retro-typing-stage-date-2','');
 keyFixture();reachLastPress();correctKey();
 assert.equal(window.localStorage.getItem('retro-typing-stage-2'),'1');const profile=keyProfile(),history=historyWeight();
 press(document.activeElement,'ArrowRight');assert.equal(window.localStorage.getItem('retro-typing-stage-2'),'1');
 press(document.activeElement,'Escape');assert.equal(window.localStorage.getItem('retro-typing-stage-2'),'2');
 press(document.activeElement,'Escape');assert.equal(window.localStorage.getItem('retro-typing-stage-2'),'2');
 assert.equal(keyProfile(),profile);assert.equal(historyWeight(),history);
});
test('completion to statistics renders persisted results without modifying them and restores statistics menu',async()=>{
 api.setLanguage('en','us');api.navigate('sentences');finishOneLetter();press($('#typing'),'Escape');
 const profile=keyProfile(),history=JSON.stringify(api.getState().originalSpeedHistory);
 await api.handleMenuAction('stats-keys');assert.ok($('.extra-graph'));assert.equal(keyProfile(),profile);
 press(document.activeElement,'Escape');assert.equal(api.getState().mode,'home');assert.equal($('.dropdown-menu .chosen').dataset.action,'stats-keys');
 assert.equal(keyProfile(),profile);assert.equal(JSON.stringify(api.getState().originalSpeedHistory),history);
});
test('all35 short lines reach two-choice modal with final line included in aggregate and charts',()=>{
 api.setLanguage('en','us');api.navigate('sentences');assert.equal(api.getState().textPractice.quota,35);
 const previous=api.getState().originalKeyProfile.current['en:64']||{correct:0,wrong:0},before={correct:previous.correct,wrong:previous.wrong};
 for(let i=0;i<34;i++)finishOneLetter();
 assert.equal(Boolean($('.repeat-dialog')),false);assert.equal(api.getState().textPractice.completed,34);
 api.getState().session.target='a';press($('#typing'),'x','KeyX');press($('#typing'),'Enter');
 assert.ok($('.repeat-dialog'));assert.equal($('.repeat-answers').children.length,2);
 assert.equal($('#used-keys').textContent,'35타');assert.equal($('#correct-keys').textContent,'34타');assert.equal($('#accuracy').textContent,'97%');
 assert.equal(api.getState().originalKeyProfile.current['en:64'].correct,before.correct+34);assert.equal(api.getState().originalKeyProfile.current['en:64'].wrong,before.wrong+1);
 assert.equal(Boolean($('.practice-caret')),false);assert.equal($('.sentence-dialog h1>span').hidden,true);
 press(document.activeElement,'Escape');
});
test('zero-correct word completion stays deterministic0 rather than copying uninitialized native percentages',()=>{
 beginWords();
 for(let i=0;i<40;i++){api.getState().session.target='a';press($('#typing'),'x','KeyX');press($('#typing'),'Enter');}
 assert.ok($('.repeat-dialog'));assert.equal($('#used-keys').textContent,'40타');assert.equal($('#correct-keys').textContent,'0타');
 assert.equal($('#accuracy').textContent,'0%');assert.equal($('#speed').textContent,'0타/분');assert.equal($('#acc-bar').textContent,'0');
 assert.equal(api.getState().progress.at(-1).accuracy,0);assert.equal(api.getState().progress.at(-1).cpm,0);press(document.activeElement,'Escape');
});
