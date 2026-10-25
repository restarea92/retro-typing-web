import {prepareLocalBundle} from './bundle-local.js';
const host=document.querySelector('#dos'),empty=document.querySelector('#empty');
let startupTimer=null;
let player=null,ci=null,url=null,generation=0,loading=false,phase='waiting',message='원본 ZIP/.jsdos 파일을 선택하세요.';
const held=new Set(),buttons=new Set();
function state(){return {ready:Boolean(ci),phase,message,version:'js-dos 8.5.3 / emulators 8.5.2',localOnly:true,rngSynchronized:false};}
function report(p,text){phase=p;message=text;window.parent.postMessage({type:'hancom-dos-status',state:state()},location.origin);empty.textContent=text;empty.hidden=Boolean(ci);}
function releaseAll(){if(ci){for(const key of held)ci.sendKeyEvent(key,false);for(const b of buttons)ci.sendMouseButton(b,false);}held.clear();buttons.clear();}
async function stop(){clearTimeout(startupTimer);startupTimer=null;generation++;releaseAll();const old=ci;ci=null;try{if(player?.stop)await player.stop();else if(old)await old.exit();}finally{player=null;if(url)URL.revokeObjectURL(url);url=null;host.replaceChildren();report('waiting','원본 ZIP/.jsdos 파일을 선택하세요.');}}
async function load(file){
 if(loading)throw new Error('원본을 불러오는 중입니다. 잠시 기다려 주세요.');loading=true;
 try{await stop();const g=generation;report('preparing','로컬 ZIP 검증·준비 중… (업로드 없음)');
 const zip=await import('./vendor/fflate.js');
 const blob=await prepareLocalBundle(file,zip);if(g!==generation)return false;
 url=URL.createObjectURL(blob);report('loading','DOS 시작 중…');
 startupTimer=setTimeout(()=>{if(g===generation&&!ci)report('error','DOS 시작 시간 초과. 실행기 리소스 로드 및 원본 파일을 확인하세요.');},90000);
 if(typeof window.Dos!=='function')throw new Error('js-dos 실행기 다운로드에 실패했습니다. 네트워크 연결을 확인하세요.');
 player=window.Dos(host,{url,pathPrefix:'./vendor/emulators/',backend:'dosbox',backendLocked:true,workerThread:false,renderBackend:'canvas',offscreenCanvas:false,mouseCapture:false,autoStart:true,countDownStart:0,kiosk:true,autoSave:false,quickSave:false,fsChanges:{local:false},renderAspect:'4/3',imageRendering:'pixelated',onEvent:(event,instance)=>{
 if(g!==generation)return;
 if(event==='ci-ready'){clearTimeout(startupTimer);startupTimer=null;ci=instance;report('ready','원본 준비 완료 · 난수 시드 미동기화');ci.events().onExit(()=>{if(g===generation){ci=null;held.clear();buttons.clear();report('stopped','DOS 실행이 종료되었습니다.');}});}
 if(event==='emulator-error'||event==='error'){releaseAll();ci=null;report('error','DOS 실행 오류: '+String(instance||event));}
 }});player.setNoCloud(true);player.setKiosk(true);return true;
 }catch(error){clearTimeout(startupTimer);startupTimer=null;ci=null;report('error',error.message||String(error));throw error;}finally{loading=false;}
}
// js-dos listens on this frame's window. Real DOM input is intentionally suppressed;
// only the shared parent SDK may call the CI, preventing native + mirrored doubles.
for(const name of ['keydown','keyup','keypress','mousedown','mouseup','mousemove','pointerdown','pointerup','pointermove','wheel','contextmenu'])window.addEventListener(name,e=>{e.preventDefault();e.stopImmediatePropagation();},{capture:true,passive:false});
window.addEventListener('blur',releaseAll);window.addEventListener('pagehide',()=>{releaseAll();if(url)URL.revokeObjectURL(url);});
window.hancomDosPlayer=Object.freeze({load,stop,state,releaseAll,key(code,pressed){if(!ci)throw new Error('DOS not ready.');if(!Number.isInteger(code))throw new TypeError('Invalid key.');pressed?held.add(code):held.delete(code);ci.sendKeyEvent(code,Boolean(pressed));},move(x,y){if(!ci)throw new Error('DOS not ready.');ci.sendMouseMotion(x,y);},button(button,pressed){if(!ci)throw new Error('DOS not ready.');pressed?buttons.add(button):buttons.delete(button);ci.sendMouseButton(button,pressed);}});
report('waiting',message);
