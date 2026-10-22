/** Source/native lifetime tests. Targets and elapsed times are explicit small
 * fixtures; original40/35-line quotas and normal input/Continue routes remain.
 * These tests are not native screenshots or measured human typing speeds. */
import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
const {api,document} = resourceTestsEnabled ? await import('./dom-harness.mjs') : {};
const $=s=>document.querySelector(s);
function key(input,value,code=value){const e=new document.defaultView.Event('keydown',{bubbles:true,cancelable:true});Object.assign(e,{key:value,code});input.selectionStart=input.value?.length||0;input.selectionEnd=input.selectionStart;input.dispatchEvent(e);}
function begin(mode,language='en',layout='us',stage=0){api.navigate('home');api.setLanguage(language,layout);api.setStage(stage);api.getState().appSettings.repeat=false;api.navigate(mode);if(mode==='words')key($('#key-input'),'Escape');}
function line(length=4,elapsed=1000){const s=api.getState().session;s.target='a'.repeat(length);const input=$('#typing');for(let n=0;n<length;n++)key(input,'a','KeyA');api.getState().session.startedAt=performance.now()-elapsed;key(input,'Enter');}
function finishRound(){while(!$('.repeat-dialog'))line();}
const best=()=>Number($('#best-bar').textContent);
let wordBest,shortBest;
test('a fresh application begins with independent zero word/short maxima',()=>{begin('words');assert.equal(best(),0);begin('sentences');assert.equal(best(),0);});
test('unfinished input does not create an application maximum',()=>{begin('words');api.getState().session.target='aaaa';key($('#typing'),'a','KeyA');key($('#typing'),'Escape');begin('words');assert.equal(best(),0);});
test('word Continue retains its computed maximum while clearing all round metrics',()=>{begin('words');line(12,1000);wordBest=best();assert.ok(wordBest>600);finishRound();assert.equal(api.getState().textPractice.completed,40);assert.equal(best(),wordBest);key(document.activeElement,'Enter');assert.equal(api.getState().textPractice.quota,40);assert.equal(api.getState().textPractice.completed,0);assert.equal(best(),wordBest);assert.equal($('#now-bar').textContent,'0');assert.equal($('#acc-bar').textContent,'0');assert.equal($('#used-keys').textContent,'0타');assert.equal($('#correct-keys').textContent,'0타');assert.equal($('#practice-time').textContent,'0.0초');assert.equal($('#speed').textContent,'0타/분');assert.equal($('#accuracy').textContent,'0%');assert.equal($('.key-dialog'),null);assert.equal(document.activeElement,$('#typing'));});
test('word Next goes through warmup but retains its application maximum',()=>{finishRound();assert.equal(document.querySelectorAll('.repeat-dialog [data-choice]').length,3);key(document.activeElement,'ArrowRight');key(document.activeElement,'Enter');assert.ok($('.key-dialog'));assert.equal(api.getState().selectedStage,1);key($('#key-input'),'Escape');assert.equal(best(),wordBest);assert.equal(api.getState().textPractice.completed,0);});
test('short maximum is separate and survives its own35-line Continue',()=>{begin('sentences');assert.equal(best(),0);line(24,1000);shortBest=best();assert.ok(shortBest>wordBest);finishRound();assert.equal(api.getState().textPractice.completed,35);key(document.activeElement,'Enter');assert.equal(best(),shortBest);assert.equal(api.getState().textPractice.completed,0);assert.equal($('#now-bar').textContent,'0');assert.equal($('#used-keys').textContent,'0타');});
test('reentry, stage and language changes retain the matching maximum only',()=>{begin('words','ko','2',1);assert.equal(best(),wordBest);begin('sentences','ja','hiragana');assert.equal(best(),shortBest);begin('words','en','dvorak');assert.equal(best(),wordBest);begin('sentences');assert.equal(best(),shortBest);});
test('a slower completed line cannot reduce a retained maximum',()=>{line(1,10000);assert.equal(best(),shortBest);begin('words');line(1,10000);assert.equal(best(),wordBest);api.navigate('home');});
