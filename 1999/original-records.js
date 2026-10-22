/** Source-derived HTTD.exe history11b72, gameInsert14e94, examInsert12ef8.
 * This is a literal port, including history's increasing per-slot time threshold.
 * Dates are explicit YYYY-MM-DD strings supplied by the caller, never UTC guesses.
 */
const u16=n=>Math.trunc(n)&65535, i16=n=>(u16(n)<<16)>>16, f32=Math.fround;
export const ORIGINAL_HISTORY_SLOTS=360;
const empty=()=>({weight:0,speed:0,accuracy:0,seconds:0,date:null});
export function createOriginalHistory(){return {index:0,slots:Array.from({length:360},empty)};}
/** Profile-load19cec: when requested, a different nonzero current-slot date
 * advances once if space remains. It does not clear or copy the next slot. */
export function originalHistoryOpen(state,today,{advanceDate=true}={}){
 const slot=state.slots[state.index];
 if(advanceDate&&state.index+1<360&&slot.date&&slot.date!==today)state.index++;
 state.slots[state.index].date=today; return state;
}
/** Add a native reporting sample. Word/short: each completed line; long: each
 * completed page; exam: final result and explicit PgUp/PgDn intermediate report.
 * Caller must supply each report's native totals, not a whole-exercise substitute.
 * An original divide-by-zero overflow is safely reported, not emulated as a crash.
 */
export function addOriginalHistorySample(state,{weight,speed,accuracy,seconds,date}){
 const slot=state.slots[state.index],w=u16(weight),s=i16(speed),a=i16(accuracy),t=f32(seconds);
 if(!slot.weight&&!slot.speed&&!slot.accuracy){
  slot.weight=w;slot.speed=s;slot.accuracy=a;slot.seconds=f32(u16(t));
 }else{
  const old=u16(slot.weight),total=u16(old+w);
  slot.weight=total;
  if(total){
   slot.speed=i16(Math.trunc(((Math.imul(old,i16(slot.speed))+Math.imul(w,s))|0)/total));
   slot.accuracy=i16(Math.trunc(((Math.imul(old,i16(slot.accuracy))+Math.imul(w,a))|0)/total));
  }else state.nativeUndefined='history weighted denominator wrapped to zero';
  slot.seconds=f32(f32(slot.seconds)+t);
 }
 if(Math.trunc(f32(slot.seconds/60))>(state.index+1)*5){
  state.index++;
  if(state.index>=360){
   for(let i=1;i<360;i++)state.slots[i-1]={...state.slots[i]};
   // Original leaves slot359 unchanged after shifting, duplicating its values.
   state.index=359;
  }
 }
 state.slots[state.index].date=date; return state;
}
export function originalHistoryHeight(speed){
 speed=i16(speed);if(speed<=0)return 0;if(speed>=500)return 200;
 return Math.min(200,2*(Math.trunc(speed/100)*20+Math.trunc((speed%100)*0.2)));
}
/** One global top10, no layout/game filter. Scores may be displayed x10 but all
 * input records must use the same scale. Exact ties keep earlier entries first. */
export function insertOriginalGameScore(records,record){
 const out=records.slice(0,10),score=Number(record.score),stage=Number(record.stage);
 let index=out.findIndex(r=>Number(r.score)<score||(Number(r.score)===score&&Number(r.stage)<stage));
 if(index<0)index=out.length;
 if(index<10)out.splice(index,0,{...record});
 return {records:out.slice(0,10),inserted:index<10,index:index<10?index:-1};
}
const examSpeed=r=>r&&r.effectiveUnits&&r.seconds?i16(Math.trunc(u16(r.effectiveUnits)*60/f32(r.seconds))):0;
/** State {top:null|record,recent:[newest,...]}; no language partition. Final
 * result inserts immediately, irrespective of whether its modal is later Esc'd. */
export function insertOriginalExamRecord(state,record){
 const incoming={...record,seconds:f32(record.seconds)},old=state.top;
 const speed=examSpeed(incoming),oldSpeed=examSpeed(old);
 const better=speed>oldSpeed||(speed===oldSpeed&&u16(incoming.effectiveUnits)>u16(old?.effectiveUnits||0));
 return {top:better?incoming:old,recent:[incoming,...state.recent].slice(0,10)};
}
export function originalRecordDate(date){
 const parts=typeof date==='string'?date.split('-').map(Number):[date.year,date.month,date.day];
 return `${String(parts[0]).padStart(4,' ')}.${String(parts[1]).padStart(2,'0')}.${String(parts[2]).padStart(2,'0')}`;
}
/** Literal graph19028 geometry. yBase is the zero-speed baseline (native top+240).
 * Later pages deliberately preserve its offset/upper-bound bug, not a clean slice.
 * Date scratch text is uninitialized on original entry; default '' is a declared
 * deterministic web adaptation. Pass previousDateText to investigate that edge.
 * Rendering must clip to the original graph viewport, not rescale these points.
 */
export function originalHistoryPoints(state,page,{yBase=342,previousDateText=''}={}){
 const offset=Math.max(0,Math.min(5,Math.trunc(page)))*60,index=state.index;
 const height=i=>originalHistoryHeight(state.slots[i]?.speed||0);
 let x=offset===0?59+(index+1)*9:52+(index-offset+1)*9;
 const anchor={x:offset===0?52:x,y:yBase-(offset===0?0:height(offset))};
 const annotations=[];let previous=previousDateText;
 for(let i=index-offset;i>=offset;i--){
  const date=state.slots[i]?.date,parts=date?date.split('-').map(Number):[0,0,0];
  const label=`${parts[1]}/${parts[2]}`;
  if(label!==previous)annotations.push({index:i,x:(Math.trunc(x/8)-1)*8,y:yBase-height(i)-8,text:label});
  previous=label;x-=9;
 }
 const points=[];
 for(let i=offset;i<=index-offset;i++,x+=9)points.push({index:i,x,y:yBase-height(i),date:state.slots[i]?.date||null,speed:state.slots[i]?.speed||0});
 return {anchor,points,annotations,offset,yBase};
}
/** Exam progression-only legacy bug at138cf..1390c. Visible result instead
 * clamps max(C-W,0). Penalty is forced1 by the reachable original application. */
export function originalExamProgressionNumerator(correctUnits,wrongGlyphs){
 const c=u16(correctUnits),w=u16(wrongGlyphs);return c?(c>w?c-w:w):0;
}
