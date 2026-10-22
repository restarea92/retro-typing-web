/** Physical ANSI TKL positions. Printed legends never become committed input. */
import { ORIGINAL_KEYBOARD_MAPS } from './original-keyboard-maps.js';
const keys=[];
const add=(code,label,x,y,w=1,extra={})=>keys.push(Object.freeze({code,label,x,y,w,h:1,...extra}));
add('Escape','Esc',0,0,1,{accent:true});
for(let n=1;n<=12;n++)add(`F${n}`,`F${n}`,1.75+(n-1)+Math.floor((n-1)/4)*.35,0);
['PrintScreen','ScrollLock','Pause'].forEach((c,i)=>add(c,['PrtSc','Scroll','Pause'][i],15.6+i,0));
const row=(y,items)=>{let x=0;for(const item of items){const [code,label,w=1,extra={}]=item;add(code,label,x,y,w,extra);x+=w;}};
row(1.55,[['Backquote','`',1,{shift:'~',ascii:'`'}],...Array.from('1234567890',(n,i)=>[`Digit${n}`,n,1,{ascii:n,shift:'!@#$%^&*()'[i]}]),['Minus','-',1,{ascii:'-',shift:'_'}],['Equal','=',1,{ascii:'=',shift:'+'}],['Backspace','Backspace',2]]);
row(2.55,[['Tab','Tab',1.5],...Array.from('QWERTYUIOP',n=>[`Key${n}`,n,1,{ascii:n.toLowerCase()}]),['BracketLeft','[',1,{ascii:'[',shift:'{'}],['BracketRight',']',1,{ascii:']',shift:'}'}],['Backslash','\\',1.5,{ascii:'\\',shift:'|'}]]);
row(3.55,[['CapsLock','Caps Lock',1.75],...Array.from('ASDFGHJKL',n=>[`Key${n}`,n,1,{ascii:n.toLowerCase()}]),['Semicolon',';',1,{ascii:';',shift:':'}],['Quote',"'",1,{ascii:"'",shift:'"'}],['Enter','Enter',2.25,{accent:true}]]);
row(4.55,[['ShiftLeft','Shift',2.25],...Array.from('ZXCVBNM',n=>[`Key${n}`,n,1,{ascii:n.toLowerCase()}]),['Comma',',',1,{ascii:',',shift:'<'}],['Period','.',1,{ascii:'.',shift:'>'}],['Slash','/',1,{ascii:'/',shift:'?'}],['ShiftRight','Shift',2.75]]);
row(5.55,[['ControlLeft','Ctrl',1.25],['MetaLeft','◆',1.25],['AltLeft','Alt',1.25],['Space','',6.25,{ascii:' '}],['AltRight','Alt',1.25],['MetaRight','◆',1.25],['ContextMenu','Menu',1.25],['ControlRight','Ctrl',1.25]]);
[['Insert','Home','PageUp'],['Delete','End','PageDown']].forEach((r,j)=>r.forEach((c,i)=>add(c,{PageUp:'PgUp',PageDown:'PgDn'}[c]||c,15.6+i,1.55+j)));
add('ArrowUp','↑',16.6,4.55);['ArrowLeft','ArrowDown','ArrowRight'].forEach((c,i)=>add(c,['←','↓','→'][i],15.6+i,5.55));
export const TKL_KEYS=Object.freeze(keys);
export const TKL_BY_CODE=new Map(TKL_KEYS.map(k=>[k.code,k]));
export const TKL_BOUNDS=Object.freeze({width:18.6,height:6.55});
export const isModifier=code=>/^(Shift|Control|Alt|Meta)(Left|Right)$/.test(code);
const aliases={'2':'korean2',ko2:'korean2','3':'korean3',ko3:'korean3','3-no-shift':'korean3NoShift',english:'us'};
const names={korean2:'한글 두벌식',korean3:'한글 세벌식',korean3NoShift:'한글 세벌식 · 순아래',us:'영문 QWERTY',dvorak:'영문 Dvorak',hiragana:'히라가나',katakana:'가타카나'};
export function normalizeKeyboardLayout(layout='korean2'){return aliases[layout]||layout||'korean2';}
export function keyboardLayoutName(layout){return names[normalizeKeyboardLayout(layout)]||String(layout);}
export function getKeyLegends(key,layout='korean2',modifiers={}){
 const normalized=normalizeKeyboardLayout(layout),mapping=ORIGINAL_KEYBOARD_MAPS[normalized]?.mapping;
 if(!key.ascii||key.code==='Space')return {primary:key.label,secondary:'',shifted:key.shift||''};
 const shifted=modifiers.shiftKey?(key.shift||key.ascii.toUpperCase()):key.ascii;
 const mapped=mapping?.[shifted]?.display??shifted;
 const mappedBase=mapping?.[key.ascii]?.display??key.ascii;
 // Keep the physical Latin/symbol identity, with the meaningful mapped output below.
 const secondary=normalized==='us'?'':(mapped===shifted&&mappedBase===key.ascii?'':mapped);
 return {primary:key.label,secondary,shifted:key.shift||''};
}
export function accessibleKeyLabel(key,layout,modifiers={}){
 const {secondary}=getKeyLegends(key,layout,modifiers);
 const names={Space:'Space, 공백',MetaLeft:'왼쪽 Meta',MetaRight:'오른쪽 Meta',ShiftLeft:'왼쪽 Shift',ShiftRight:'오른쪽 Shift',ControlLeft:'왼쪽 Ctrl',ControlRight:'오른쪽 Ctrl',AltLeft:'왼쪽 Alt',AltRight:'오른쪽 Alt',ArrowLeft:'왼쪽 화살표',ArrowRight:'오른쪽 화살표',ArrowUp:'위 화살표',ArrowDown:'아래 화살표'};
 return `${names[key.code]||key.label}${key.shift?`, Shift ${key.shift}`:''}${secondary?`, ${secondary}`:''}`;
}
