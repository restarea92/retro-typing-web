import test, {resourceTestsEnabled} from '../qa/resource-test.mjs';
import assert from 'node:assert/strict';
const {parseHTML} = resourceTestsEnabled ? await import('linkedom') : {};
const {createKeyboardInteraction,createVirtualKeyboard} = resourceTestsEnabled ? await import('../virtual-keyboard-view.js') : {};
const {createKeyboardInputBridge} = resourceTestsEnabled ? await import('../keyboard-input-bridge.js') : {};
function fixture(){
 const previous={window:globalThis.window,document:globalThis.document};
 const {document,window}=parseHTML('<main><div id="surface"><textarea id="target"></textarea><button id="answer">Answer</button></div><div id="mount"></div></main>');
 globalThis.window=window;globalThis.document=document;
 const target=document.querySelector('#target'),answer=document.querySelector('#answer'),trace=[];let owner=target,clicks=0,view;
 target.setSelectionRange=(start,end=start)=>{target.selectionStart=start;target.selectionEnd=end;};target.setSelectionRange(0);answer.addEventListener('click',()=>clicks++);
 const bridge=createKeyboardInputBridge({document,surface:document.querySelector('#surface'),getOwner:()=>owner,onKeyState:(code,down)=>view?.setPressed(code,down),onModifiers:m=>view?.setModifiers(m)});
 view=createVirtualKeyboard(document.querySelector('#mount'),{onKeyDown:p=>{trace.push(['down',{...p}]);bridge.keyDown(p);},onKeyUp:p=>{trace.push(['up',{...p}]);bridge.keyUp(p);},onReleaseAll:()=>{trace.push(['cancel']);bridge.releaseAll();}});
 const key=code=>document.querySelector(`[data-virtual-key="${code}"]`),rail=document.querySelector('.vk-pan-rail'),scroll=document.querySelector('.vk-scroll');
 for(const el of [rail,...document.querySelectorAll('[data-virtual-key]')]){const ids=new Set();el.setPointerCapture=id=>ids.add(id);el.hasPointerCapture=id=>ids.has(id);el.releasePointerCapture=id=>ids.delete(id);}
 Object.defineProperties(scroll,{clientWidth:{value:364},scrollWidth:{value:1080}});scroll.scrollLeft=0;scroll.scrollBy=({left})=>{scroll.scrollLeft=Math.max(0,Math.min(716,scroll.scrollLeft+left));};Object.defineProperty(rail,'clientWidth',{value:250});
 const event=(el,type,fields={})=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{button:0,pointerType:'touch',pointerId:1,clientX:150,...fields});el.dispatchEvent(e);return e;};
 const down=(code,id=1)=>event(key(code),'pointerdown',{pointerId:id}),up=(code,id=1)=>event(key(code),'pointerup',{pointerId:id}),tap=(code,id=1)=>{down(code,id);up(code,id);};
 const pan=()=>{event(rail,'pointerdown',{pointerId:99,clientX:200});event(rail,'pointermove',{pointerId:99,clientX:120});event(rail,'pointerup',{pointerId:99,clientX:120});};
 return {document,window,target,answer,view,bridge,key,rail,scroll,trace,event,down,up,tap,pan,setOwner:v=>owner=v,get clicks(){return clicks;},cleanup(){view.destroy();bridge.destroy();globalThis.window=previous.window;globalThis.document=previous.document;}};
}
test('DOM Shift tap → rail drag → Digit7 preserves exactly one shifted symbol',()=>{const h=fixture();try{h.tap('ShiftLeft');assert.equal(h.view.state.oneShotShift,true);const downBefore=h.trace.filter(e=>e[0]==='down').length;h.pan();assert(h.scroll.scrollLeft>0);assert.equal(h.trace.filter(e=>e[0]==='down').length,downBefore,'pan never invents a synthetic Shift or other keydown');h.tap('Digit7',2);assert.equal(h.target.value,'&');assert.equal(h.view.state.oneShotShift,false);h.tap('Digit7',3);assert.equal(h.target.value,'&7');assert.deepEqual(h.bridge.pressedCodes,[]);}finally{h.cleanup();}});
test('DOM physically held Shift is cancelled by pan without becoming latched',()=>{const h=fixture();try{h.down('ShiftLeft');h.pan();assert.equal(h.view.state.shiftKey,false);assert.equal(h.view.state.oneShotShift,false);assert.equal(h.view.state.pressed.size,0);h.up('ShiftLeft');h.tap('Digit7',2);assert.equal(h.target.value,'7');assert.deepEqual(h.bridge.pressedCodes,[]);}finally{h.cleanup();}});
test('DOM pan cancels a consumed latch and held key, rather than restoring that latch',()=>{const h=fixture();try{h.tap('ShiftLeft');h.down('Digit7',2);assert.equal(h.target.value,'&');h.pan();h.up('Digit7',2);assert.equal(h.view.state.oneShotShift,false);h.tap('Digit7',3);assert.equal(h.target.value,'&7');assert.deepEqual(h.bridge.pressedCodes,[]);}finally{h.cleanup();}});
test('DOM pan cancels held Space without activating its selected button, with or without consumed Shift',()=>{for(const shifted of [false,true]){const h=fixture();try{h.setOwner(h.answer);if(shifted)h.tap('ShiftLeft');const releases=[];h.answer.addEventListener('keyup',e=>{if(e.code==='Space')releases.push(e.keyboardBridgeCancelled);});h.down('Space',2);h.pan();h.up('Space',2);assert.equal(h.clicks,0);assert.deepEqual(releases,[true]);assert.deepEqual(h.bridge.pressedCodes,[]);assert.equal(h.view.state.oneShotShift,false);assert.equal(h.trace.find(e=>e[0]==='up'&&e[1].code==='Space')[1].cancelled,true);}finally{h.cleanup();}}});
test('DOM pending latch yields the same shifted symbol through rail and arrow panning',()=>{const outputs=[];for(const method of ['rail','left','right','keyboard']){const h=fixture();try{h.tap('ShiftLeft');if(method==='rail')h.pan();else if(method==='keyboard')h.event(h.rail,'keydown',{key:'ArrowRight'});else{h.scroll.scrollLeft=360;h.event(h.document.querySelector('.vk-pan-'+method),'click',{detail:1});}h.tap('Digit7',2);outputs.push(h.target.value);assert.equal(h.view.state.oneShotShift,false);}finally{h.cleanup();}}assert.deepEqual(outputs,['&','&','&','&']);});
test('DOM hide, blur, key pointercancel and lost capture still clear a pending latch after pan',()=>{for(const reason of ['hide','blur','pointercancel','lostpointercapture']){const h=fixture();try{h.tap('ShiftLeft');h.pan();assert.equal(h.view.state.oneShotShift,true);if(reason==='hide'){h.view.setVisible(false);h.view.setVisible(true);}else if(reason==='blur')h.window.dispatchEvent(new h.window.Event('blur'));else if(reason==='pointercancel')h.event(h.key('ShiftLeft'),'pointercancel',{pointerId:77});else{h.down('ControlLeft',77);h.event(h.key('ControlLeft'),'lostpointercapture',{pointerId:77});}assert.equal(h.view.state.oneShotShift,false,reason);h.tap('Digit7',3);assert.equal(h.target.value,'7',reason);}finally{h.cleanup();}}});
test('model pan preserves only pending Shift while cancelling other held modifiers and duplicate owners',()=>{const trace=[];const m=createKeyboardInteraction({onKeyDown:p=>trace.push(['down',p]),onKeyUp:p=>trace.push(['up',p]),onReleaseAll:()=>trace.push(['cancel'])});m.down(1,'ShiftLeft');m.up(1);m.down(2,'ControlLeft');m.down(3,'ControlLeft');m.down(4,'AltRight');m.down(5,'MetaLeft');m.cancelHeldKeys({preserveUnconsumedShiftLatch:true});assert.equal(m.state.oneShotShift,true);assert.equal(m.state.ctrlKey,false);assert.equal(m.state.altKey,false);assert.equal(m.state.metaKey,false);assert.equal(m.state.pressed.size,0);assert.equal(m.state.owners.size,0);assert.equal(trace.filter(e=>e[0]==='up'&&e[1].code==='ControlLeft').length,1);assert(trace.findIndex(e=>e[0]==='cancel')<trace.findIndex(e=>e[0]==='up'&&e[1].code==='ControlLeft'));m.up(2);m.up(3);m.down(6,'Digit7');assert.equal(trace.at(-1)[1].shiftKey,true);m.up(6);assert.equal(m.state.oneShotShift,false);});
test('model releaseAll and ordinary cancellation defaults never preserve a pending latch',()=>{for(const clear of [m=>m.releaseAll(),m=>m.cancelHeldKeys()]){const m=createKeyboardInteraction();m.down(1,'ShiftLeft');m.up(1);clear(m);assert.equal(m.state.oneShotShift,false);assert.equal(m.state.shiftKey,false);}});

test('DOM cancelled rail drag or unexpected rail capture loss clears the preserved latch',()=>{
 for(const reason of ['pointercancel','lostpointercapture']){
  const h=fixture();try{
   h.tap('ShiftLeft');h.event(h.rail,'pointerdown',{pointerId:99});
   assert.equal(h.view.state.oneShotShift,true);
   h.event(h.rail,reason,{pointerId:99});
   assert.equal(h.view.state.oneShotShift,false,reason);
   h.tap('Digit7',2);assert.equal(h.target.value,'7');
  }finally{h.cleanup();}
 }
});
test('DOM normal rail capture loss after pointerup does not cancel the preserved latch',()=>{
 const h=fixture();try{
  h.tap('ShiftLeft');h.pan();h.event(h.rail,'lostpointercapture',{pointerId:99});
  assert.equal(h.view.state.oneShotShift,true);h.tap('Digit7',2);assert.equal(h.target.value,'&');
 }finally{h.cleanup();}
});
test('DOM both pan arrows and keyboard rail navigation cancel held Space safely',()=>{
 for(const method of ['left','right','keyboard']){
  const h=fixture();try{
   h.setOwner(h.answer);h.tap('ShiftLeft');h.down('Space',2);
   if(method==='keyboard')h.event(h.rail,'keydown',{key:'ArrowRight'});
   else{h.scroll.scrollLeft=360;h.event(h.document.querySelector('.vk-pan-'+method),'click',{detail:1});}
   h.up('Space',2);assert.equal(h.clicks,0,method);assert.deepEqual(h.bridge.pressedCodes,[]);
   assert.equal(h.view.state.oneShotShift,false,method);
   const up=h.trace.find(e=>e[0]==='up'&&e[1].code==='Space');assert.equal(up[1].cancelled,true);
  }finally{h.cleanup();}
 }
});
test('model pan cancellation never restores a latch cleared by a reentrant releaseAll',()=>{
 let m,cancellations=0;
 m=createKeyboardInteraction({onReleaseAll:()=>{if(++cancellations===1)m.releaseAll();}});
 m.down(1,'ShiftLeft');m.up(1);m.cancelHeldKeys({preserveUnconsumedShiftLatch:true});
 assert.equal(m.state.oneShotShift,false);assert.equal(m.state.pressed.size,0);assert.equal(m.state.owners.size,0);
});
test('model pan preserves Caps Lock independently of pending or consumed Shift',()=>{
 for(const consumed of [false,true]){
  const m=createKeyboardInteraction();m.down(1,'CapsLock');m.up(1);m.down(2,'ShiftLeft');m.up(2);
  if(consumed)m.down(3,'Digit7');m.cancelHeldKeys({preserveUnconsumedShiftLatch:true});
  assert.equal(m.state.capsLock,true);assert.equal(m.state.oneShotShift,!consumed);
 }
});
test('model event trace preserves pending Shift across repeated pan without synthetic held Shift',()=>{
 const trace=[];
 const m=createKeyboardInteraction({onKeyDown:p=>trace.push(['down',p.code,p.shiftKey]),onKeyUp:p=>trace.push(['up',p.code,p.shiftKey,p.cancelled===true]),onReleaseAll:()=>trace.push(['cancel'])});
 m.down(1,'ShiftLeft');m.up(1);
 m.cancelHeldKeys({preserveUnconsumedShiftLatch:true});m.cancelHeldKeys({preserveUnconsumedShiftLatch:true});
 assert.equal(m.state.oneShotShift,true);assert.equal(m.state.owners.size,0);
 m.down(2,'Digit7');m.up(2);m.down(3,'Digit7');m.up(3);
 assert.deepEqual(trace,[['down','ShiftLeft',true],['up','ShiftLeft',true,false],['cancel'],['cancel'],['down','Digit7',true],['up','Digit7',false,false],['down','Digit7',false],['up','Digit7',false,false]]);
});
