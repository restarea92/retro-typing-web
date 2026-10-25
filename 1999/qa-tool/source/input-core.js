/** Normal-input transport shared by human controls and the public QA SDK.
 * No scoring, routes, clock, RNG, hidden-state setters or completed-text injection.
 */
export const LOGICAL_SIZE=Object.freeze({width:640,height:480});
const named={Escape:256,Enter:257,Tab:258,Backspace:259,Insert:260,Delete:261,ArrowRight:262,ArrowLeft:263,ArrowDown:264,ArrowUp:265,PageUp:266,PageDown:267,Home:268,End:269,CapsLock:280,ScrollLock:281,NumLock:282,PrintScreen:283,Pause:284,ShiftLeft:340,ControlLeft:341,AltLeft:342,ShiftRight:344,ControlRight:345,AltRight:346,IntlBackslash:348,Space:32,Quote:39,Comma:44,Minus:45,Period:46,Slash:47,Semicolon:59,Equal:61,BracketLeft:91,Backslash:92,BracketRight:93,Backquote:96,NumpadDecimal:330,NumpadDivide:331,NumpadMultiply:332,NumpadSubtract:333,NumpadAdd:334,NumpadEnter:335,NumpadEqual:336};
export function dosKey(code){if(/^Key[A-Z]$/.test(code))return code.charCodeAt(3);if(/^Digit[0-9]$/.test(code))return code.charCodeAt(5);if(/^F([1-9]|1[0-2])$/.test(code))return 289+Number(code.slice(1));if(/^Numpad[0-9]$/.test(code))return 320+Number(code.slice(6));return named[code]??null;}
export function logicalPoint(clientX,clientY,rect){if(!rect||!Number.isFinite(rect.width)||!Number.isFinite(rect.height)||rect.width<=0||rect.height<=0)return null;const x=(clientX-rect.left)*640/rect.width,y=(clientY-rect.top)*480/rect.height;return x>=0&&x<640&&y>=0&&y<480?{x,y}:null;}
export function validPoint(x,y){if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>=640||y<0||y>=480)throw new RangeError('Coordinates must be inside logical 640 × 480.');return{x,y};}
export function createInputRouter({getWeb,getDos,onEvent=()=>{},now=()=>performance.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(typeof getWeb!=='function'||typeof getDos!=='function')throw new TypeError('Both adapter getters are required.');
 const held=new Map(),buttons=new Set(),events=[];let enabled=false,point={x:320,y:240},counter=0,running=false,stopSequence=false;
 function record(type,data={},result=true){const entry={seq:++counter,at:now(),type,...data,result};events.push(entry);if(events.length>5000)events.shift();try{onEvent({...entry});}catch{}return result;}
 const ready=()=>Boolean(getWeb()?.ready&&getDos()?.ready);
 function need(){if(!enabled)throw new Error('Input bridge is paused.');if(!ready()){setEnabled(false);throw new Error('Both screens must be ready.');}}
 function releaseAll(reason='manual'){
  held.clear();buttons.clear();stopSequence=true;const result={};
  for(const [name,adapter]of [['web',getWeb()],['dos',getDos()]])try{adapter?.releaseAll();result[name]=Boolean(adapter);}catch(error){result[name]=false;result[name+'Error']=String(error.message||error);}
  return record('releaseAll',{reason},result);
 }
 function dispatch(type,data,webCall,dosCall){const result={};let failed=false;
  for(const [name,call]of [['web',webCall],['dos',dosCall]])try{result[name]=call()!==false;}catch(error){failed=true;result[name]=false;result[name+'Error']=String(error.message||error);}
  record(type,data,result);if(failed){enabled=false;releaseAll('adapter-error');throw new Error('Input adapter failed; both sides were released and the bridge paused.');}return result;
 }
 function keyDown(packet){need();if(typeof packet==='string')packet={code:packet};if(!packet||typeof packet.code!=='string')throw new TypeError('keyDown requires a KeyboardEvent.code.');
  if(dosKey(packet.code)===null||packet.metaKey||packet.isComposing||packet.keyCode===229)return record('unsupportedKey',{code:packet.code,reason:packet.isComposing||packet.keyCode===229?'OS IME input is not a physical-key packet.':'Unmapped or operating-system shortcut.'},{web:false,dos:false});
  const previous=held.get(packet.code);if(previous&&!packet.repeat)return record('duplicateIgnored',{code:packet.code},{web:false,dos:false});
  const p={code:packet.code,shiftKey:Boolean(packet.shiftKey||held.has('ShiftLeft')||held.has('ShiftRight')),ctrlKey:Boolean(packet.ctrlKey||held.has('ControlLeft')||held.has('ControlRight')),altKey:Boolean(packet.altKey||held.has('AltLeft')||held.has('AltRight')),metaKey:false,repeat:Boolean(previous&&packet.repeat)};
  if(typeof packet.capsLock==='boolean')p.capsLock=packet.capsLock;
  held.set(p.code,p);return dispatch('keyDown',p,()=>getWeb().keyDown(p),()=>getDos().keyDown(p));
 }
 function keyUp(code){code=typeof code==='string'?code:code?.code;if(!held.has(code))return false;held.delete(code);return dispatch('keyUp',{code},()=>getWeb()?.keyUp({code}),()=>getDos()?.keyUp({code}));}
 function mouseMove(x,y,{webAlreadyHandled=false}={}){need();point=validPoint(x,y);return dispatch('mouseMove',{...point,webAlreadyHandled},()=>webAlreadyHandled||getWeb().pointer({type:'move',...point,buttons:[...buttons]}),()=>getDos().mouseMove(x,y));}
 function mouseButton(button,pressed,{webAlreadyHandled=false}={}){need();if(![0,2].includes(button))throw new RangeError('Only left (0) and right (2) are supported.');if(typeof pressed!=='boolean')throw new TypeError('pressed must be boolean.');if(pressed===buttons.has(button))return false;
  pressed?buttons.add(button):buttons.delete(button);return dispatch('mouseButton',{...point,button,pressed,webAlreadyHandled},()=>webAlreadyHandled||getWeb().pointer({type:pressed?'down':'up',...point,button,buttons:[...buttons]}),()=>getDos().mouseButton(button,pressed));
 }
 function click(x,y,buttonCode=0){mouseMove(x,y);mouseButton(buttonCode,true);return mouseButton(buttonCode,false);}
 function setEnabled(value){if(typeof value!=='boolean')throw new TypeError('enabled must be boolean.');if(!value)releaseAll('pause');if(value&&!ready())throw new Error('Load the DOS bundle and wait for both screens.');enabled=value;record('enabled',{enabled});return enabled;}
 async function sequence(list,{delayMs=30,signal}={}){
  need();if(running)throw new Error('A sequence is already running.');if(!Array.isArray(list)||list.length>10000)throw new RangeError('sequence expects at most 10,000 input steps.');if(!Number.isFinite(delayMs)||delayMs<0||delayMs>60000)throw new RangeError('delayMs must be 0…60000.');
  running=true;stopSequence=false;let completed=0;
  try{for(const step of list){if(signal?.aborted||stopSequence)throw new Error('Input sequence cancelled.');need();const type=step.type;
    if(type==='keyDown')keyDown(step);else if(type==='keyUp')keyUp(step.code);else if(type==='mouseMove')mouseMove(step.x,step.y);else if(type==='mouseButton')mouseButton(step.button,step.pressed);else if(type==='click')click(step.x,step.y,step.button??0);else if(type==='wait'){const ms=step.ms;if(!Number.isFinite(ms)||ms<0||ms>60000)throw new RangeError('wait must be 0…60000ms.');await sleep(ms);}else throw new TypeError(`Unknown input step: ${type}`);
    completed++;if(delayMs)await sleep(delayMs);
   }return{completed};
  }finally{running=false;releaseAll('sequence-end');}
 }
 async function replay(log,{speed=1,signal}={}){
  if(!Array.isArray(log)||log.length>5000||!Number.isFinite(speed)||speed<=0||speed>100)throw new TypeError('Replay requires a bounded event log and speed > 0…100.');
  const steps=[];let previous=null;for(const entry of log){if(!['keyDown','keyUp','mouseMove','mouseButton'].includes(entry.type))continue;if(previous!==null&&Number.isFinite(entry.at)){const ms=Math.min(60000,Math.max(0,(entry.at-previous)/speed));if(ms)steps.push({type:'wait',ms});}steps.push({...entry});previous=entry.at;}return sequence(steps,{delayMs:0,signal});
 }
 return Object.freeze({keyDown,keyUp,releaseAll,mouseMove,mouseButton,move:mouseMove,button:mouseButton,click,sequence,replay,setEnabled,cancelSequence(){stopSequence=true;releaseAll('sequence-cancel');},get enabled(){return enabled;},get ready(){return ready();},get pressedCodes(){return [...held.keys()];},get log(){return events.map(x=>({...x,result:typeof x.result==='object'?{...x.result}:x.result}));},clearLog(){events.length=0;},status(){return{version:1,enabled,ready:ready(),held:[...held.keys()],buttons:[...buttons],point:{...point},events:events.length,running,randomness:'unsynchronized',inputMode:'physical-key packets; OS IME is separate'};}});
}
