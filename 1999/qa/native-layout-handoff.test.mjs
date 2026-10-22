/** Isolated application bindings, not browser or device-IME evidence. */
import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
const {api,document} = resourceTestsEnabled ? await import('./dom-harness.mjs') : {};
const {ORIGINAL_KEY_STAGE_POOLS} = resourceTestsEnabled ? await import('../original-key-stage-pools.js') : {};

for(const [layout,table] of [['3','korean3'],['3-no-shift','korean3NoShift']]) {
 test(`key practice supplies ${layout} to the code-less autoCaps adapter`,()=>{
  const pools=ORIGINAL_KEY_STAGE_POOLS[table];
  const stage=pools.findIndex(pool=>pool.physicalKeys.includes('o'));
  const position=pools[stage].physicalKeys.indexOf('o');
  api.setLanguage('ko',layout);api.setStage(stage);api.navigate('keys');api.startKeys(position);
  assert.equal(api.getKeyTarget(),'ㅊ');
  const input=document.querySelector('#key-input');
  const event=new document.defaultView.Event('keydown',{bubbles:true,cancelable:true});
  Object.assign(event,{key:'O',code:'',shiftKey:false});input.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);
  assert.equal(api.getState().keyDrill.correct,1);
  assert.equal(api.getState().keyDrill.incorrect,0);
  api.navigate('home');
 });
}
