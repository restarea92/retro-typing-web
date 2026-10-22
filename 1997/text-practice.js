import {originalGlyphCode,originalKeyUnits,originalTextUnits,originalElapsedTicks} from './original-metrics.js';
export const glyphColumns=character=>character.codePointAt(0)<128?1:2;
/** CompareStr's cursor follows target byte cells, not Unicode character indices.
 * An ASCII error on a double-byte target occupies that whole target cell. A
 * double-byte input crossing into the middle of another target aligns to its end. */
export function analyzePracticeInput(target,typed,layout='2'){
 const targets=Array.from(target.normalize('NFC'));let position=0;
 const cells=targets.map(character=>{const start=position;position+=glyphColumns(character);return {character,start,end:position,units:originalKeyUnits(character,layout)??1};});
 const bytes=cells.flatMap(cell=>{const code=originalGlyphCode(cell.character);return code===null?[null,null]:cell.end-cell.start===1?[code]:[code>>>8,code&255];});
 const totalColumns=position;let cursor=0,targetIndex=0,correctUnits=0,processedUnits=0;const entries=[],overflow=[];
 for(const character of Array.from(typed.normalize('NFC'))){
  if(cursor>=totalColumns){overflow.push(character);continue;}
  const first=cells[targetIndex],start=cursor;let endpoint=cursor+glyphColumns(character);
  if(glyphColumns(character)===1&&first.end-first.start===2)endpoint=first.end;
  const matching=originalGlyphCode(character)!==null&&originalGlyphCode(character)===originalGlyphCode(first.character);
  if(matching)correctUnits+=first.units;
  while(targetIndex<cells.length&&cells[targetIndex].start<endpoint){processedUnits+=cells[targetIndex].units;cursor=cells[targetIndex].end;targetIndex++;}
  const rawFirst=bytes[start],rawSecond=bytes[start+1]??0,targetCode=rawFirst===null?null:glyphColumns(character)===1?rawFirst:(rawFirst<<8)|rawSecond;
  entries.push({character,start,end:cursor,columns:cursor-start,correct:matching,targetCode,targetGlyph:first.character});
 }
 return {entries,acceptedText:entries.map(e=>e.character).join(''),overflow:overflow.join(''),complete:cursor>=totalColumns,consumedColumns:cursor,totalColumns,correctUnits,processedUnits,targetUnits:originalTextUnits(target,layout)??cells.reduce((n,c)=>n+c.units,0)};
}

/** Original reader takes73 bytes, but lets a double-byte glyph cross byte72. */
export function wrapOriginalLongText(text){
 const lines=String(text).replace(/\r\n?/g,'\n').replace(/\u001a/g,'').split('\n');if(lines.at(-1)==='')lines.pop();
 return lines.flatMap(line=>{const rows=[];let row='',columns=0;for(const c of line){if(columns>=73){rows.push(row);row='';columns=0;}row+=c;columns+=glyphColumns(c);}rows.push(row);return rows;});
}


/** Native per-glyph timing follows ACCEPTED output, not every composing stroke.
 * Backspace removes records but deliberately leaves lastAcceptedAt unchanged.
 * Multiple mobile glyphs reported together share their observable timestamp;
 * no fictional per-keystroke timing is interpolated. */
export function createPracticeTiming(startedAt=null){return {startedAt,lastAcceptedAt:null,records:[]};}
export function updatePracticeTiming(timing,analysis,committed,now){
 const accepted=analysis.entries.slice(0,Array.from(committed).length);
 let common=0;while(common<accepted.length&&common<timing.records.length){const a=accepted[common],b=timing.records[common];if(a.character!==b.character||a.start!==b.start||a.end!==b.end)break;common++;}
 timing.records.length=common;
 for(const entry of accepted.slice(common)){
  const elapsedTicks=originalElapsedTicks(timing.lastAcceptedAt??timing.startedAt??now,now);
  timing.records.push({...entry,elapsedTicks});timing.lastAcceptedAt=now;
 }
 return timing.records;
}

/** CompareStr-specific acceptance. Plain composers intentionally do not know
 * the target; callers commit an UPDATED matching pending glyph at status3.
 * New pending status2 remains editable, even when its first jamo matches. */
export function acceptPracticeInput({result,analysis,controller,timing,startedAt,now}){
 timing.startedAt??=startedAt??now;
 const pendingIndex=Array.from(result.committed||'').length;
 if(result.compositionStatus===3&&result.composing&&analysis.entries[pendingIndex]?.correct)controller.commit();
 const previous=new Set(timing.records);
 updatePracticeTiming(timing,analysis,controller.state.committed,now);
 const newlyAccepted=timing.records.filter(record=>!previous.has(record));
 return {records:timing.records,newlyAccepted,acceptedComplete:(timing.records.at(-1)?.end||0)>=analysis.totalColumns};
}
