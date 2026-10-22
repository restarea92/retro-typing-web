import { originalKeyGuide } from './original-key-guide.js';
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
 return {layout,cells,rightShiftColumn:rows[3].length-1};
}
export function paintKeyGlyph(state,glyph,flags){
 const guide=originalKeyGuide(state.layout,glyph);
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
 // This is an ordered overlay, including over active or stippled home caps.
 if(flags&0x20)for(const id of ORIGINAL_HOME_CELLS)state.cells.get(id).homeRing=true;
 return guide;
}
export function initializeKeyPaint(state,pool,stage,wordWarmup,target){
 for(const physical of pool.physicalKeys)paintKeyGlyph(state,renderMappedKey(state.layout,physical),6);
 if(wordWarmup)paintKeyGlyph(state,target,stage>0?0x26:6);
 paintKeyGlyph(state,target,!wordWarmup&&stage>0?0x25:5);
 return state;
}
