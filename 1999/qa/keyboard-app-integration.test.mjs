import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
const {api,document,window} = resourceTestsEnabled ? await import('./dom-harness.mjs') : {};
const press=(code,fields={})=>{const bridge=api.getKeyboardBridge();bridge.keyDown({code,...fields});bridge.keyUp({code});};
const click=id=>document.querySelector(id).click();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function textPractice(layout='2',language='ko'){api.setLanguage(language,layout);api.navigate('sentences');}

test('paused visual keyboard stays outside the frame and hidden; native helper never starts practice',()=>{
 api.navigate('home');const before=api.getState().mode;
 assert.ok(document.querySelector('#virtual-keyboard'));assert.equal(document.querySelector('.classic').contains(document.querySelector('#virtual-keyboard')),false);
 click('#focus-input');assert.equal(api.getState().mode,before);assert.equal(api.getKeyboardView(),null);assert.equal(document.querySelector('#virtual-keyboard-panel').hidden,true);
 click('#focus-input');assert.equal(api.getState().mode,before);assert.equal(api.getKeyboardView(),null);assert.equal(document.querySelector('#virtual-keyboard-panel').hidden,true);
});
test('native keyboard focus request on a menu does not navigate or create an editor',()=>{
 api.navigate('home');click('#focus-input');assert.equal(api.getState().mode,'home');assert.equal(document.querySelector('#key-input'),null);
 api.setInputMethod('virtual');
});
test('bridge Korean key drill consumes each complete down/up once while preserving a live editable IME target',()=>{
 api.setLanguage('ko','2');api.setStage(0);api.navigate('keys');assert.equal(document.activeElement.id,'key-input');assert.equal(document.activeElement.getAttribute('inputmode'),null);assert.equal(document.activeElement.hasAttribute('readonly'),false);
 press('KeyA');assert.equal(api.getState().keyCount,1);assert.equal(api.getState().keyDrill.correct,1);
 press('Semicolon');assert.equal(api.getState().keyCount,2);assert.equal(api.getState().keyDrill.correct,2);
 press('Escape');assert.equal(api.getState().mode,'home');
});
test('bridge physical codes compose Korean through existing app binding',()=>{
 textPractice();for(const code of ['KeyR','KeyK','KeyS','KeyK','KeyE','KeyK'])press(code);
 assert.equal(document.querySelector('#typing').value,'가나다');
});
test('KeyO auto-capitalized key text is not Shift; real Shift remains distinct',()=>{
 textPractice();press('KeyO',{key:'O'});assert.equal(document.querySelector('#typing').value,'ㅐ');
 textPractice();press('KeyO',{shiftKey:true});assert.equal(document.querySelector('#typing').value,'ㅒ');
});
test('bridge shifted punctuation and numbers preserve their physical identities',async()=>{
 api.setLanguage('en','us');await api.handleMenuAction('notepad');
 for(const n of '1234567890')press('Digit'+n);
 const codes=['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal','BracketLeft','BracketRight','Backslash','Semicolon','Quote','Comma','Period','Slash'];
 for(const code of codes)press(code,{shiftKey:true});
 assert.equal(document.querySelector('.extra-note-input').value,'1234567890!@#$%^&*()_+{}|:\"<>?');
});
test('wrapper-owned Enter does not leak into menu dispatch',()=>{
 api.navigate('home');const helper=document.querySelector('#help-toggle');helper.focus();
 const e=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(e,{key:'Enter',code:'Enter'});helper.dispatchEvent(e);
 assert.equal(e.defaultPrevented,false);assert.equal(api.getState().mode,'home');
});
test('startup selected answer is semantic, and one virtual Enter cannot act twice',()=>{
 api.showStageDialog();click('#stage-no');assert.equal(api.getState().mode,'stage');assert.equal(api.currentInputOwner().id,'stage-no');
 press('Enter');assert.equal(api.getState().mode,'home');assert.ok(document.querySelector('.dropdown-menu'));
});
test('settings numeric editor retains its native numeric input hint and shared transport',async()=>{
 api.setInputMethod('virtual');await api.handleMenuAction('settings');
 for(let i=0;i<4;i++)press('ArrowDown');assert.equal(api.currentInputOwner().id,'setting-speed');assert.equal(document.activeElement.id,'setting-speed');assert.equal(document.activeElement.getAttribute('inputmode'),'numeric');
 press('Digit2');press('Digit4');press('Digit0');assert.equal(document.querySelector('#setting-speed').value,'240');
 press('Enter');press('Escape');assert.equal(api.getState().appSettings.targetSpeed,240);assert.equal(api.getState().mode,'home');
});
test('notepad and exam editable focus hooks preserve shared transport',async()=>{
 api.setLanguage('ko','2');await api.handleMenuAction('notepad');assert.equal(document.activeElement.className,'extra-note-input');assert.equal(document.activeElement.getAttribute('inputmode'),null);
 for(const code of ['KeyR','KeyK'])press(code);assert.equal(document.querySelector('.extra-note-input').value,'가');
 press('Escape');assert.ok(document.querySelector('.extra-notepad-result'));press('Escape');assert.equal(api.getState().mode,'home');
 await api.handleMenuAction('exam');press('Enter');assert.equal(document.activeElement.className,'extra-exam-typed');assert.ok(document.querySelector('.extra-exam-typed'));
 press('Space');press('KeyR');press('KeyK');assert.equal(document.querySelector('.extra-exam-typed').value,'가');press('Escape');press('Escape');
});

function nativeEvent(input,type,fields={}){const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,fields);input.dispatchEvent(event);return event;}
function nativePreview(input,text){input.value=text;input.setSelectionRange(text.length,text.length);return nativeEvent(input,'input',{data:text,inputType:'insertCompositionText',isComposing:true});}
test('native jamo preview in key practice scores once and is not blocked after physical input',()=>{
 api.setLanguage('ko','2');api.setStage(0);api.navigate('keys');const input=document.querySelector('#key-input');
 nativeEvent(input,'compositionstart');nativePreview(input,'ㅁ');assert.equal(api.getState().keyCount,1);assert.equal(api.getState().keyDrill.correct,1);assert.equal(input.value,'ㅁ');
 nativeEvent(input,'compositionend',{data:'ㅁ'});nativeEvent(input,'input',{data:'ㅁ',inputType:'insertText',isComposing:false});assert.equal(api.getState().keyCount,1);
 press('Semicolon');assert.equal(api.getState().keyCount,2);
});
test('native Korean short preedit remains intact and does not create premature error records',()=>{
 textPractice();api.getState().session.target='삶';const input=document.querySelector('#typing');nativeEvent(input,'compositionstart');
 for(const text of ['ㅅ','사','살','삶']){nativePreview(input,text);assert.equal(input.value,text);assert.equal(document.querySelectorAll('.practice-error').length,0);}
 nativeEvent(input,'compositionend',{data:'삶'});nativeEvent(input,'input',{data:'삶',inputType:'insertText'});assert.equal(input.value,'삶');assert.equal(api.getState().textPractice.completed,0);
});
test('native punctuation data preserves colon despite a shiftless Semicolon key code',()=>{
 textPractice();const input=document.querySelector('#typing');const e=nativeEvent(input,'keydown',{key:':',code:'Semicolon',shiftKey:false});assert.equal(e.defaultPrevented,false);
 input.value=':';input.setSelectionRange(1,1);nativeEvent(input,'input',{data:':',inputType:'insertText'});assert.equal(input.value,':');assert.equal(api.getState().session.typed,':');
});
test('virtual Enter finalizes pending native target before running existing completion handler once',()=>{
 textPractice();api.getState().session.target='가';const input=document.querySelector('#typing');nativeEvent(input,'compositionstart');nativePreview(input,'가');
 press('Enter');assert.equal(api.getState().textPractice.completed,1);assert.equal(document.querySelector('#typing').value,'');
 nativeEvent(input,'compositionend',{data:'가'});assert.equal(api.getState().textPractice.completed,1);
});
test('native pending syllable followed by virtual Backspace and old IME tails cannot reappear',()=>{
 textPractice();const input=document.querySelector('#typing');nativeEvent(input,'compositionstart');nativePreview(input,'가');press('Backspace');assert.equal(input.value,'');
 input.value='가';nativeEvent(input,'compositionend',{data:'가'});input.value='가';nativeEvent(input,'input',{data:'가',inputType:'insertText'});assert.equal(input.value,'');press('KeyS');assert.equal(input.value,'ㄴ');
});
test('screen transition immediately cancels held input without activating its new owner',()=>{
 api.showStageDialog();const bridge=api.getKeyboardBridge();bridge.keyDown({code:'ShiftLeft'});assert.ok(bridge.pressedCodes.includes('ShiftLeft'));api.navigate('home');assert.deepEqual(bridge.pressedCodes,[]);assert.equal(api.getKeyboardView(),null);bridge.keyUp({code:'ShiftLeft'});assert.equal(api.getState().mode,'home');
});
test('native Return beforeinput completes a full short line exactly once without inserting newline',()=>{
 textPractice();api.getState().session.target='가';const input=document.querySelector('#typing');nativeEvent(input,'compositionstart');nativePreview(input,'가');nativeEvent(input,'compositionend',{data:'가'});
 const before=nativeEvent(input,'beforeinput',{inputType:'insertLineBreak',data:null,isComposing:false});assert.equal(before.defaultPrevented,true);assert.equal(api.getState().textPractice.completed,1);assert.equal(document.querySelector('#typing').value,'');
 nativeEvent(input,'input',{inputType:'insertLineBreak',data:null,isComposing:false});assert.equal(api.getState().textPractice.completed,1);
});
test('native Return during preedit confirms composition without advancing the line',()=>{
 textPractice();api.getState().session.target='가';const input=document.querySelector('#typing');nativeEvent(input,'compositionstart');nativePreview(input,'가');
 const before=nativeEvent(input,'beforeinput',{inputType:'insertParagraph',data:null,isComposing:true});assert.equal(before.defaultPrevented,true);assert.equal(api.getState().textPractice.completed,0);assert.equal(input.value,'가');
 nativeEvent(input,'compositionend',{data:'가'});assert.equal(api.getState().textPractice.completed,0);
});
test('native focus request releases held control transport without losing native text',()=>{
 textPractice();const input=document.querySelector('#typing');nativeEvent(input,'compositionstart');nativePreview(input,'가');
 const bridge=api.getKeyboardBridge();bridge.keyDown({code:'ShiftLeft'});assert.deepEqual(bridge.pressedCodes,['ShiftLeft']);
 api.setInputMethod('native');assert.deepEqual(bridge.pressedCodes,[]);assert.equal(api.getKeyboardView(),null);assert.equal(input.value,'가');assert.equal(api.getState().mode,'sentences');api.setInputMethod('virtual');
});
test('notepad result transition immediately clears held virtual modifiers',async()=>{
 await api.handleMenuAction('notepad');const bridge=api.getKeyboardBridge();bridge.keyDown({code:'ShiftLeft'});assert.ok(bridge.pressedCodes.includes('ShiftLeft'));press('Escape');
 assert.ok(document.querySelector('.extra-notepad-result'));assert.deepEqual(bridge.pressedCodes,[]);assert.equal(api.getKeyboardView(),null);press('Escape');
});

test('native keyboard request explicitly restores editor focus for immediate hardware composition',()=>{
 textPractice();api.setInputMethod('virtual');const input=document.querySelector('#typing'),helper=document.querySelector('#focus-input');helper.focus();helper.click();helper.click();
 assert.ok(document.activeElement===input,'native focus request intentionally restores the editable owner');assert.equal(input.value,'');assert.equal(api.getState().mode,'sentences');
 press('KeyO');assert.equal(input.value,'ㅐ');assert.ok(document.activeElement===input,'actual virtual typing restores editable focus');assert.equal(input.getAttribute('inputmode'),null);
 nativeEvent(document.activeElement,'keydown',{key:'r',code:'KeyR'});assert.equal(input.value,String.fromCodePoint(0xf0000+0x8482)); // Original vowel-first ㅐ + final ㄱ, with no initial.
});
test('explicit virtual menu navigation resumes menu focus after a helper, without opening a lesson',()=>{
 api.navigate('home');api.openMenu('help',0);const helper=document.querySelector('#focus-input');helper.focus();
 press('ArrowDown');const menu=document.querySelector('.dropdown-menu');assert.ok(document.activeElement===menu,'virtual menu action restores its own focus');assert.equal(api.getState().mode,'home');assert.equal(menu.querySelector('.chosen').dataset.action,'about');
 nativeEvent(document.activeElement,'keydown',{key:'ArrowUp',code:'ArrowUp'});assert.equal(menu.querySelector('.chosen').dataset.action,'help');
});
test('virtual resume after helper focus finalizes native preedit once and preserves late-tail ownership',()=>{
 textPractice();const input=document.querySelector('#typing');nativeEvent(input,'compositionstart');nativePreview(input,'가');document.querySelector('#focus-input').focus();
 press('KeyR');assert.ok(document.activeElement===input);assert.equal(input.value,'가ㄱ');
 input.value='가';nativeEvent(input,'compositionend',{data:'가'});input.value='가';nativeEvent(input,'input',{data:'가',inputType:'insertText'});assert.equal(input.value,'가ㄱ');
});
