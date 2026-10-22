import { ORIGINAL_KEYBOARD_MAPS } from './original-keyboard-maps.js';
import { originalGlyphCode } from './original-metrics.js';
/** e5d8/dbed reverse lookup scans unshifted rows then shifted rows. Korean3
 * alone keeps scanning duplicate glyphs; other layouts use the first match. */
export const ORIGINAL_GUIDE_ROWS=Object.freeze(['1234567890-=\\','qwertyuiop[]',"asdfghjkl;'",'zxcvbnm,./','!@#$%^&*()_+|','QWERTYUIOP{}','ASDFGHJKL:"','ZXCVBNM<>?']);
const aliases={'2':'korean2','3':'korean3','3-no-shift':'korean3NoShift'};
export function originalKeyGuide(layout,glyph){
 const name=aliases[layout]||layout,map=ORIGINAL_KEYBOARD_MAPS[name]?.mapping,target=originalGlyphCode(glyph),matches=[],fingers=new Set();
 if(target===96||target===126){const shifted=target===126;return {matches:[{ascii:shifted?'~':'`',row:0,column:-1,shifted,finger:0}],fingers:shifted?[0,7]:[0]};}
 for(let row=0;row<ORIGINAL_GUIDE_ROWS.length;row++)for(let column=0;column<ORIGINAL_GUIDE_ROWS[row].length;column++){
  const ascii=ORIGINAL_GUIDE_ROWS[row][column],code=map?.[ascii]?.originalGlyphCode??ascii.charCodeAt(0);if(code!==target)continue;
  let home=Math.min(9,column);if(home===4)home=3;else if(home===5)home=6;
  const finger=home<4?home:home-2;fingers.add(finger);if(row>=4)fingers.add(column<5?7:0);
  matches.push({ascii,row:row%4,column,shifted:row>=4,finger});
  if(name!=='korean3')return {matches,fingers:[...fingers]};
 }
 return {matches,fingers:[...fingers]};
}
