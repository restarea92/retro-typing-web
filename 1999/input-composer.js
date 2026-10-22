/** Physical keyboard mapping is extracted from HTTD. Korean Unicode assembly
 * and DOM integration are a web implementation, not an OS IME dependency.
 * Native golden captures cover standard and partial Korean glyphs and Japanese prefixes.
 */
import { ORIGINAL_COMPOUNDS } from './original-compounds.js';
import { ORIGINAL_KEYBOARD_MAPS } from './original-keyboard-maps.js';
const INITIALS=Array.from('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ');
const VOWELS=Array.from('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ');
const FINALS=['',...Array.from('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ')];
const pairs=name=>Object.fromEntries(ORIGINAL_COMPOUNDS[name].triples.map(t=>[t.text[0]+t.text[1],t.text[2]]));
const VPAIRS=pairs('vowel'),TPAIRS=pairs('final2'),TPAIRS3=pairs('final3'),IPAIRS=pairs('initial');
const SPLIT=Object.fromEntries(Object.entries(TPAIRS).map(([a,b])=>[b,Array.from(a)]));
const ORIGINAL_LEADS=[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
const ORIGINAL_VOWELS=[3,4,5,6,7,10,11,12,13,14,15,18,19,20,21,22,23,26,27,28,29];
const ORIGINAL_FINALS=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,19,20,21,22,23,24,25,26,27,28,29];
const BINDINGS=new WeakMap();
const ALIASES={'2':'korean2',ko2:'korean2','3':'korean3',ko3:'korean3','3-no-shift':'korean3NoShift'};
const SHIFT={'1':'!','2':'@','3':'#','4':'$','5':'%','6':'^','7':'&','8':'*','9':'(','0':')','-':'_','=':'+','[':'{',']':'}','\\':'|',';':':',"'":'"',',':'<','.':'>','/':'?','`':'~'};
const CODES={Space:' ',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backquote:'`'};
export const COMPOSER_FIDELITY={maps:'Original extracted HTTD tables',hangul:'Original role-state transitions, Unicode syllables and exact raw partial-glyph aliases; native golden cases verified',japanese:'Original direct kana, prefix voicing and invalid-prefix glyph behavior; native hiragana and katakana golden cases verified'};
export function createComposer(layout='2',initialText=''){return {layout:ALIASES[layout]||layout,committed:String(initialText),pending:null,history:[],kanaPrefix:null,latinMode:false,latinLayout:'us'};}
export function resetComposer(stateOrLayout='2',initialText=''){const state=createComposer(typeof stateOrLayout==='string'?stateOrLayout:stateOrLayout.layout,initialText);if(typeof stateOrLayout!=='string'){state.latinMode=Boolean(stateOrLayout.latinMode);state.latinLayout=stateOrLayout.latinLayout||'us';}return state;}
/** Original Johab glyph identifier, including valid missing-component syllables.
 * These are not replaced with a different visible compatibility jamo. The font
 * includes private-use aliases U+F0000+rawCode for non-Unicode compositions. */
export function composerGlyphCode(p){
 if(!p)return null;
 return 0x8000|((p.l?ORIGINAL_LEADS[INITIALS.indexOf(p.l)]:1)<<10)|((p.v?ORIGINAL_VOWELS[VOWELS.indexOf(p.v)]:2)<<5)|ORIGINAL_FINALS[FINALS.indexOf(p.t||'')];
}
export const originalGlyphAlias=code=>String.fromCodePoint(0xf0000+code);
export function renderMappedKey(layout,ascii){const mapped=ORIGINAL_KEYBOARD_MAPS[ALIASES[layout]||layout]?.mapping[ascii];return mapped?.role==='final'?originalGlyphAlias(mapped.originalGlyphCode):mapped?.display??ascii;}
function render(p){
 if(!p)return '';
 if(p.l&&p.v)return String.fromCodePoint(0xac00+(INITIALS.indexOf(p.l)*21+VOWELS.indexOf(p.v))*28+FINALS.indexOf(p.t||''));
 if(p.t)return originalGlyphAlias(composerGlyphCode(p));
 return p.l||p.v||'';
}
function prefixGlyph(state){return state.kanaPrefix?originalGlyphAlias(0x1f00):'';}
export function composerText(state){return state.committed+render(state.pending)+prefixGlyph(state);}
function snapshot(s){return {committed:s.committed,pending:s.pending?{...s.pending}:null};}
function setPending(s,p,baseline=null){s.pending=p;s.history=baseline?[baseline]:[{committed:s.committed,pending:null}];}
function commit(s){s.committed+=render(s.pending)+prefixGlyph(s);s.pending=null;s.kanaPrefix=null;s.history=[];}
export function commitComposer(state){const s={...state,history:[...state.history]};commit(s);return s;}
function result(s,handled,compositionStatus=0){return {state:s,text:composerText(s),committed:s.committed,composing:render(s.pending)+prefixGlyph(s),handled,compositionStatus};}
// CompareStr distinguishes a newly started cell from an updated same cell.
// A commit can also leave the requeued key composing the following cell.
function inputResult(before,after){return result(after,true,after.committed!==before.committed?4:after.pending||after.kanaPrefix?(before.pending||before.kanaPrefix?3:2):0);}
export function hasPhysicalKey(event){return /^Key[A-Z]$/.test(event.code||'')||/^Digit[0-9]$/.test(event.code||'')||Object.hasOwn(CODES,event.code||'');}
export function isCompositionCommit(event){return Boolean(event.isComposing||event.keyCode===229||BINDINGS.get(event.currentTarget)?.isComposing||BINDINGS.get(event.target)?.isComposing);}
export function physicalKey(event,layout=null){
 let k;if(/^Key[A-Z]$/.test(event.code||''))k=event.code.slice(3).toLowerCase();else if(/^Digit[0-9]$/.test(event.code||''))k=event.code.slice(5);else k=CODES[event.code];
 if(k===undefined)return event.key?.length===1?event.key:null;
 k=event.shiftKey?(SHIFT[k]||k.toUpperCase()):k;
 // b94e cancels BIOS CapsLock casing for native Korean/Japanese tables.
 // English keeps BIOS letter casing; ba76 additionally flips these Dvorak
 // punctuation-position letter keys before its original table lookup.
 if(['us','dvorak'].includes(layout)&&(event.capsLock??event.getModifierState?.('CapsLock'))){
  if(/^[a-z]$/i.test(k))k=k===k.toLowerCase()?k.toUpperCase():k.toLowerCase();
  else if(layout==='dvorak')k=({',':'<','<':',','.':'>','>':'.','/':'?','?':'/',';':':',':':';'})[k]||k;
 }
 return k;
}
/** In the hybrid adapter, real IME evidence owns native text even when the
 * browser reports a physical-looking code. Explicit virtual packets retain
 * physical intent. A software ':' on Semicolon without Shift is native text,
 * not evidence that the user typed ';'. Layout letter remapping stays physical. */
export function isNativeInputKey(event,activeNative=false){
 if(event.virtualKeyboard||event.source==='virtual')return false;
 if(activeNative||event.isComposing||event.keyCode===229||event.key==='Process')return true;
 return hasPhysicalKey(event)&&/^[\x20-\x7e]$/.test(event.key||'')&&!/^[A-Za-z ]$/.test(event.key)&&physicalKey(event,'us')!==event.key;
}
export function feedKey(state,event){
 const isSpace=event.code==='Space'||event.key===' ',japanese=['hiragana','katakana'].includes(state.layout),nativeLayout=state.layout.startsWith('korean')||japanese;
 if(isSpace&&!event.altKey&&!event.metaKey&&!event.isComposing&&event.keyCode!==229&&((event.shiftKey&&!event.ctrlKey&&nativeLayout)||(event.ctrlKey&&!event.shiftKey&&japanese))){
  const s=commitComposer(state);
  if(event.ctrlKey)s.layout=s.layout==='hiragana'?'katakana':'hiragana';else s.latinMode=!s.latinMode;
  return {...inputResult(state,s),modeChanged:true,mode:{layout:s.layout,latinMode:s.latinMode,latinLayout:s.latinLayout}};
 }
 if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.keyCode===229)return result(state,false);
 const s={...state,pending:state.pending?{...state.pending}:null,history:state.history.map(x=>({...x,pending:x.pending?{...x.pending}:null}))};
 if(event.key==='Backspace'){
  if(s.kanaPrefix){s.kanaPrefix=null;return result(s,true);}
  if(s.pending&&s.history.length){const old=s.history.pop();s.committed=old.committed;s.pending=old.pending;}
  else if(s.pending){s.pending=null;s.history=[];}
  else{s.committed=Array.from(s.committed).slice(0,-1).join('');s.history=[];}
  return result(s,true);
 }
 if(event.key==='Enter'){commit(s);s.committed+='\n';return inputResult(state,s);}
 const effectiveLayout=s.latinMode?s.latinLayout:s.layout;
 const key=physicalKey(event,effectiveLayout);if(key===null)return result(state,false);
 if(['hiragana','katakana'].includes(effectiveLayout)&&['<','>'].includes(key)){if(s.kanaPrefix)commit(s);s.kanaPrefix=key;return inputResult(state,s);}
 const mapped=ORIGINAL_KEYBOARD_MAPS[effectiveLayout]?.mapping[key]||{display:key,role:'literal'};
 let c=mapped.display;if(!c)return result(state,false);
 if(s.kanaPrefix){
  if(mapped.role!=='kana'){commit(s);s.committed+=c;return inputResult(state,s);}
  const hira=s.layout==='katakana'?String.fromCodePoint(c.codePointAt(0)-0x60):c,jp=ORIGINAL_COMPOUNDS.japanese;
  let next=null;
  if(s.kanaPrefix==='>'&&jp.dakutenBases.includes(hira))next=String.fromCodePoint(hira.codePointAt(0)+1);
  else if(s.kanaPrefix==='>'&&hira===jp.specialDakuten.input)next=jp.specialDakuten.output;
  else if(s.kanaPrefix==='<'&&jp.handakutenBases.includes(hira))next=String.fromCodePoint(hira.codePointAt(0)+2);
  c=next?(s.layout==='katakana'?String.fromCodePoint(next.codePointAt(0)+0x60):next):originalGlyphAlias(s.layout==='katakana'?0x1f60:0x1f00);
  s.kanaPrefix=null;
 }
 if(!effectiveLayout.startsWith('korean')||mapped.role==='literal'||mapped.role==='kana'){commit(s);s.committed+=c;return inputResult(state,s);}
 const two=s.layout==='korean2',role=mapped.role,p=s.pending,finalPairs=two?TPAIRS:TPAIRS3;
 if(!p){setPending(s,{l:role==='initial'?c:null,v:role==='vowel'?c:null,t:role==='final'?c:null});return inputResult(state,s);}
 const old=snapshot(s);
 if(role==='vowel'){
  if(p.l&&!p.v&&!p.t){p.v=c;s.history.push(old);}
  else if(p.v&&!p.t&&VPAIRS[p.v+c]){p.v=VPAIRS[p.v+c];s.history.push(old);}
  else if(two&&p.v&&p.t){
   const [left,moved]=SPLIT[p.t]||['',p.t];p.t=left;commit(s);setPending(s,{l:moved,v:c,t:null},{committed:s.committed,pending:{l:moved,v:null,t:null}});
  }else{commit(s);setPending(s,{l:null,v:c,t:null});}
 }else if(role==='initial'&&p.l&&!p.v&&!p.t&&IPAIRS[p.l+c]){p.l=IPAIRS[p.l+c];s.history.push(old);
 }else if(role==='final'||two){
  if(!p.t&&FINALS.includes(c)&&(p.v||!two)){p.t=c;s.history.push(old);}
  else if(p.t&&finalPairs[p.t+c]){p.t=finalPairs[p.t+c];s.history.push(old);}
  else{commit(s);setPending(s,{l:role==='initial'?c:null,v:null,t:role==='final'?c:null});}
 }else if(role==='initial'){
  if(p.l&&!p.v&&!p.t&&IPAIRS[p.l+c]){p.l=IPAIRS[p.l+c];s.history.push(old);}
  else{commit(s);setPending(s,{l:c,v:null,t:null});}
 }
 return inputResult(state,s);
}

/** Bind a textarea/input to original physical-key composition.
 * hybridInput owns real OS composition by lifecycle/text evidence even when
 * key codes exist. The false default retains historical raw-key emulation.
 * Call reset after programmatic edits; caret moves commit the current syllable.
 */
export function bindComposer(textarea,{layout='2',latinMode=false,latinLayout='us',onInput=()=>{},handleEnter=false,commitOnBlur=true,nativePreview=false,hybridInput=false,onNativeReturn=null}={}){
 BINDINGS.get(textarea)?.destroy();
 let state=createComposer(layout,textarea.value),suffix='',disposed=false;state.latinMode=Boolean(latinMode);state.latinLayout=latinLayout==='dvorak'?'dvorak':'us';
 let physicalComposition=false,activeComposition=false,lastPhysicalAt=-Infinity,suppressInputValue=null,physicalEcho=null,fallbackEcho=null,interruptedNative=null,lastNativeData=null,handledReturn=null;
 const fullText=()=>composerText(state)+suffix;
 const restore=()=>{textarea.value=fullText();const caret=composerText(state).length;textarea.setSelectionRange(caret,caret);};
 const sync=()=>{if(textarea.value!==fullText()){state=resetComposer(state,textarea.value);suffix='';}};
 const describe=(r,event,{physical=false,native=false}={})=>({
  ...r,text:fullText(),physicalKey:physical?physicalKey(event,r.state.latinMode?r.state.latinLayout:r.state.layout):null,
  inputMode:physical?'physical':'native-mobile',
  editKind:r.modeChanged?'mode':event?.key==='Backspace'||event?.code==='Backspace'||event?.inputType?.startsWith('delete')?'delete':r.state.pending||r.state.kanaPrefix?'compose':'insert',
  // Native/mobile text does not reveal how many physical strokes produced it.
  acceptedKeystrokes:r.modeChanged?0:native||!physical?null:physicalKey(event)===null?0:1
 });
 const matchesInterrupted=event=>interruptedNative&&(textarea.value===interruptedNative.value||interruptedNative.data!=null&&event?.data===interruptedNative.data);
 const finalizeNativeBeforeVirtual=event=>{
  if(disposed||!hybridInput||!activeComposition||physicalComposition)return;
  // Runs before app keydown via the bridge; never rewrites live native DOM.
  interruptedNative={value:textarea.value,data:lastNativeData};sync();state=commitComposer(state);activeComposition=false;
  onInput(describe(result(state,false),event,{native:true}));
 };
 const onKey=event=>{
  if(!disposed&&event.key==='Enter'&&event.defaultPrevented){const token={};handledReturn=token;Promise.resolve().then(()=>{if(handledReturn===token)handledReturn=null;});}
  if(disposed||textarea.readOnly||textarea.disabled||event.defaultPrevented)return;
  if(hybridInput&&(event.virtualKeyboard||event.source==='virtual')){finalizeNativeBeforeVirtual(event);if(disposed)return;}
  if(hybridInput&&isNativeInputKey(event,activeComposition&&!physicalComposition)){lastPhysicalAt=-Infinity;physicalComposition=false;physicalEcho=null;fallbackEcho=null;suppressInputValue=null;interruptedNative=null;return;}
  const physical=hasPhysicalKey(event)||['Backspace','Enter','NumpadEnter'].includes(event.code);
  // Keep the known-working software Latin keyboard -> original app layout
  // path, but never consume native Hangul/kana jamo as literal physical keys.
  const latinFallback=(!event.code||event.code==='Unidentified')&&/^[\x20-\x7e]$/.test(event.key||'')&&!activeComposition&&!event.isComposing&&event.keyCode!==229;
  if(!physical&&!latinFallback){
   if(hybridInput&&event.key?.length===1){physicalEcho=null;fallbackEcho=null;suppressInputValue=null;interruptedNative=null;}
   if(activeComposition||event.isComposing||event.keyCode===229||event.key?.length===1)return;
  }
  if(activeComposition&&!physicalComposition&&!hasPhysicalKey(event))return;
  physicalEcho=null;fallbackEcho=null;
  if(physicalComposition)restore();else sync();
  // Let the IME consume its confirmation Enter. The app can use the exported
  // guard from an earlier-registered keydown handler as well.
  if(event.key==='Enter'&&isCompositionCommit(event))return;
  if(event.key==='Enter'&&!handleEnter){state=commitComposer(state);return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Delete','Tab'].includes(event.key)){state=commitComposer(state);return;}
  const start=textarea.selectionStart??textarea.value.length,end=textarea.selectionEnd??start;
  const hasSelection=end>start;
  if(start!==composerText(state).length||hasSelection){
   suffix=textarea.value.slice(end);state=resetComposer(state,textarea.value.slice(0,start));
  }
  const inputEvent=physical?{key:event.code==='Backspace'?'Backspace':event.key,code:event.code,shiftKey:event.shiftKey,capsLock:event.capsLock??event.getModifierState?.('CapsLock'),ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,isComposing:false,keyCode:0}:hybridInput&&latinFallback&&!event.shiftKey&&!['us','dvorak'].includes(state.latinMode?state.latinLayout:state.layout)&&/^[A-Z]$/.test(event.key)?{key:event.key.toLowerCase(),code:event.code,shiftKey:false,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey}:event;
  const rawValue=textarea.value.slice(0,start)+(event.key?.length===1?event.key:'')+textarea.value.slice(end);
  const r=hasSelection&&event.key==='Backspace'?result(state,true):feedKey(state,inputEvent);
  if(!r.handled)return;
  if(event.keyboardBridgeEvent){lastPhysicalAt=-Infinity;physicalComposition=false;}else if(physical||latinFallback){lastPhysicalAt=Date.now();if(activeComposition||event.isComposing||event.keyCode===229||event.key==='Process')physicalComposition=true;}
  event.preventDefault();state=r.state;restore();if(latinFallback)fallbackEcho={raw:event.key,value:rawValue,accepted:fullText()};onInput(describe(r,event,{physical}));
 };
 const compositionStart=()=>{if(disposed)return;physicalEcho=null;fallbackEcho=null;interruptedNative=null;lastNativeData=null;activeComposition=true;physicalComposition=!hybridInput&&Date.now()-lastPhysicalAt<100;if(hybridInput){lastPhysicalAt=-Infinity;state=commitComposer(state);}};
 const beforeInput=event=>{if(disposed)return;
  if(hybridInput&&!handleEnter&&['insertLineBreak','insertParagraph'].includes(event.inputType)&&onNativeReturn){
   event.preventDefault();if(activeComposition||event.isComposing||handledReturn)return;
   const token={};handledReturn=token;Promise.resolve().then(()=>{if(handledReturn===token)handledReturn=null;});
   onNativeReturn(event);return;
  }
  if(physicalComposition&&(event.isComposing||event.inputType?.includes('Composition')))event.preventDefault();};
 const composition=event=>{
  if(disposed)return;
  activeComposition=false;
  if(matchesInterrupted(event)){physicalEcho=interruptedNative.terminalInputSeen?null:{value:interruptedNative.value,data:interruptedNative.data,at:Date.now()};restore();interruptedNative=null;suppressInputValue=textarea.value;return;}
  if(!hybridInput&&(physicalComposition||Date.now()-lastPhysicalAt<100)){physicalEcho={value:textarea.value,data:event?.data,at:Date.now()};restore();}
  else{sync();onInput(describe(result(state,false),event,{native:true}));}
  suppressInputValue=textarea.value;activeComposition=false;physicalComposition=false;lastPhysicalAt=-Infinity;
 };
 const external=event=>{
  if(disposed)return;
  if(interruptedNative&&(textarea.value===interruptedNative.value||textarea.value===fullText()&&interruptedNative.data!=null&&event.data===interruptedNative.data)){if(!event.isComposing)interruptedNative.terminalInputSeen=true;restore();return;}
  if(interruptedNative&&!event.isComposing)interruptedNative=null;
  if(event.isComposing||activeComposition){
   lastNativeData=event.data??lastNativeData;
   if(nativePreview&&!physicalComposition)onInput({...describe(result(state,false),event,{native:true}),text:textarea.value,composing:event.data??'',nativeComposing:true});
   return;
  }
  if(fallbackEcho){const echo=fallbackEcho;fallbackEcho=null;if((event.data===undefined||event.data===echo.raw)&&(textarea.value===echo.value||textarea.value===echo.accepted+echo.raw)){restore();return;}}
  // Echo ownership is exact-buffer scoped, not merely same data in a time window.
  if(physicalEcho&&textarea.value===physicalEcho.value&&Date.now()-physicalEcho.at<100&&(event.inputType?.includes('Composition')||(event.inputType==='insertText'&&event.data===physicalEcho.data))){restore();physicalEcho=null;suppressInputValue=null;return;}
  physicalEcho=null;
  if(suppressInputValue===textarea.value){suppressInputValue=null;if(textarea.value!==fullText())restore();return;}
  suppressInputValue=null;
  if(physicalComposition){restore();return;}
  sync();onInput(describe(result(state,false),event,{native:true}));
 };
 const blur=()=>{if(commitOnBlur&&!activeComposition)state=commitComposer(state);};
 const resetInputOwnership=()=>{physicalComposition=false;lastPhysicalAt=-Infinity;physicalEcho=null;fallbackEcho=null;suppressInputValue=null;};
 const listeners={keyboardvirtualinput:finalizeNativeBeforeVirtual,keyboardinputmodechange:resetInputOwnership,compositionstart:compositionStart,keydown:onKey,beforeinput:beforeInput,compositionend:composition,input:external,blur};
 for(const [name,listener]of Object.entries(listeners))textarea.addEventListener(name,listener);
 const controller={
  get state(){return state;},get isComposing(){return activeComposition;},resetInputOwnership,
  // Accept a matching updated cell without resetting IME ownership/echo state.
  // No callback: callers may invoke this synchronously from onInput.
  commit({notify=false,event=null}={}){const before=state;if(!disposed)state=commitComposer(state);const r={...result(state,false,state.committed!==before.committed?4:0),text:fullText()};if(notify&&!disposed&&r.compositionStatus===4)onInput(describe(r,event,{physical:true}));return r;},
  // A capacity-limited consumer may accept/reject committed cells while a
  // requeued physical key is already composing the next cell. Keep that cell,
  // its undo history and IME ownership instead of reset(text), which loses it.
  replaceCommitted(text){if(disposed)return;state={...state,committed:String(text),history:state.history.map(old=>({...old,committed:String(text)}))};restore();},
  reset(text=textarea.value,newLayout){state=newLayout===undefined?resetComposer(state,text):createComposer(newLayout,text);suffix='';activeComposition=false;physicalComposition=false;lastPhysicalAt=-Infinity;suppressInputValue=null;physicalEcho=null;fallbackEcho=null;interruptedNative=null;lastNativeData=null;textarea.value=text;},
  destroy(){if(disposed)return;disposed=true;for(const [name,listener]of Object.entries(listeners))textarea.removeEventListener(name,listener);if(BINDINGS.get(textarea)===controller)BINDINGS.delete(textarea);}
 };
 BINDINGS.set(textarea,controller);return controller;
}
