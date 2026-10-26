/** Original GetMouseKey emits one left-button event at release; the caller
 * hit-tests the release position, not the element where the press began.
 * Keep keyboard/assistive .click() (detail=0) and non-mouse pointers untouched.
 */
export function installOriginalMouseRelease(frame,{document=frame?.ownerDocument}={}){
 if(!frame||!document?.defaultView)throw new TypeError('A connected program frame is required.');
 const win=document.defaultView;let held=false,suppressClick=false;
 const mouse=e=>!e.pointerType||e.pointerType==='mouse';
 const inside=e=>Boolean(e.target&&frame.contains(e.target));
 const down=e=>{suppressClick=false;if(!mouse(e)||e.button!==0)return;held=inside(e);};
 const clear=()=>{held=false;suppressClick=false;};
 const cancel=()=>{if(held)suppressClick=true;held=false;};
 const up=e=>{
  if(!mouse(e)||e.button!==0)return;
  const accepted=held&&inside(e);held=false;if(!accepted)return;
  suppressClick=true;
  if(e.target.closest?.('[inert],button:disabled,input:disabled,select:disabled,textarea:disabled'))return;
  const fields={bubbles:true,cancelable:true,composed:true,detail:1,button:0,buttons:0,clientX:e.clientX,clientY:e.clientY,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey};
  let click;if(typeof win.MouseEvent==='function')click=new win.MouseEvent('click',fields);
  else{click=new win.Event('click',{bubbles:true,cancelable:true});for(const [key,value]of Object.entries(fields))if(!['bubbles','cancelable','composed'].includes(key))Object.defineProperty(click,key,{value});}
  Object.defineProperty(click,'originalMouseRelease',{value:true});e.target.dispatchEvent(click);
 };
 const click=e=>{if(e.originalMouseRelease)return;if(suppressClick&&e.detail>0){suppressClick=false;e.preventDefault();e.stopImmediatePropagation();}};
 win.addEventListener('pointerdown',down,true);win.addEventListener('pointerup',up);win.addEventListener('click',click,true);
 win.addEventListener('pointercancel',clear);win.addEventListener('blur',clear);
 return {cancel,destroy(){clear();win.removeEventListener('pointerdown',down,true);win.removeEventListener('pointerup',up);win.removeEventListener('click',click,true);win.removeEventListener('pointercancel',clear);win.removeEventListener('blur',clear);}};
}
