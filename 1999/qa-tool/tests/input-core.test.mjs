import test from 'node:test';
import assert from 'node:assert/strict';
import {dosKey,logicalPoint,validPoint,createInputRouter} from '../source/input-core.js';

function fixture({webReady=true,dosReady=true}={}) {
  const calls=[];
  const web={ready:webReady,keyDown:p=>(calls.push(['web','down',{...p}]),true),keyUp:p=>(calls.push(['web','up',p]),true),releaseAll:()=>calls.push(['web','release']),pointer:p=>(calls.push(['web','pointer',p]),true)};
  const dos={ready:dosReady,keyDown:p=>(calls.push(['dos','down',{...p}]),true),keyUp:p=>(calls.push(['dos','up',p]),true),releaseAll:()=>calls.push(['dos','release']),mouseMove:(x,y)=>(calls.push(['dos','move',x,y]),true),mouseButton:(b,p)=>(calls.push(['dos','button',b,p]),true)};
  let clock=100;
  const events=[];
  const router=createInputRouter({getWeb:()=>web,getDos:()=>dos,now:()=>clock++,onEvent:e=>events.push(e)});
  return {web,dos,router,calls,events};
}
const enable=f=>{f.router.setEnabled(true);f.calls.length=0;return f;};
const move=(r,...args)=>(r.mouseMove||r.move)(...args);
const button=(r,...args)=>(r.mouseButton||r.button)(...args);

test('js-dos named codes and physical letter/digit mapping',()=>{
  for(const [code,value] of Object.entries({KeyA:65,KeyZ:90,Digit0:48,Digit9:57,Enter:257,Escape:256,ArrowLeft:263,ArrowRight:262,ControlLeft:341,ShiftRight:344,F1:290,F12:301,Numpad0:320,Numpad9:329,NumpadEnter:335,IntlBackslash:348})) assert.equal(dosKey(code),value,code);
});
test('unknown and browser-only Meta/context menu are not DOS input',()=>{
  for(const code of ['Unidentified','MetaLeft','MetaRight','ContextMenu','F13','KeyAA','Digit10','HangulMode','']) assert.equal(dosKey(code),null,code);
});
test('logical coordinate conversion scales full frame, preserves edges',()=>{
  const rect={left:30,top:40,width:320,height:240};
  assert.deepEqual(logicalPoint(30,40,rect),{x:0,y:0});
  assert.deepEqual(logicalPoint(190,160,rect),{x:320,y:240});
  assert.equal(logicalPoint(350,40,rect),null);
  assert.equal(logicalPoint(30,280,rect),null);
  assert.equal(logicalPoint(29,40,rect),null);
  assert.equal(logicalPoint(30,40,{...rect,width:0}),null);
  assert.equal(logicalPoint(NaN,40,rect),null);
});
test('SDK rejects invalid coordinates rather than inventing inside clicks',()=>{
  assert.deepEqual(validPoint(639,479),{x:639,y:479});
  for(const pair of [[-1,0],[640,0],[0,480],[Infinity,2],[NaN,0],['2',0]]) assert.throws(()=>validPoint(...pair),RangeError);
});
test('disabled bridge rejects SDK key and pointer operations',()=>{
  const {router}=fixture();
  assert.throws(()=>router.keyDown({code:'KeyA'}),/paused|disabled/i);
  assert.throws(()=>move(router,1,2),/paused|disabled/i);
});
test('both adapters must explicitly be ready before arm',()=>{
  for(const state of [{webReady:false},{dosReady:false}]) {
    const {router}=fixture(state);assert.equal(router.ready,false);assert.throws(()=>router.setEnabled(true));
  }
});
test('key down/up goes once to both and uses shared physical code',()=>{
  const f=enable(fixture());
  assert.deepEqual(f.router.keyDown({code:'KeyA'}),{web:true,dos:true});
  assert.deepEqual(f.router.keyUp({code:'KeyA'}),{web:true,dos:true});
  for(const target of ['web','dos']) {
    assert.equal(f.calls.filter(c=>c[0]===target&&c[1]==='down').length,1);
    assert.equal(f.calls.find(c=>c[0]===target&&c[1]==='down')[2].code,'KeyA');
    assert.equal(f.calls.filter(c=>c[0]===target&&c[1]==='up').length,1);
  }
  assert.deepEqual(f.router.status().held,[]);
});
test('unknown key is not delivered to either adapter',()=>{
  const f=enable(fixture());assert.deepEqual(f.router.keyDown({code:'Unidentified'}),{web:false,dos:false});assert.equal(f.calls.length,0);assert.equal(f.router.log.at(-1).type,'unsupportedKey');
});
test('held modifier is reflected in following key packet',()=>{
  const f=enable(fixture());f.router.keyDown({code:'ShiftLeft'});f.router.keyDown({code:'KeyA'});
  for(const target of ['web','dos']) assert.equal(f.calls.find(c=>c[0]===target&&c[1]==='down'&&c[2].code==='KeyA')[2].shiftKey,true);
  f.router.releaseAll('test');assert.deepEqual(f.router.status().held,[]);
});
test('duplicate nonrepeat down does not duplicate held transition',()=>{
  const f=enable(fixture());f.router.keyDown({code:'KeyA'});f.router.keyDown({code:'KeyA'});
  assert.equal(f.calls.filter(c=>c[0]==='dos'&&c[1]==='down').length,1);
  assert.equal(f.router.keyUp('KeyB'),false);
});
test('releaseAll releases both adapters and clears keyboard and mouse state',()=>{
  const f=enable(fixture());f.router.keyDown({code:'ControlLeft'});button(f.router,0,true);f.router.releaseAll('blur');
  assert.deepEqual(f.router.status().held,[]);assert.deepEqual(f.router.status().buttons,[]);
  assert.ok(f.calls.some(c=>c[0]==='web'&&c[1]==='release'));assert.ok(f.calls.some(c=>c[0]==='dos'&&c[1]==='release'));
});
test('mouse SDK retains logical units until adapter maps DOS coordinates',()=>{
  const f=enable(fixture());move(f.router,320,240);button(f.router,2,true);button(f.router,2,false);
  assert.deepEqual(f.calls.find(c=>c[0]==='dos'&&c[1]==='move'),['dos','move',320,240]);
  assert.deepEqual(f.calls.filter(c=>c[0]==='dos'&&c[1]==='button'),[['dos','button',2,true],['dos','button',2,false]]);
});
test('physical web mouse mirrors DOS once without synthetic web duplication',()=>{
  const f=enable(fixture());move(f.router,23,41,{webAlreadyHandled:true});button(f.router,0,true,{webAlreadyHandled:true});button(f.router,0,false,{webAlreadyHandled:true});
  assert.equal(f.calls.filter(c=>c[0]==='web'&&c[1]==='pointer').length,0);
  assert.equal(f.calls.filter(c=>c[0]==='dos'&&c[1]==='button').length,2);
});
test('unsupported mouse buttons rejected before dispatch',()=>{
  const f=enable(fixture());assert.throws(()=>button(f.router,1,true),RangeError);assert.equal(f.calls.length,0);
});
test('click SDK generates move/down/up in identical logical location',()=>{
  const f=enable(fixture());f.router.click(63,47);
  const d=f.calls.filter(c=>c[0]==='dos');assert.deepEqual(d.map(c=>c[1]),['move','button','button']);
  assert.deepEqual(f.router.status().buttons,[]);
});
test('pausing always clears held state and disarms',()=>{
  const f=enable(fixture());f.router.keyDown({code:'KeyA'});f.router.setEnabled(false);assert.equal(f.router.enabled,false);assert.deepEqual(f.router.status().held,[]);
});
test('log snapshots cannot mutate stored records',()=>{
  const f=enable(fixture());f.router.keyDown({code:'KeyA'});const a=f.router.log;a.at(-1).code='KeyZ';a.pop();assert.equal(f.router.log.at(-1).code,'KeyA');
});
test('log sequence IDs increase and timestamps come from injected clock',()=>{
  const f=enable(fixture());f.router.keyDown({code:'KeyA'});f.router.keyUp('KeyA');
  const log=f.router.log;assert.ok(log.every((e,i)=>!i||e.seq>log[i-1].seq));assert.ok(log.every((e,i)=>!i||e.at>log[i-1].at));
});

test('OS IME and Meta combinations explicitly refuse physical-packet forwarding',()=>{
  const f=enable(fixture());
  for(const extra of [{isComposing:true},{keyCode:229},{metaKey:true}]) assert.deepEqual(f.router.keyDown({code:'KeyA',...extra}),{web:false,dos:false});
  assert.equal(f.calls.length,0);
});
test('explicit CapsLock and repeat intent reach both adapters',()=>{
  const f=enable(fixture());f.router.keyDown({code:'KeyA',capsLock:true});f.router.keyDown({code:'KeyA',repeat:true,capsLock:true});
  for(const target of ['web','dos']) {
    const downs=f.calls.filter(c=>c[0]===target&&c[1]==='down');assert.equal(downs.length,2);assert.equal(downs[0][2].repeat,false);assert.equal(downs[1][2].repeat,true);assert.equal(downs[1][2].capsLock,true);
  }
});
test('adapter exceptions release both sides and pause bridge',()=>{
  const f=enable(fixture());f.dos.keyDown=()=>{throw new Error('transport gone');};
  assert.throws(()=>f.router.keyDown({code:'KeyA'}),/adapter failed/i);
  assert.equal(f.router.enabled,false);assert.deepEqual(f.router.status().held,[]);
  assert.ok(f.calls.some(c=>c[0]==='web'&&c[1]==='release'));assert.ok(f.calls.some(c=>c[0]==='dos'&&c[1]==='release'));
});
test('lost readiness after arm immediately pauses and clears state',()=>{
  const f=enable(fixture());f.router.keyDown({code:'KeyA'});f.dos.ready=false;assert.throws(()=>move(f.router,2,3),/ready/i);assert.equal(f.router.enabled,false);assert.deepEqual(f.router.status().held,[]);
});
test('release failures on one side do not prevent other side release',()=>{
  const f=enable(fixture());f.web.releaseAll=()=>{throw new Error('closed frame');};f.router.releaseAll();assert.ok(f.calls.some(c=>c[0]==='dos'&&c[1]==='release'));
});
test('onEvent observer exceptions cannot interrupt paired input transport',()=>{
  const calls=[];const adapter={ready:true,keyDown:()=>calls.push('down'),keyUp:()=>calls.push('up'),releaseAll:()=>{}};
  const r=createInputRouter({getWeb:()=>adapter,getDos:()=>adapter,onEvent:()=>{throw new Error('observer');}});
  r.setEnabled(true);r.keyDown('KeyA');r.keyUp('KeyA');assert.deepEqual(calls,['down','down','up','up']);
});
test('normal sequence invokes same public input path and releases at end',async()=>{
  const f=enable(fixture());const result=await f.router.sequence([{type:'keyDown',code:'KeyA'},{type:'keyUp',code:'KeyA'},{type:'click',x:20,y:30}],{delayMs:0});
  assert.equal(result.completed,3);assert.deepEqual(f.router.status().held,[]);assert.deepEqual(f.router.status().buttons,[]);assert.equal(f.router.status().running,false);
  assert.equal(f.calls.filter(c=>c[0]==='dos'&&c[1]==='down').length,1);
});
test('sequence rejects hidden-state setters and safely releases already held input',async()=>{
  const f=enable(fixture());await assert.rejects(f.router.sequence([{type:'keyDown',code:'KeyA'},{type:'setLevel',level:14}],{delayMs:0}),/Unknown input step/);assert.deepEqual(f.router.status().held,[]);assert.equal(f.router.status().running,false);
});
test('already aborted sequence sends no input and releases cleanly',async()=>{
  const f=enable(fixture());const controller=new AbortController();controller.abort();await assert.rejects(f.router.sequence([{type:'keyDown',code:'KeyA'}],{delayMs:0,signal:controller.signal}),/cancelled/i);assert.equal(f.calls.filter(c=>c[1]==='down').length,0);
});
test('cancelSequence interrupts between steps without transmitting later keys',async()=>{
  const calls=[];let wake;
  const adapter={ready:true,keyDown:p=>calls.push(p.code),keyUp:()=>{},releaseAll:()=>{}};
  const r=createInputRouter({getWeb:()=>adapter,getDos:()=>adapter,sleep:()=>new Promise(resolve=>{wake=resolve;})});r.setEnabled(true);
  const pending=r.sequence([{type:'keyDown',code:'KeyA'},{type:'keyDown',code:'KeyB'}],{delayMs:1});r.cancelSequence();wake();await assert.rejects(pending,/cancelled/i);assert.deepEqual(calls,['KeyA','KeyA']);assert.deepEqual(r.status().held,[]);
});
test('a second concurrent sequence is rejected without disturbing first held input',async()=>{
  const calls=[];let wake;
  const a={ready:true,keyDown:p=>calls.push(p.code),keyUp:()=>{},releaseAll:()=>{}};const r=createInputRouter({getWeb:()=>a,getDos:()=>a,sleep:()=>new Promise(resolve=>{wake=resolve;})});r.setEnabled(true);
  const pending=r.sequence([{type:'keyDown',code:'KeyA'}],{delayMs:1});await assert.rejects(r.sequence([]),/already running/);assert.deepEqual(r.status().held,['KeyA']);wake();await pending;assert.deepEqual(r.status().held,[]);
});
test('replay retains key/button order but does not suppress web due original native mouse flag',async()=>{
  const f=enable(fixture());await f.router.replay([{seq:1,at:1,type:'mouseMove',x:3,y:5,webAlreadyHandled:true},{seq:2,at:1,type:'mouseButton',button:0,pressed:true,webAlreadyHandled:true},{seq:3,at:1,type:'mouseButton',button:0,pressed:false,webAlreadyHandled:true}]);
  assert.equal(f.calls.filter(c=>c[0]==='web'&&c[1]==='pointer').length,3);assert.deepEqual(f.router.status().buttons,[]);
});
test('sequence/replay reject unbounded lengths and invalid delays or speed',async()=>{
  const f=enable(fixture());await assert.rejects(f.router.sequence(new Array(10001)));await assert.rejects(f.router.sequence([],{delayMs:Infinity}));await assert.rejects(f.router.sequence([{type:'wait',ms:60001}],{delayMs:0}));
  for(const speed of [0,-1,Infinity,101,NaN]) await assert.rejects(f.router.replay([],{speed}));
});
test('log retains bounded entries and defensive copies of result objects',()=>{
  const f=enable(fixture());for(let i=0;i<5010;i++){f.router.keyDown('KeyA');f.router.keyUp('KeyA');}
  assert.equal(f.router.log.length,5000);const log=f.router.log;log.at(-1).result.web='tamper';assert.equal(f.router.log.at(-1).result.web,true);f.router.clearLog();assert.equal(f.router.log.length,0);
});
