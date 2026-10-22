import { originalKeyGuide, ORIGINAL_GUIDE_ROWS } from './original-key-guide.js';
import { ORIGINAL_KEYBOARD_MAPS } from './original-keyboard-maps.js';
import { renderMappedKey } from './input-composer.js';

/** Native _drawKeybord paint state, not a current-target-only highlight model.
 * 1999 e5d8..ede1 /1997 e997..f1a0: ordinary cap paints clear their ring;
 * stipple preserves local(0,30), and flags0x20 subsequently redraw all home rings.
 * The source's normal/stipple/active glyph origins are (+8,+7/+8/+10).
 */
export const ORIGINAL_HOME_CELLS=Object.freeze([1,2,3,4,7,8,9,10].map(column=>`2:${column}`));
export function createKeyPaintState(layout,rows){
 const cells=new Map();
 rows.forEach((row,r)=>row.forEach((physical,column)=>cells.set(`${r}:${column}`,{
  row:r,column,physical,ordinary:physical.length===1&&physical!==' ',
  label:physical.length===1?renderMappedKey(layout,physical):physical,
  paint:'normal',cornerGray:false,homeRing:false,
 })));
 return {layout,cells,fingers:new Set(),rightShiftColumn:rows[3].length-1};
}
export function paintKeyGlyph(state,glyph,flags){
 const guide=originalKeyGuide(state.layout,glyph);
 return paintGuide(state,glyph,guide,flags);
}
function paintGuide(state,glyph,guide,flags){
 // Source ed24 decrements the collected-match count; Korean3 can have duplicates.
 for(const match of [...guide.matches].reverse()){
  const cell=state.cells.get(`${match.row}:${match.column+1}`);
  if(cell?.ordinary){
   cell.label=glyph;cell.homeRing=false;
   cell.paint=flags&1?'active':flags&2?'stipple':'normal';
   if(cell.paint!=='stipple')cell.cornerGray=cell.paint==='active';
  }
  if(match.shifted){
   const shift=state.cells.get(`3:${match.column<5?state.rightShiftColumn:0}`);
   shift.paint=flags&1?'active':'normal';
  }
 }
 // ec84..ed11 writes only the matched fingers; it never clears the whole row.
 if(flags&4)for(const finger of guide.fingers){if(flags&1)state.fingers.add(finger);else state.fingers.delete(finger);}
 // This is an ordered overlay, including over active or stippled home caps.
 if(flags&0x20)for(const id of ORIGINAL_HOME_CELLS)state.cells.get(id).homeRing=true;
 return guide;
}

/** f317 reads one slot past the ten-target row before f322 checks its end.
 * That slot is the initialized last-input DOS minute*60+second, not arbitrary
 * memory. dbed reduces it to a raw lookup byte, but the four whole-word
 * special cases in e6a1..e771 precede that reduction. ANK captions are 8px.
 */
export function warmupClockGuide(layout,clockWord){
 const word=Number(clockWord)&0xffff;
 if(word===8||word===32)return {specialCell:word===8?'0:14':'4:2',label:word===8?'BS':'',matches:[],fingers:[]};
 const label=String.fromCodePoint(0xf2000+(word&255));
 if(word===96||word===126){const shifted=word===126;return {label,matches:[{row:0,column:-1,shifted}],fingers:shifted?[-1,7]:[-1]};}
 const name=({'2':'korean2','3':'korean3','3-no-shift':'korean3NoShift'})[layout]||layout;
 const map=ORIGINAL_KEYBOARD_MAPS[name]?.mapping,matches=[],fingers=new Set(),byte=word&255;
 for(let row=0;row<ORIGINAL_GUIDE_ROWS.length;row++)for(let column=0;column<ORIGINAL_GUIDE_ROWS[row].length;column++){
  const ascii=ORIGINAL_GUIDE_ROWS[row][column];if((map?.[ascii]?.rawCode??ascii.charCodeAt(0))!==byte)continue;
  let home=Math.min(9,column);if(home===4)home=3;else if(home===5)home=6;
  const finger=home<4?home:home-2;fingers.add(finger);if(row>=4)fingers.add(column<5?7:0);
  matches.push({ascii,row:row%4,column,shifted:row>=4,finger});
  if(name!=='korean3')return {label,matches,fingers:[...fingers]};
 }
 return {label,matches,fingers:[...fingers]};
}
export function paintWarmupClockCue(state,clockWord){
 const guide=warmupClockGuide(state.layout,clockWord);
 if(guide.specialCell){const cell=state.cells.get(guide.specialCell);cell.paint='active';cell.label=guide.label;return guide;}
 return paintGuide(state,guide.label,guide,5);
}
export function initializeKeyPaint(state,pool,stage,wordWarmup,target){
 for(const physical of pool.physicalKeys)paintKeyGlyph(state,renderMappedKey(state.layout,physical),6);
 if(wordWarmup)paintKeyGlyph(state,target,stage>0?0x26:6);
 paintKeyGlyph(state,target,!wordWarmup&&stage>0?0x25:5);
 return state;
}
