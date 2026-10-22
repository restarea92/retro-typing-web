/** Input transport for the external virtual keyboard. It does not compose
 * Hangul, score attempts, or change routes. Editable focus is preserved for
 * real native IME; inputmode='none' is only a virtual-presentation hint. Existing app/composer handlers remain the single authority. */
const PRINTABLE={Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',IntlBackslash:'\\',Space:' '};
const SHIFT={'`':'~','1':'!','2':'@','3':'#','4':'$','5':'%','6':'^','7':'&','8':'*','9':'(','0':')','-':'_','=':'+','[':'{',']':'}','\\':'|',';':':',"'":'"',',':'<','.':'>','/':'?'};
const SPECIAL={ShiftLeft:'Shift',ShiftRight:'Shift',ControlLeft:'Control',ControlRight:'Control',AltLeft:'Alt',AltRight:'Alt',MetaLeft:'Meta',MetaRight:'Meta',NumpadEnter:'Enter',OSLeft:'Meta',OSRight:'Meta'};
const NAMED=new Set(['Escape','Tab','CapsLock','Backspace','Enter','Insert','Delete','Home','End','PageUp','PageDown','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PrintScreen','ScrollLock','Pause','ContextMenu',...Array.from({length:12},(_,i)=>'F'+(i+1))]);
const textInputTypes=new Set(['text','search','url','tel','email','password']);
export function isTypingInput(element){return Boolean(element&&!element.disabled&&!element.readOnly&&(element.tagName==='TEXTAREA'||element.tagName==='INPUT'&&textInputTypes.has((element.type||'text').toLowerCase())));}
export function keyboardPacketKey(code,{shiftKey=false,capsLock=false}={}){
 if(/^Key[A-Z]$/.test(code))return shiftKey!==capsLock?code.slice(3):code.slice(3).toLowerCase();
 const plain=/^Digit[0-9]$/.test(code)?code.slice(5):PRINTABLE[code];
 if(plain!==undefined)return shiftKey?(SHIFT[plain]||plain):plain;
 return SPECIAL[code]|| (NAMED.has(code)?code:null);
}
const beforeCodePoint=(text,at)=>at-(Array.from(text.slice(0,at)).at(-1)?.length||0);
const afterCodePoint=(text,at)=>at+(Array.from(text.slice(at))[0]?.length||0);

export function createKeyboardInputBridge({document=globalThis.document,surface,getOwner,getEpoch=()=>0,isVirtualMode=()=>false,focusNext=null,onKeyState=()=>{},onModifiers=()=>{}}={}){
 if(!document||!surface||typeof getOwner!=='function')throw new TypeError('Input bridge requires document, a noneditable focus surface and getOwner.');
 if(surface.tagName==='INPUT'||surface.tagName==='TEXTAREA'||surface.isContentEditable)throw new TypeError('The virtual keyboard focus surface must not be editable.');
 const win=document.defaultView||globalThis,held=new Map(),registered=new Map(),observedHardware=new Set(),notified=new Set();
 let typingTarget=null,capsLock=false,capsSource='hardware',disposed=false;
 const originalTabIndex=surface.getAttribute?.('tabindex');
 if(originalTabIndex===null||originalTabIndex===undefined)surface.setAttribute('tabindex','-1');
 const connected=target=>Boolean(target&&target.isConnected!==false);
 const currentOwner=()=>{const target=getOwner();return connected(target)&&!target.disabled?target:null;};
 const sameOwner=record=>connected(record.target)&&!record.target.disabled&&getEpoch()===record.epoch&&currentOwner()===record.target;
 const getTypingTarget=()=>connected(typingTarget)&&!typingTarget.disabled?typingTarget:null;
 const prune=()=>{for(const element of [...registered.keys()])if(!connected(element))unregisterTypingInput(element);};
 const inputModeHint=element=>{const entry=registered.get(element);if(!entry)return;if(isVirtualMode())element.setAttribute('inputmode','none');else if(entry.inputMode===null)element.removeAttribute('inputmode');else element.setAttribute('inputmode',entry.inputMode);};
 const modifiers=(packet={})=>({
  shiftKey:Boolean(packet.shiftKey||[...held.values()].some(h=>h.code==='ShiftLeft'||h.code==='ShiftRight')||observedHardware.has('ShiftLeft')||observedHardware.has('ShiftRight')),
  ctrlKey:Boolean(packet.ctrlKey||[...held.values()].some(h=>h.code==='ControlLeft'||h.code==='ControlRight')||observedHardware.has('ControlLeft')||observedHardware.has('ControlRight')),
  altKey:Boolean(packet.altKey||[...held.values()].some(h=>h.code==='AltLeft'||h.code==='AltRight')||observedHardware.has('AltLeft')||observedHardware.has('AltRight')),
  metaKey:Boolean(packet.metaKey||[...held.values()].some(h=>h.code==='MetaLeft'||h.code==='MetaRight')||observedHardware.has('MetaLeft')||observedHardware.has('MetaRight')),
  capsLock:packet.capsLock??capsLock
 });
 function notifyState(packet={}){
  const pressed=new Set([...held.values()].map(record=>record.code).concat([...observedHardware]));
  for(const code of pressed)if(!notified.has(code)){notified.add(code);onKeyState(code,true);}
  for(const code of [...notified])if(!pressed.has(code)){notified.delete(code);onKeyState(code,false);}
  onModifiers(modifiers(packet));
 }
 function makeKey(type,packet){
  const fields={...packet,bubbles:true,cancelable:true,composed:true,location:/Right$/.test(packet.code)?2:/Left$/.test(packet.code)?1:0};
  let event;
  if(typeof win.KeyboardEvent==='function')event=new win.KeyboardEvent(type,fields);
  else{event=new win.Event(type,{bubbles:true,cancelable:true});for(const [name,value]of Object.entries(fields))if(!['bubbles','cancelable','composed'].includes(name))Object.defineProperty(event,name,{value,configurable:true});}
  Object.defineProperty(event,'keyboardBridgeEvent',{value:true});
  Object.defineProperty(event,'virtualKeyboard',{value:packet.source==='virtual'});
  Object.defineProperty(event,'capsLock',{value:Boolean(packet.capsLock)});
  const originalModifier=event.getModifierState?.bind(event);
  Object.defineProperty(event,'getModifierState',{value:name=>name==='CapsLock'?Boolean(packet.capsLock):name==='Shift'?Boolean(packet.shiftKey):name==='Control'?Boolean(packet.ctrlKey):name==='Alt'?Boolean(packet.altKey):name==='Meta'?Boolean(packet.metaKey):originalModifier?.(name)||false});
  return event;
 }
 function inputEvent(type,inputType,data){
  let event;
  if(typeof win.InputEvent==='function')event=new win.InputEvent(type,{bubbles:true,cancelable:type==='beforeinput',composed:true,inputType,data,isComposing:false});
  else{event=new win.Event(type,{bubbles:true,cancelable:type==='beforeinput'});Object.assign(event,{inputType,data,isComposing:false});}
  return event;
 }
 function setSelection(input,start,end=start,direction='none'){
  input.setSelectionRange?.(start,end,direction);
  input.dispatchEvent(new win.Event('select',{bubbles:true}));
 }
 function editorDefault(record,event){
  const input=record.target;if(!isTypingInput(input))return false;
  const text=String(input.value||''),start=Math.max(0,input.selectionStart??text.length),end=Math.max(start,input.selectionEnd??start),key=event.key;
  if((event.ctrlKey||event.metaKey)&&key.toLowerCase()==='a'){setSelection(input,0,text.length);return true;}
  if(event.ctrlKey||event.metaKey||event.altKey)return false;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(key)){
   const anchor=event.shiftKey?(input.selectionDirection==='backward'?end:start):null,caret=event.shiftKey?(input.selectionDirection==='backward'?start:end):start;
   let next=caret;
   if(key==='ArrowLeft')next=!event.shiftKey&&end>start?start:beforeCodePoint(text,caret);
   else if(key==='ArrowRight')next=!event.shiftKey&&end>start?end:afterCodePoint(text,caret);
   else if(key==='Home')next=input.tagName==='TEXTAREA'?text.lastIndexOf('\n',Math.max(-1,caret-1))+1:0;
   else if(key==='End'){const lineEnd=text.indexOf('\n',caret);next=input.tagName==='TEXTAREA'&&lineEnd>=0?lineEnd:text.length;}
   else if(input.tagName==='TEXTAREA'){
    const lineStart=text.lastIndexOf('\n',Math.max(-1,caret-1))+1,column=caret-lineStart;
    if(key==='ArrowUp'){const prevEnd=Math.max(0,lineStart-1),prevStart=text.lastIndexOf('\n',Math.max(-1,prevEnd-1))+1;next=Math.min(prevStart+column,prevEnd);}
    else{const lineEnd=text.indexOf('\n',caret);if(lineEnd<0)next=text.length;else{const nextStart=lineEnd+1,nextEnd=text.indexOf('\n',nextStart);next=Math.min(nextStart+column,nextEnd<0?text.length:nextEnd);}}
   }
   setSelection(input,anchor===null?next:Math.min(anchor,next),anchor===null?next:Math.max(anchor,next),anchor!==null&&next<anchor?'backward':'none');return true;
  }
  let from=start,to=end,data=null,inputType;
  if(key==='Backspace'){if(from===to)from=beforeCodePoint(text,from);inputType='deleteContentBackward';}
  else if(key==='Delete'){if(from===to)to=afterCodePoint(text,to);inputType='deleteContentForward';}
  else if(key==='Enter'&&input.tagName==='TEXTAREA'){data='\n';inputType='insertLineBreak';}
  else if(Array.from(key).length===1){data=key;inputType='insertText';}
  else return false;
  if(data!==null){const max=input.getAttribute?.('maxlength');if(max!==null&&max!==undefined&&Number(max)>=0&&text.length-(to-from)+data.length>Number(max))return true;}
  if(from===to&&data===null)return true;
  const before=inputEvent('beforeinput',inputType,data);input.dispatchEvent(before);
  if(before.defaultPrevented||!sameOwner(record)||!isTypingInput(input))return true;
  input.value=text.slice(0,from)+(data||'')+text.slice(to);
  const caret=from+(data||'').length;input.setSelectionRange?.(caret,caret);
  input.dispatchEvent(inputEvent('input',inputType,data));return true;
 }
 function defaultDown(record,event){
  if(event.defaultPrevented||!sameOwner(record))return;
  if(editorDefault(record,event))return;
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.key==='Tab'){focusNext?.(record.target,{backward:event.shiftKey});return;}
  if(event.key==='Enter'&&record.target.tagName==='BUTTON')record.target.click();
  else if(event.key===' '&&(record.target.tagName==='BUTTON'||record.target.tagName==='INPUT'&&['checkbox','radio'].includes(record.target.type)))record.activateOnUp=true;
 }
 function down(packet,source='virtual'){
  if(disposed||!packet||typeof packet.code!=='string')return false;prune();
  const id=source+':'+packet.code,previous=held.get(id);
  if(previous&&!packet.repeat)return false;
  if(previous&&!sameOwner(previous))return false;
  const target=previous?.target||currentOwner();if(!target)return false;
  if(source==='virtual'&&!previous){
   const epoch=getEpoch();target.dispatchEvent(new win.Event('keyboardvirtualinput'));
   const stillOwns=()=>!disposed&&connected(target)&&!target.disabled&&currentOwner()===target&&getEpoch()===epoch;
   if(!stillOwns())return false;
   // A deliberate virtual gesture returns browser focus to its semantic owner.
   // Helper visibility/focus alone never does this. Native preedit was finalized
   // above; text selection survives focus, and inputmode remains only a hint.
   const input=['INPUT','TEXTAREA'].includes(target.tagName),value=input?target.value:null;
   const selection=input?[target.selectionStart,target.selectionEnd,target.selectionDirection]:null;
   if(input)focusTypingInput(target);
   else if(['BUTTON','SELECT'].includes(target.tagName)||target.getAttribute?.('tabindex')!=null)target.focus?.({preventScroll:true});
   if(!stillOwns())return false;
   if(input&&target.value===value&&typeof selection[0]==='number'&&typeof selection[1]==='number'&&
      (target.selectionStart!==selection[0]||target.selectionEnd!==selection[1]||target.selectionDirection!==selection[2]))target.setSelectionRange?.(...selection);
   if(!stillOwns())return false;
  }
  if(packet.code==='CapsLock'&&!previous){capsLock=source==='hardware'&&packet.capsLock!==undefined?Boolean(packet.capsLock):!capsLock;capsSource=source;}
  const modPacket={...packet};for(const [prefix,flag]of [['Shift','shiftKey'],['Control','ctrlKey'],['Alt','altKey'],['Meta','metaKey']])if(packet.code.startsWith(prefix))modPacket[flag]=true;
  const mods=modifiers(modPacket),key=packet.key??keyboardPacketKey(packet.code,mods);if(key===null||key===undefined)return false;
  const fields={...packet,...mods,source,key,repeat:Boolean(previous&&packet.repeat),isComposing:Boolean(packet.isComposing)};
  const record=previous||{code:packet.code,target,epoch:getEpoch(),key,source,packet:fields,activateOnUp:false};held.set(id,record);notifyState(mods);
  const event=makeKey('keydown',fields);target.dispatchEvent(event);defaultDown(record,event);
  return true;
 }
 function up(packet,source='virtual',{cancelled=false}={}){
  const code=typeof packet==='string'?packet:packet?.code,id=source+':'+code,record=held.get(id);if(!record)return false;
  held.delete(id);
  const fields={...record.packet,...modifiers(typeof packet==='object'?packet:{}),key:record.key,repeat:false};
  notifyState();
  const event=makeKey('keyup',fields);Object.defineProperty(event,'keyboardBridgeCancelled',{value:cancelled});record.target.dispatchEvent(event);
  if(!cancelled&&record.activateOnUp&&!event.defaultPrevented&&sameOwner(record))record.target.click();
  return true;
 }
 function releaseAll(){observedHardware.clear();for(const record of [...held.values()])up({code:record.code},record.source,{cancelled:true});notifyState();}
 function registerTypingInput(element,{onFocus}={}){
  if(disposed||!element||!['INPUT','TEXTAREA'].includes(element.tagName))return ()=>{};prune();
  if(!registered.has(element)){
   const pointer=event=>{if(isVirtualMode()&&isTypingInput(element)&&connected(element)&&(event.button??0)===0){event.preventDefault();registered.get(element)?.onFocus?.(element);focusTypingInput(element);}};
   element.addEventListener('pointerdown',pointer);registered.set(element,{pointer,onFocus,inputMode:element.getAttribute('inputmode')});
  }
  if(onFocus)registered.get(element).onFocus=onFocus;
  return ()=>unregisterTypingInput(element);
 }
 function unregisterTypingInput(element){const handler=registered.get(element);if(handler){element.removeEventListener('pointerdown',handler.pointer);registered.delete(element);if(handler.inputMode===null)element.removeAttribute('inputmode');else element.setAttribute('inputmode',handler.inputMode);}if(typingTarget===element)typingTarget=null;}
 function focusTypingInput(element,options={preventScroll:true}){
  if(disposed||!connected(element)||element.disabled||!['INPUT','TEXTAREA'].includes(element.tagName))return false;
  registerTypingInput(element);typingTarget=element;
  inputModeHint(element);element.focus(options);
  return true;
 }
 const forwardHardware=event=>{
  if(disposed||event.keyboardBridgeEvent||event.target!==surface||!isVirtualMode()||!getTypingTarget()||currentOwner()!==getTypingTarget())return;
  // Only the noneditable surface proxies physical input. Wrapper controls and
  // inputs that genuinely own browser focus are never intercepted here.
  const packet={code:event.code,key:event.key,repeat:event.repeat,shiftKey:event.shiftKey,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,capsLock:event.getModifierState?.('CapsLock'),isComposing:event.isComposing,keyCode:event.keyCode};
  if(!packet.code)return;
  event.preventDefault();event.stopImmediatePropagation();
  event.type==='keydown'?down(packet,'hardware'):up(packet,'hardware');
 };
 surface.addEventListener('keydown',forwardHardware,true);surface.addEventListener('keyup',forwardHardware,true);
 const observeHardware=event=>{
  if(event.keyboardBridgeEvent||!event.code)return;
  const owner=currentOwner();if(event.type==='keydown'&&event.target!==surface&&event.target!==owner&&!owner?.contains?.(event.target))return;
  if(event.type==='keydown')observedHardware.add(event.code);else observedHardware.delete(event.code);
  if(event.getModifierState&&(capsSource==='hardware'||event.type==='keydown'&&event.code==='CapsLock')){capsLock=event.getModifierState('CapsLock');capsSource='hardware';}
  notifyState({shiftKey:event.shiftKey,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,capsLock});
 };
 document.addEventListener('keydown',observeHardware,true);document.addEventListener('keyup',observeHardware,true);
 const blur=()=>releaseAll(),visibility=()=>{if(document.hidden)releaseAll();};
 win.addEventListener?.('blur',blur);document.addEventListener('visibilitychange',visibility);
 return {
  keyDown:packet=>down(packet),keyUp:packet=>up(packet,'virtual',{cancelled:Boolean(packet?.cancelled)}),releaseAll,
  resetInputOwnership(){releaseAll();prune();for(const element of registered.keys()){inputModeHint(element);element.dispatchEvent(new win.Event('keyboardinputmodechange'));}},
  registerTypingInput,unregisterTypingInput,focusTypingInput,getTypingTarget,getTypingInput:getTypingTarget,
  clearTypingTarget(){typingTarget=null;},
  get capsLock(){return capsLock;},get pressedCodes(){return [...held.values()].map(record=>record.code);},
  destroy(){if(disposed)return;releaseAll();disposed=true;for(const element of [...registered.keys()])unregisterTypingInput(element);document.removeEventListener('keydown',observeHardware,true);document.removeEventListener('keyup',observeHardware,true);surface.removeEventListener('keydown',forwardHardware,true);surface.removeEventListener('keyup',forwardHardware,true);win.removeEventListener?.('blur',blur);document.removeEventListener('visibilitychange',visibility);if(originalTabIndex===null||originalTabIndex===undefined)surface.removeAttribute('tabindex');}
 };
}
