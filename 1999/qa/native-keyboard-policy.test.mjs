/** Native/hardware presentation policy; simulated DOM, not an iPhone test. */
import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {api,document,window} = resourceTestsEnabled ? await import('./dom-harness.mjs') : {};
const q=s=>document.querySelector(s);
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const key=(target,value,code=value)=>{const e=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(e,{key:value,code});target.dispatchEvent(e);return e;};

test('HTML hides and inerts the retired panel before module initialization',()=>{
 assert.match(html,/<section id="virtual-keyboard-panel"[^>]* hidden[^>]* inert[^>]*aria-hidden="true"/);
 assert.equal(q('#virtual-keyboard-panel').hidden,true);assert.equal(q('#virtual-keyboard-panel').hasAttribute('inert'),true);
 assert.equal(q('#keyboard-input-mode').disabled,true);assert.equal(q('#focus-input').textContent,'기기 키보드 열기');
 assert.equal(q('#focus-input').hasAttribute('aria-controls'),false);
});
test('paused renderer is neither imported nor initialized and has no rendered keys or canvas',()=>{
 assert.doesNotMatch(source,/import[^\n]*virtual-keyboard-view/);assert.doesNotMatch(source,/\bcreateVirtualKeyboard\s*\(/);
 assert.doesNotMatch(html,/<link[^>]*href="virtual-keyboard\.css"/);
 assert.equal(api.getKeyboardView(),null);assert.equal(q('.vk-key'),null);assert.equal(q('canvas'),null);
 for(const file of ['virtual-keyboard-view.js','virtual-keyboard-layout.js','virtual-keyboard.css'])assert.equal(fs.existsSync(new URL('../'+file,import.meta.url)),true,'reversible source retained: '+file);
});
test('native focus request preserves a nonzero main selection and helper ownership',()=>{
 api.navigate('home');api.openMenu('textmenu',2);const menu=q('.dropdown-menu'),helper=q('#focus-input');helper.focus();helper.click();
 assert.equal(api.getState().mode,'home');assert.equal(q('.dropdown-menu'),menu);assert.equal(menu.querySelector('.chosen').dataset.action,'notepad');
 assert.equal(document.activeElement,helper);key(helper,'ArrowDown');assert.equal(menu.querySelector('.chosen').dataset.action,'notepad');assert.equal(q('#typing'),null);
});
test('native focus request cannot choose a startup answer or create an editor',()=>{
 api.showStageDialog();q('#stage-no').click();const dialog=q('.stage-dialog'),helper=q('#focus-input');helper.focus();helper.click();
 assert.equal(q('.stage-dialog'),dialog);assert.equal(dialog.dataset.selectedChoice,'1');assert.equal(document.activeElement,helper);assert.equal(q('#key-input'),null);
});
test('key drill exposes a genuine editable native target without suppression or readonly',()=>{
 api.setLanguage('ko','2');api.navigate('keys');const input=q('#key-input');assert.equal(input.getAttribute('inputmode'),null);assert.equal(input.hasAttribute('readonly'),false);
 q('#focus-input').focus();q('#focus-input').click();assert.equal(document.activeElement,input);assert.equal(api.getState().keyCount,0);
 key(input,'a','KeyA');assert.equal(api.getState().keyDrill.correct,1);
});
test('all legacy presentation requests keep native keyboard eligibility while preserving text and selection',()=>{
 api.navigate('sentences');const input=q('#typing');key(input,'r','KeyR');key(input,'k','KeyK');const value=input.value;
 input.setSelectionRange(0,value.length);for(const oldChoice of ['virtual','hardware','native']){
  api.setInputMethod(oldChoice);assert.equal(input.getAttribute('inputmode'),null);assert.equal(input.value,value);
  assert.equal(input.selectionStart,0);assert.equal(input.selectionEnd,value.length);assert.equal(api.getKeyboardView(),null);assert.equal(q('#virtual-keyboard-panel').hidden,true);
 }
});
test('native keyboard helper restores focus so immediately following hardware input is accepted once',()=>{
 api.navigate('sentences');const input=q('#typing');q('#focus-input').focus();q('#focus-input').click();
 assert.equal(document.activeElement,input);for(const [value,code]of [['r','KeyR'],['k','KeyK'],['s','KeyS']])key(document.activeElement,value,code);
 assert.equal(input.value,'간');assert.equal(q('#virtual-keyboard-panel').hidden,true);
});
test('application exit retains explicit Restart, not a hidden keyboard visibility action',()=>{
 api.navigate('home');api.endApplication();assert.equal(api.getState().mode,'exited');assert.equal(q('#focus-input').textContent,'다시 시작');
 let count=0;window.location={reload(){count++}};q('#focus-input').click();assert.equal(count,1);assert.equal(q('#virtual-keyboard-panel').hidden,true);
});
