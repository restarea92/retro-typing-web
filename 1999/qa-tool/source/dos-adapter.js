import {dosKey} from './input-core.js';
/** Stable normal-input adapter. Original bytes stay inside the child browser frame. */
export function createDosAdapter({iframe,onState=()=>{}}={}){
 if(!iframe)throw new TypeError('DOS iframe is required.');
 let last={ready:false,phase:'waiting',message:'원본 ZIP/.jsdos 파일을 선택하세요.'},destroyed=false;
 const receive=e=>{if(e.source!==iframe.contentWindow||e.origin!==location.origin||e.data?.type!=='hancom-dos-status')return;last={...e.data.state};onState({...last});};
 window.addEventListener('message',receive);
 const api=()=>iframe.contentWindow?.hancomDosPlayer;
 const wait=()=>new Promise((resolve,reject)=>{let tries=0;const poll=()=>{if(destroyed)return reject(new Error('DOS adapter closed.'));const a=api();if(a)return resolve(a);if(++tries>300)return reject(new Error('DOS 실행기 로드 시간 초과'));setTimeout(poll,100);};poll();});
 const down=new Set();
 return {get ready(){return Boolean(api()?.state().ready);},get state(){return {...last};},
 async load(file){const a=await wait();return a.load(file);},
 async loadFile(file){const a=await wait();return a.load(file);},
 keyDown(packet){const k=dosKey(packet?.code);if(k===null||k===undefined)return false;api()?.key(k,true);down.add(packet.code);return true;},
 keyUp({code}){const k=dosKey(code);if(k===null||k===undefined)return false;api()?.key(k,false);down.delete(code);return true;},
 releaseAll(){down.clear();api()?.releaseAll();},
 mouseMove(x,y){if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>=640||y<0||y>=480)throw new RangeError('DOS coordinates must be inside 640 × 480.');api()?.move(x/640,y/480);},
 mouseButton(button,pressed){if(button!==0&&button!==2)throw new RangeError('Only left/right mouse buttons are supported.');api()?.button(button===0?0:1,Boolean(pressed));},
 async stop(){const a=api();if(a)await a.stop();},
 destroy(){this.releaseAll();destroyed=true;window.removeEventListener('message',receive);api()?.stop();}
 };
}
