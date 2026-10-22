import {hasPhysicalKey,isNativeInputKey} from './input-composer.js';

const LEADS=Array.from('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ');
const VOWELS=Array.from('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ');
const TAILS=['',...Array.from('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ')];
const COMBINED={'ㅘ':'ㅗㅏ','ㅙ':'ㅗㅐ','ㅚ':'ㅗㅣ','ㅝ':'ㅜㅓ','ㅞ':'ㅜㅔ','ㅟ':'ㅜㅣ','ㅢ':'ㅡㅣ','ㄳ':'ㄱㅅ','ㄵ':'ㄴㅈ','ㄶ':'ㄴㅎ','ㄺ':'ㄹㄱ','ㄻ':'ㄹㅁ','ㄼ':'ㄹㅂ','ㄽ':'ㄹㅅ','ㄾ':'ㄹㅌ','ㄿ':'ㄹㅍ','ㅀ':'ㄹㅎ','ㅄ':'ㅂㅅ'};
/** Text-only adaptation, not evidence of a physical key/three-set role. It
 * observes added Korean components while leaving the OS composition intact. */
export function nativeDrillUnits(value){
 const result=[],add=value=>result.push(...Array.from(COMBINED[value]||value));
 for(const glyph of String(value)){
  const n=glyph.codePointAt(0),s=n-0xac00;
  if(s>=0&&s<11172){add(LEADS[Math.floor(s/588)]);add(VOWELS[Math.floor(s%588/28)]);if(s%28)add(TAILS[s%28]);}
  else if(n>=0x1100&&n<=0x1112)add(LEADS[n-0x1100]);
  else if(n>=0x1161&&n<=0x1175)add(VOWELS[n-0x1161]);
  else if(n>=0x11a8&&n<=0x11c2)add(TAILS[n-0x11a7]);
  else add(glyph);
 }
 return result;
}
const isLatinFallback=event=>(!event.code||event.code==='Unidentified')&&/^[\x20-\x7e]$/.test(event.key||'')&&!event.isComposing&&event.keyCode!==229;
export function bindKeyPracticeInput(input,{onAttempt=()=>{},physicalCharacter,physicalAscii,onComposition=()=>{},now=Date.now,hybridInput=false}={}){
 let disposed=false,active=false,physicalComposition=false,physicalAt=-Infinity,previous=nativeDrillUnits(input.value),physicalEcho=null,keyEcho=null,interruptedNative=null,lastNativeData=null;
 const live=()=>!disposed&&input.isConnected!==false&&!input.readOnly&&!input.disabled;
 const recentPhysical=()=>now()-physicalAt<100;
 const setActive=value=>{active=value;onComposition(value);};
 const nativeUpdate=event=>{
  lastNativeData=event?.data??lastNativeData;
  const next=nativeDrillUnits(input.value);let prefix=0;
  while(prefix<previous.length&&prefix<next.length&&previous[prefix]===next[prefix])prefix++;
  if(event?.inputType?.startsWith('delete')){if(next.length<previous.length)onAttempt('Backspace');}
  else for(const glyph of next.slice(prefix)){if(!live())break;onAttempt(glyph,null);}
  previous=next;
 };
 const matchesInterrupted=event=>interruptedNative&&(input.value===interruptedNative.value||interruptedNative.data!=null&&event?.data===interruptedNative.data);
 const finalizeNativeBeforeVirtual=()=>{if(!live()||!hybridInput||!active||physicalComposition)return;nativeUpdate({});if(!live())return;interruptedNative={value:input.value,data:lastNativeData};setActive(false);};
 const clearPhysicalBuffer=()=>{input.value='';previous=[];};
 const resetInputOwnership=()=>{physicalComposition=false;physicalAt=-Infinity;physicalEcho=null;keyEcho=null;};
 const handlers={
  onkeydown(event){
   if(!live()||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey)return;
   const virtual=event.virtualKeyboard||event.source==='virtual';
   if(hybridInput&&virtual){finalizeNativeBeforeVirtual();if(!live())return;}
   if(hybridInput&&isNativeInputKey(event,active&&!physicalComposition)){physicalAt=-Infinity;physicalComposition=false;physicalEcho=null;keyEcho=null;interruptedNative=null;return;}
   const physical=hasPhysicalKey(event),latin=!active&&isLatinFallback(event);
   if(physical||latin){
    let mappedEvent=event,glyph=physicalCharacter(event);if(hybridInput&&latin&&!event.shiftKey&&/^[A-Z]$/.test(event.key)&&glyph?.codePointAt(0)>127){mappedEvent={key:event.key.toLowerCase(),code:event.code,shiftKey:false};glyph=physicalCharacter(mappedEvent);}
    if(glyph!==null&&glyph!==undefined){
     event.preventDefault();physicalEcho=null;keyEcho=null;
     if(event.keyboardBridgeEvent){physicalAt=-Infinity;physicalComposition=false;}
     else{physicalAt=now();physicalComposition=active||Boolean(event.isComposing||event.keyCode===229||event.key==='Process');}
     onAttempt(glyph,physicalAscii(mappedEvent));if(!event.keyboardBridgeEvent)keyEcho={raw:event.key,glyph};
     if(!active)clearPhysicalBuffer();return;
    }
   }
   if(!physical){physicalAt=-Infinity;physicalComposition=false;physicalEcho=null;keyEcho=null;if(hybridInput&&event.key?.length===1)interruptedNative=null;}
   if(event.isComposing||active||event.keyCode===229)return;
   if(['Backspace','Enter','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown','Insert','Delete'].includes(event.key)||/^F(?:[1-9]|10)$/.test(event.key)){
    // A native code-less delete is observed once in its input event instead.
    if(!event.code&&['Backspace','Delete'].includes(event.key))return;
    event.preventDefault();onAttempt(event.key,null);
   }
  },
  oncompositionstart(){if(!live())return;physicalEcho=null;keyEcho=null;interruptedNative=null;lastNativeData=null;physicalComposition=!hybridInput&&recentPhysical();if(hybridInput)physicalAt=-Infinity;setActive(true);},
  oncompositionend(event={}){
   if(!live())return;
   const value=input.value;
   if(matchesInterrupted(event)){physicalEcho=interruptedNative.terminalInputSeen?null:{value:interruptedNative.value,data:event.data};interruptedNative=null;setActive(false);clearPhysicalBuffer();return;}
   if(!hybridInput&&(physicalComposition||recentPhysical())){physicalEcho={value,data:event.data};clearPhysicalBuffer();}
   else nativeUpdate(event);
   // Keep native text after commit. Clearing it makes a real repeated jamo
   // indistinguishable from the final input echo and breaks IME ownership.
   setActive(false);physicalComposition=false;physicalAt=-Infinity;
  },
  oninput(event={}){
   if(!live())return;
   if(interruptedNative&&input.value===interruptedNative.value){if(!event.isComposing)interruptedNative.terminalInputSeen=true;clearPhysicalBuffer();return;}
   if(interruptedNative&&!event.isComposing)interruptedNative=null;
   if(physicalComposition)return;
   if(keyEcho&&!active&&!event.isComposing){const echo=keyEcho;keyEcho=null;if(input.value===echo.raw||input.value===echo.glyph){clearPhysicalBuffer();return;}}
   if(physicalEcho){const echo=physicalEcho;physicalEcho=null;if(input.value===echo.value&&(event.data===undefined||event.data===echo.data||event.inputType?.includes('Composition'))){clearPhysicalBuffer();return;}}
   nativeUpdate(event);
  }
 };
 for(const [name,handler]of Object.entries(handlers))input[name]=handler;
 input.addEventListener('keyboardvirtualinput',finalizeNativeBeforeVirtual);
 input.addEventListener('keyboardinputmodechange',resetInputOwnership);
 return {get isComposing(){return active;},resetInputOwnership,destroy(){if(disposed)return;disposed=true;for(const [name,handler]of Object.entries(handlers))if(input[name]===handler)input[name]=null;input.removeEventListener('keyboardvirtualinput',finalizeNativeBeforeVirtual);input.removeEventListener('keyboardinputmodechange',resetInputOwnership);}};
}
