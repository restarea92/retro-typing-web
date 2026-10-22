import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
const {api,document,window} = resourceTestsEnabled ? await import('./dom-harness.mjs') : {};
const press=(node,key)=>{const event=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(event,{key,code:key===' '?'Space':/^[a-z]$/.test(key)?'Key'+key.toUpperCase():key});node.dispatchEvent(event);return event;};
const finishKeys=()=>{api.setLanguage('ko','2');api.setStage(0);api.navigate('keys');for(let i=0;i<800;i++)api.keyPress(api.getKeyTarget());return document.querySelector('.repeat-dialog .dialog-close');};
for(const key of ['Enter',' '])test(`focused startup close ${JSON.stringify(key)} cancels, never accepts Yes`,()=>{
 api.showStageDialog();const close=document.querySelector('.stage-dialog .dialog-close');close.focus();press(close,key);assert.equal(api.getState().mode,'home');assert.ok(document.querySelector('.dropdown-menu'));assert.equal(document.querySelector('#key-input'),null);
});
for(const key of ['Enter',' '])test(`focused repeat close ${JSON.stringify(key)} stops instead of Continue`,()=>{
 const close=finishKeys();assert.ok(close);close.focus();press(close,key);assert.equal(api.getState().mode,'home');assert.equal(document.querySelector('#key-input'),null);
});
for(const key of ['Enter',' '])test(`focused short-repeat close ${JSON.stringify(key)} stops instead of Continue`,()=>{
 api.setLanguage('en','us');api.navigate('sentences');for(let i=0;i<35;i++){api.getState().session.target='a';const input=document.querySelector('#typing');press(input,'a');press(input,'Enter');}
 const close=document.querySelector('.repeat-dialog .dialog-close');assert.ok(close);close.focus();press(close,key);assert.equal(api.getState().mode,'home');assert.equal(document.querySelector('#typing'),null);
});
test('virtual Enter targets focused startup close rather than the selected Yes answer',()=>{
 api.showStageDialog();const close=document.querySelector('.stage-dialog .dialog-close');close.focus();assert.ok(api.currentInputOwner()===close,'focused close owns semantic input');const bridge=api.getKeyboardBridge();bridge.keyDown({code:'Enter'});bridge.keyUp({code:'Enter'});assert.equal(api.getState().mode,'home');
});
test('virtual Space targets focused repeat close and its later keyup cannot activate a new owner',()=>{
 const close=finishKeys();assert.ok(close);close.focus();assert.ok(api.currentInputOwner()===close,'focused close owns semantic input');const bridge=api.getKeyboardBridge();bridge.keyDown({code:'Space'});assert.equal(api.getState().mode,'home');bridge.keyUp({code:'Space'});assert.equal(api.getState().mode,'home');assert.deepEqual(bridge.pressedCodes,[]);
});
test('physical main close Enter remains owned by its button default, not the Home menu shortcut',()=>{
 api.navigate('home');const close=document.querySelector('#close');close.focus();const event=press(close,'Enter');assert.equal(event.defaultPrevented,false);assert.ok(api.currentInputOwner()===close,'focused close owns semantic input');assert.equal(api.getState().mode,'home');
});
test('virtual main close Enter performs one ordinary exit, not Home navigation',()=>{
 api.navigate('home');document.querySelector('#close').focus();const bridge=api.getKeyboardBridge();bridge.keyDown({code:'Enter'});bridge.keyUp({code:'Enter'});assert.equal(api.getState().mode,'exited');
});

test('virtual main close Space waits for its matched release and cannot restart after exit',()=>{
 api.navigate('home');document.querySelector('#close').focus();const bridge=api.getKeyboardBridge();bridge.keyDown({code:'Space'});assert.equal(api.getState().mode,'home');bridge.keyUp({code:'Space'});assert.equal(api.getState().mode,'exited');assert.equal(bridge.keyUp({code:'Space'}),false);assert.equal(api.getState().mode,'exited');
});
