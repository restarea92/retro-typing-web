import {dosKey} from './input-core.js';
/** QA-only bridge into an unmodified app input path. Never loaded by production.
 * Same-origin parent code uses window.__HTTD_QA_WEB__; no postMessage command
 * endpoint is installed, and no score, RNG, clock or route mutator is exposed.
 */
export function installQaWebAdapter({bridge,getOwner,getState=()=>({}),releasePointer=()=>{},document=globalThis.document}={}){
 if(!document||!bridge||typeof getOwner!=='function')throw new TypeError('A document, app keyboard bridge and input owner are required.');
 const win=document.defaultView,frame=document.querySelector('.classic');
 if(!win||!frame)throw new Error('The QA adapter requires the ordinary .classic app frame.');
 if(win.__HTTD_QA_WEB__)throw new Error('QA adapter already installed.');
 let onNativeKey=()=>{},onNativePointer=()=>{},armed=false,disposed=false;
 const downs=new Map(),hovered=new Set(),active=new Set();
 let focusMarker=null,lastObservedKey=null;
 const coordinate=e=>{const r=frame.getBoundingClientRect();if(!r.width||!r.height)return null;const x=(e.clientX-r.left)*640/r.width,y=(e.clientY-r.top)*480/r.height;return x>=0&&y>=0&&x<640&&y<480?{x,y}:null;};
 const ancestors=target=>{const result=[];for(let el=target;el&&frame.contains(el);el=el.parentElement)result.push(el);return result;};
 const clearMarks=(set,name)=>{for(const el of set)el.removeAttribute(name);set.clear();};
 function markHover(target){clearMarks(hovered,'data-qa-hover');for(const el of ancestors(target)){el.setAttribute('data-qa-hover','');hovered.add(el);}}
 function markActive(){clearMarks(active,'data-qa-active');for(const target of downs.values())for(const el of ancestors(target)){el.setAttribute('data-qa-active','');active.add(el);}}
 function clearFocus(){focusMarker?.removeAttribute('data-qa-focus-visible');focusMarker=null;}
 function markFocus(){clearFocus();const el=document.activeElement;if(el&&frame.contains(el)){el.setAttribute('data-qa-focus-visible','');focusMarker=el;}}
 // Synthetic events cannot set CSS :hover/:active/:focus-visible. Reuse the
 // exact existing rule bodies under equivalent QA-only state attributes. This
 // is not an invented pressed style, nor a claim of trusted hardware events.
 const stateStyle=document.createElement('style');stateStyle.dataset.qaInputStates='';
 const viewportCss='html,body{margin:0!important;padding:0!important;width:640px!important;height:480px!important;min-height:480px!important;overflow:hidden!important;display:block!important}.app-wrap{margin:0!important;padding:0!important;width:640px!important;max-width:none!important}.helpers,#outside-help,#external-controls,.fullscreen-display-controls{display:none!important}#display-viewport{width:640px!important;height:480px!important}#frame-box{left:0!important;transform:none!important}.crt-overlay{display:none!important}.crt-enabled .classic{filter:none!important}';
 let copiedRules=0,unreadableSheets=0;
 function mirrorRules(rules){let text='';for(const rule of rules||[]){
  if(rule.selectorText&&/:(?:hover|active|focus-visible)\b/.test(rule.selectorText)){
   const selector=rule.selectorText.replace(/:focus-visible\b/g,'[data-qa-focus-visible]').replace(/:hover\b/g,'[data-qa-hover]').replace(/:active\b/g,'[data-qa-active]');
   text+=`${selector}{${rule.style.cssText}}\n`;copiedRules++;
  }else if(rule.cssRules){const nested=mirrorRules(rule.cssRules);if(nested){const prefix=rule.cssText.slice(0,rule.cssText.indexOf('{'));text+=`${prefix}{${nested}}\n`;}}
 }return text;}
 let css='';for(const sheet of Array.from(document.styleSheets||[])){try{css+=mirrorRules(sheet.cssRules);}catch{unreadableSheets++;}}
 stateStyle.textContent=viewportCss+'\n'+css;document.head.append(stateStyle);
 function captureKey(e){if(e.keyboardBridgeEvent){if(e.type==='keydown')lastObservedKey={code:e.code,key:e.key};return;}if(!armed||disposed)return;e.preventDefault();e.stopImmediatePropagation();onNativeKey(e);}
 for(const type of ['keydown','keyup'])win.addEventListener(type,captureKey,true);
 function capturePointer(e){
  if(!armed||disposed||e.qaBridgePointer)return;
  const p=coordinate(e);if(!p)return;
  if(e.type!=='pointermove'&&![0,2].includes(e.button))return;
  // The real mouse event still runs normally in this iframe. The parent sends
  // it to DOS only (webAlreadyHandled=true), never back to this adapter.
  clearFocus();clearMarks(hovered,'data-qa-hover');
  onNativePointer(e,p);
 }
 for(const type of ['pointermove','pointerdown','pointerup'])win.addEventListener(type,capturePointer,true);
 const commonTarget=(a,b)=>{for(const el of ancestors(a))if(el===b||el.contains?.(b))return el;return null;};
 function pointer({type,x,y,button=0,buttons=[]}={}){
  if(disposed)return false;
  if(!['move','down','up'].includes(type))throw new TypeError('Unknown pointer event type.');
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>=640||y<0||y>=480)throw new RangeError('Pointer coordinates must be inside logical 640 × 480.');
  if(![0,2].includes(button))throw new RangeError('Only DOM left (0) and right (2) mouse buttons are supported.');
  const r=frame.getBoundingClientRect();if(!r.width||!r.height)return false;
  const clientX=r.left+x*r.width/640,clientY=r.top+y*r.height/480;
  const target=document.elementFromPoint?.(clientX,clientY);
  if(!target||!frame.contains(target)||target.closest?.('[inert]'))return false;
  const mask=Array.isArray(buttons)?buttons.reduce((v,b)=>v|(b===0?1:b===2?2:0),0):0;
  const fields={bubbles:true,cancelable:true,composed:true,clientX,clientY,button,buttons:mask,pointerId:1,pointerType:'mouse',isPrimary:true};
  const emit=(name,el=target)=>{const eventFields={...fields,detail:['mousedown','mouseup','click'].includes(name)?1:0};const C=name.startsWith('pointer')?(win.PointerEvent||win.MouseEvent):win.MouseEvent;let e;
   if(typeof C==='function')e=new C(name,eventFields);else{e=new win.Event(name,{bubbles:true,cancelable:true});for(const [key,value]of Object.entries(eventFields))if(!['bubbles','cancelable','composed'].includes(key))Object.defineProperty(e,key,{value});}
   Object.defineProperty(e,'qaBridgePointer',{value:true});return el.dispatchEvent(e);
  };
  markHover(target);
  if(type==='move'){emit('pointermove');emit('mousemove');}
  if(type==='down'){
   clearFocus();downs.set(button,target);markActive();
   if(emit('pointerdown')&&emit('mousedown')){
    const focus=target.closest?.('input,textarea,button,[tabindex],select');
    if(focus&&!focus.disabled&&!focus.closest?.('[inert]'))focus.focus?.({preventScroll:true});
   }
  }
  if(type==='up'){
   const pressed=downs.get(button);downs.delete(button);markActive();emit('pointerup');emit('mouseup');
   const clickTarget=pressed&&commonTarget(pressed,target);
   if(clickTarget&&clickTarget.isConnected!==false&&!clickTarget.closest?.('[inert]')&&!clickTarget.closest?.('button:disabled,input:disabled,select:disabled,textarea:disabled')){
    if(button===0)emit('click',clickTarget);else emit('contextmenu',clickTarget);
   }
  }
  return true;
 }
 function releaseAll(){downs.clear();clearMarks(active,'data-qa-active');releasePointer();bridge.releaseAll();}
 function observe(){const owner=getOwner();return{
  lastKey:lastObservedKey?{...lastObservedKey}:null,language:document.querySelector('#language')?.textContent||'',text:owner&&'value'in owner?String(owner.value):'',
  owner:owner?.getAttribute?.('aria-label')||owner?.id||owner?.tagName||'',title:document.querySelector('.titlebar')?.textContent||'',
  crt:false,storedCrtEnabled:document.querySelector('#display-viewport')?.classList.contains('crt-enabled')||false,
  ...getState(),inputTransport:'synthetic-normal-input',nativeImeSynchronized:false,cssStateRules:copiedRules,unreadableStyleSheets:unreadableSheets
 };}
 const onBlur=()=>{releaseAll();clearMarks(hovered,'data-qa-hover');clearFocus();};
 win.addEventListener('blur',onBlur);
 const api=Object.freeze({
  get ready(){return !disposed;},
  keyDown(packet){if(disposed)return false;const ok=bridge.keyDown(packet);markFocus();return ok;},
  keyUp(packet){if(disposed||dosKey(packet?.code)===null)return false;const ok=bridge.keyUp(packet);markFocus();const held=bridge.pressedCodes;return ok||(Array.isArray(held)&&!held.includes(packet.code));},
  releaseAll,pointer,observe,
  setCapture(value){armed=Boolean(value);if(!armed){releaseAll();clearMarks(hovered,'data-qa-hover');clearFocus();}},
  subscribe({key=()=>{},pointer:mouse=()=>{}}={}){onNativeKey=key;onNativePointer=mouse;return()=>{if(onNativeKey===key)onNativeKey=()=>{};if(onNativePointer===mouse)onNativePointer=()=>{};};},
  get rect(){return frame.getBoundingClientRect();},
  destroy(){if(disposed)return;releaseAll();disposed=true;armed=false;clearMarks(hovered,'data-qa-hover');clearFocus();stateStyle.remove();for(const type of ['keydown','keyup'])win.removeEventListener(type,captureKey,true);for(const type of ['pointermove','pointerdown','pointerup'])win.removeEventListener(type,capturePointer,true);win.removeEventListener('blur',onBlur);delete win.__HTTD_QA_WEB__;}
 });
 Object.defineProperty(win,'__HTTD_QA_WEB__',{value:api,configurable:true});win.dispatchEvent(new win.Event('httd-qa-ready'));return api;
}
