import fs from 'node:fs';
import {parseHTML} from 'linkedom';
const {window,document}=parseHTML(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));
Object.assign(globalThis,{window,document});
// Linkedom0.18.14 ignores addEventListener({signal}); emulate the browser
// cleanup used by extras. This is a harness fidelity shim, not runtime code.
const originalAdd=window.EventTarget.prototype.addEventListener;
const originalRemove=window.EventTarget.prototype.removeEventListener;
window.EventTarget.prototype.addEventListener=function(type,listener,options){
 const signal=typeof options==='object'&&options?.signal;
 if(signal?.aborted)return;
 originalAdd.call(this,type,listener,options);
 if(signal)signal.addEventListener('abort',()=>originalRemove.call(this,type,listener,options),{once:true});
};
const saved=new Map();window.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v))};
window.HTMLElement.prototype.focus=function(){document._active=this};
Object.defineProperty(document,'activeElement',{get:()=>document._active});
window.HTMLElement.prototype.scrollIntoView=function(){};
window.HTMLTextAreaElement.prototype.setSelectionRange=function(s,e){this.selectionStart=s;this.selectionEnd=e};
Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{get(){return 640}});
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bindings={};for(const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)){const mod=await import(new URL(m[2],new URL('../app.js',import.meta.url)));for(const k of m[1].split(',').map(x=>x.trim()))bindings[k]=mod[k]}
const nativeInterval=globalThis.setInterval;globalThis.setInterval=(...args)=>{const timer=nativeInterval(...args);timer.unref();return timer};
const body=source.replace(/^import .*;$/mg,'').replace(/import\('\.\//g,"import('../");
const run=new Function(...Object.keys(bindings),body+'\nreturn {navigate,handleMenuAction,openMenu,showStageDialog,startKeys,startSentence,startLong,showLongSelect,home,recordAdvancement,endApplication,checkCoreIdle,setCoreIdleLast:value=>{if(coreIdle)coreIdle.last=value},getState:()=>({originalRandomState:originalRandom.state,originalSpeedHistory,runTextTotals,originalKeyProfile,mode,currentLanguage,appSettings,selectedLongId,selectedStage,keyCount,progress,session,finished,wordPhase,textPractice,keyDrill,gameStage,gamePhase,gameActive,gameScore,gameHits,gameMisses,rainLife,rainState,invadersState,gameRecords}),getGameState:()=>gameKind==="rain"?rainState:invadersState,setupRain,setupInvaders,beginGame,nextGameStage,submitGameWord,updateGame,stopCurrentActivity,setStage:value=>{selectedStage=value},setGameStage:value=>{gameStage=value},keyPress,getKeyTarget:()=>keyTarget,setKeyStarted:value=>{keyStarted=value},setLanguage:(language,layout)=>{currentLanguage=language;appSettings={...appSettings,language,layout}}};');
export const api=run(...Object.values(bindings));
export {document,window,saved};
await new Promise(r=>setTimeout(r,1800));
