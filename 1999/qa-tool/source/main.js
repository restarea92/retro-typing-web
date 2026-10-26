import {webQaUrl,describeRng} from './qa-rng.js';
import {createInputRouter} from './input-core.js';
import {createDosAdapter} from './dos-adapter.js';
import {createVisuals} from './visual.js';
const webFrame=document.querySelector('#web-frame'),dosFrame=document.querySelector('#dos-frame');
const webUrl=webQaUrl(window.location.search);if(webFrame.getAttribute('src')!==webUrl)webFrame.src=webUrl;
let web=null,importedLog=null,warning='',lastKey='—',dosState={ready:false,phase:'waiting',message:'원본 파일을 선택하세요.'},visuals=null;
const dos=createDosAdapter({iframe:dosFrame,onState:state=>{dosState=state;if(!state.ready&&router.enabled){router.setEnabled(false);web?.setCapture(false);}update();}});
const router=createInputRouter({getWeb:()=>web,getDos:()=>dos,onEvent:entry=>{if(!router.enabled)web?.setCapture(false);if(entry.type==='unsupportedKey')warning='이 입력은 양쪽에 전달하지 않았습니다. OS IME/시스템 단축키는 별도 확인하세요.';if(entry.type==='keyDown'||entry.type==='keyUp')lastKey=`${entry.code} ${entry.type==='keyDown'?'↓':'↑'}`;visuals?.event(entry);update();}});
function update(){if(!visuals)return;let observed={};try{observed=web?.observe()||{};}catch{}const rng=describeRng(observed.rng,dosState.rng),label=document.querySelector('#rng-status');if(label)label.textContent=rng.text;visuals.update({...router.status(),dosState,webState:{...observed,ready:Boolean(web?.ready)},pressedCodes:router.pressedCodes,replaying:router.status().running,mode:observed.language||'대기',text:observed.text||(observed.lastKey?`${observed.lastKey.key} · ${observed.lastKey.code} (웹 입력란 비어 있음)`:''),lastKey,warning,point:router.status().point});}
function guard(fn){try{const result=fn();if(result&&typeof result.catch==='function')result.catch(error=>{warning=String(error.message||error);if(!router.enabled)web?.setCapture(false);update();});return result;}catch(error){warning=String(error.message||error);if(!router.enabled)web?.setCapture(false);update();return false;}}
function focusBridge(){const el=document.querySelector('#bridge-node');if(el){el.tabIndex=0;el.focus({preventScroll:true});}}
function setEnabled(value){router.setEnabled(value);web?.setCapture(value);warning='';if(value)focusBridge();update();return value;}
function packet(event){return{code:event.code,repeat:event.repeat,shiftKey:event.shiftKey,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,capsLock:event.getModifierState?.('CapsLock'),isComposing:event.isComposing,keyCode:event.keyCode};}
function routeKey(event){if(!router.enabled)return;if(event.type==='keydown')guard(()=>router.keyDown(packet(event)));else guard(()=>router.keyUp(event.code));}
function nativeMouse(event,p){if(!router.enabled)return;guard(()=>{router.mouseMove(p.x,p.y,{webAlreadyHandled:true});if(event.type==='pointerdown')router.mouseButton(event.button,true,{webAlreadyHandled:true});else if(event.type==='pointerup')router.mouseButton(event.button,false,{webAlreadyHandled:true});});}
function bindWeb(){const next=webFrame.contentWindow?.__HTTD_QA_WEB__;if(!next||next===web)return;router.releaseAll('web-reload');web=next;web.subscribe({key:routeKey,pointer:nativeMouse});web.setCapture(router.enabled);webFrame.contentWindow.addEventListener('pointercancel',()=>router.releaseAll('web-pointer-cancel'),true);webFrame.contentWindow.addEventListener('blur',()=>setTimeout(()=>{if(!document.hasFocus())router.releaseAll('window-blur');},0));update();}
webFrame.addEventListener('load',()=>{if(router.enabled)setEnabled(false);web=null;const timer=setInterval(()=>{guard(bindWeb);if(web)clearInterval(timer);},100);setTimeout(()=>clearInterval(timer),30000);});
const webPoll=setInterval(()=>{guard(bindWeb);update();},150);
function hostKey(event){if(!router.enabled||event.qaBridgeEvent)return;const t=event.target;if(t?.id!=='input-monitor'&&t?.closest?.('input,textarea,select,button')&&!(event.type==='keyup'&&router.pressedCodes.includes(event.code)))return;event.preventDefault();event.stopImmediatePropagation();routeKey(event);}
window.addEventListener('keydown',hostKey,true);window.addEventListener('keyup',hostKey,true);
window.addEventListener('blur',()=>{if(document.activeElement!==webFrame&&document.activeElement!==dosFrame)router.releaseAll('window-blur');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)router.releaseAll('visibility-hidden');});
window.addEventListener('pointerup',event=>{if(router.status().buttons.includes(event.button))router.releaseAll('pointerup-outside-web');},true);
window.addEventListener('pointercancel',()=>router.releaseAll('pointer-cancel'),true);
window.addEventListener('pagehide',()=>{router.releaseAll('pagehide');web?.setCapture(false);dos.destroy();clearInterval(webPoll);});
visuals=createVisuals({onAction(action,payload){guard(async()=>{
 if(action==='toggle')setEnabled(!router.enabled);
 else if(action==='release')router.releaseAll('manual');
 else if(action==='file'){setEnabled(false);warning='';await dos.load(payload);}
 else if(action==='clear'){router.clearLog();importedLog=null;visuals.clear();}
 else if(action==='reloadWeb'){setEnabled(false);webFrame.src=webUrl;}
 else if(action==='toggleMode'){await router.sequence([{type:'keyDown',code:'ShiftLeft'},{type:'keyDown',code:'Space'},{type:'keyUp',code:'Space'},{type:'keyUp',code:'ShiftLeft'}],{delayMs:30});focusBridge();}
 else if(action==='import'){if(payload.size>5*1024*1024)throw new Error('입력 로그는 5 MiB 이하만 불러올 수 있습니다.');const data=JSON.parse(await payload.text());const log=Array.isArray(data)?data:data.events;if(!Array.isArray(log)||log.length>5000)throw new Error('올바른 입력 로그가 아닙니다.');for(const e of log)if(!e||typeof e.type!=='string')throw new Error('잘못된 로그 항목입니다.');importedLog=log;warning=`입력 로그 ${log.length}개를 읽었습니다. 재생 버튼은 정상 입력을 다시 전달합니다.`;}
 else if(action==='export'){const blob=new Blob([JSON.stringify({schema:'hancom-qa-input-v1',events:router.log},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hancom-qa-input.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 else if(action==='replay'){warning='재생은 동일 입력만 반복합니다. 난수·시각과 결과 상태는 동기화하지 않습니다.';await router.replay(importedLog||router.log);}
 else if(action==='runSequence')await router.sequence(payload);
 else if(action==='cancel')router.cancelSequence();
 update();
 });},onVirtualKey(event){guard(()=>{if(event.type==='keydown')router.keyDown({code:event.code});else router.keyUp(event.code);});}});
const sdk=Object.freeze({version:1,keyDown:p=>router.keyDown(p),keyUp:p=>router.keyUp(p),releaseAll:reason=>router.releaseAll(reason),mouseMove:(x,y)=>router.mouseMove(x,y),mouseButton:(button,pressed)=>router.mouseButton(button,pressed),click:(x,y,button)=>router.click(x,y,button),sequence:(steps,options)=>router.sequence(steps,options),replay:(events,options)=>router.replay(events,options),cancel:()=>router.cancelSequence(),setEnabled,status:()=>({...router.status(),web:web?.observe()||null,dos:dos.state,rng:describeRng(web?.observe()?.rng,dos.state.rng)}),get log(){return router.log;},clearLog:()=>router.clearLog()});
Object.defineProperty(window,'hancomQA',{value:sdk,configurable:true});update();
