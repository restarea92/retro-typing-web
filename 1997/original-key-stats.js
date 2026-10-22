/** HTTD.exe per-target glyph statistics, write_kdata11048 / convert_tong_data10eeb.
 * Source-backed, not physical-key statistics. Commit only completed practice
 * short lines, full40-line word blocks, or completed long/test pages, at
 * the caller's native save boundary.
 */
import {originalGlyphCode} from './original-metrics.js';
const L=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const V=[...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const T=[...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
export function originalStatIdentity(group,index){
 const language=['en','ja','ko'][group];
 let role='literal',glyph='';
 if(group===0)glyph=String.fromCharCode(index+33);
 else if(group===1){role='kana';const low=index>83?index+13:index;glyph=String.fromCodePoint(0x3040+low);}
 else if(index<19){role='initial';glyph=L[index]||'';}else if(index<40){role='vowel';glyph=V[index-19]||'';}else{role='final';glyph=T[index-40]||'';}
 return {key:`${language}:${index}`,group,language,index,role,glyph};
}
/** Numeric input is a packed original glyph code. String input is Unicode or
 * a raw-glyph private-use alias. Space/control characters have no chart entry. */
export function originalStatComponents(codeOrCharacter){
 const c=typeof codeOrCharacter==='number'?codeOrCharacter:originalGlyphCode(codeOrCharacter);
 if(c===null||c===0)return [];
 if(c&0x8000){
  const out=[];let l=((c>>>10)&31)-1,v=((c>>>5)&31)-2,t=(c&31)-1;
  if(l)out.push(originalStatIdentity(2,l-1));
  if(v){v-=v>23?6:v>15?4:v>7?2:0;out.push(originalStatIdentity(2,v+18));}
  if(t){if(t>17)t--;out.push(originalStatIdentity(2,t+39));}
  return out;
 }
 if(c&0x1f00){let i=c&255;if(i>96)i-=13;return i<167?[originalStatIdentity(1,i)]:[];}
 return c>32&&c<127?[originalStatIdentity(0,c-33)]:[];
}
/** Adds one ACCEPTED TARGET glyph's final record. The timing is the interval
 * since the previous accepted glyph (BIOS ticks), not the whole-line duration.
 * On wrong input, pass the original TARGET glyph, never the typed replacement.
 * All Hangul roles inherit whole-glyph correctness. dt is divided as an integer
 * by the number of nonempty roles, then seconds accumulate in float32 using
 * 18.2 exactly, deliberately different from the result-pane BIOS conversion.
 * Mutates and returns the supplied plain-object accumulator. */
export function addOriginalGlyphStat(stats,codeOrCharacter,correct,elapsedTicks=0){
 const parts=originalStatComponents(codeOrCharacter);
 const ticks=parts.length?Math.trunc(Math.max(0,elapsedTicks)/parts.length):0;
 for(const p of parts){const s=stats[p.key]||(stats[p.key]={...p,correct:0,wrong:0,seconds:0});s[correct?'correct':'wrong']=(s[correct?'correct':'wrong']+1)&65535;if(ticks)s.seconds=Math.fround(s.seconds+ticks/18.2);}
 return stats;
}
/** Records must already reflect native byte alignment and Backspace rollback.
 * Records: {targetCode OR targetGlyph, correct, elapsedTicks}. This routine does
 * not infer physical timing or pad it from an aggregate elapsed duration. */
export function originalLineKeyStats(records,stats={}){for(const r of records)addOriginalGlyphStat(stats,r.targetCode??r.targetGlyph,r.correct,r.elapsedTicks);return stats;}
/** Merge saved chronological line/page aggregates. For bit-for-bit float32
 * addition, pass individual glyph records to one accumulator instead. */
export function mergeOriginalKeyStats(into,from){for(const [key,s] of Object.entries(from||{})){const d=into[key]||(into[key]={...s,correct:0,wrong:0,seconds:0});d.correct=(d.correct+s.correct)&65535;d.wrong=(d.wrong+s.wrong)&65535;d.seconds=Math.fround(d.seconds+s.seconds);}return into;}
export function originalKeyStatMetrics(s){const c=s?.correct||0,w=s?.wrong||0,sec=s?.seconds||0;return {correct:c,wrong:w,seconds:sec,speed:c&&sec?Math.trunc(c*60/sec):0,accuracy:c?Math.trunc(c*100/((c+w)&65535)):0};}
/** Mean_K_Data1a493. A previous record is a stored float speed and integer
 * accuracy. No current attempts leaves it unchanged. Nonempty old and current
 * records are averaged equally, not weighted by attempts. Call on app exit,
 * not after every exercise; current arrays reset on a fresh native launch. */
export function originalSavedKeyMean(previous,current){
 const old=previous||{speed:0,accuracy:0};if(!current||!(current.correct+current.wrong))return {...old};
 const m=current.correct&&current.seconds?originalKeyStatMetrics(current):{speed:0,accuracy:0};const speed=m.speed;
 if(!old.speed&&!old.accuracy)return {speed,accuracy:m.accuracy};
 return {speed:Math.fround((old.speed+speed)/2),accuracy:Math.trunc((old.accuracy+m.accuracy)/2)};
}

import {ORIGINAL_FINGER_TABLES as F} from './original-finger-tables.js';
const LAYOUT_ALIASES={'2':'korean2',ko2:'korean2','3':'korean3',ko3:'korean3','3-no-shift':'korean3NoShift'};
/** Convert a raw GetKeyName byte to the index actually used by the finger
 * graph17ff5. The Japanese offsets are intentionally NOT modernized to the
 * write_kdata mapping; this is the literal native lookup, including mismatch. */
export function originalFingerRawIndex(group,raw){
 if(group===3){if(raw>=130&&raw<163)return raw-130;if(raw<194)return raw-144;if(raw<211)return raw-154;return -1;}
 return group===0?raw-33:raw-129+(group===2?93:0);
}
/** Calc_Finger_Speed18212 / Sum_K_Data18053, eight fingers left to right.
 * The 'previous' branch averages saved per-glyph speeds using the original
 * occupancy flags. Current branch divides summed correct counts by summed
 * elapsed time. Compound vowels/finals contribute half their time/speed to
 * each assigned physical component. This is not an accuracy chart.
 * Several native quirks are preserved: Japanese index mismatch; impossible
 * right-pinky si==6&&si==7 branches; the final extra key's occupancy byte writes
 * into byte3 of the sum-double. That last write is simulated in a DataView,
 * never by writing outside actual JavaScript memory.
 */
export function originalFingerStats(stats,layout='korean2',{previous=false}={}){
 layout=LAYOUT_ALIASES[layout]||layout;const physical=F.rawPhysical[layout];if(!physical)throw new RangeError('Unknown original layout');
 const group=layout==='us'||layout==='dvorak'?0:layout==='hiragana'?1:layout==='katakana'?2:3;
 const language=group===0?'en':group===3?'ko':'ja';
 return Array.from({length:8},(_,finger)=>{
  let correct=0,sum=0;const flags=new Uint8Array(48),dv=new DataView(flags.buffer);const countColumns=finger===3||finger===4?2:1;let di=0;
  function add(index,direct=false){
   if(index<0)return false;const s=stats?.[`${language}:${index}`];if(!s)return false;
   if(!previous)correct+=s.correct||0;
   const value=previous?(s.speed||0):(s.seconds||0);if(!value)return false;
   sum+=value/(direct?2:1);return true;
  }
  function mark(index){
   // Original flag array begins36 bytes before the double accumulator.
   dv.setFloat64(36,sum,true);if(index>=0&&index<flags.length)flags[index]=1;sum=dv.getFloat64(36,true);
  }
  for(di=0;di<countColumns;di++)for(let row=0;row<8;row++){
   const p=F.columnStarts[finger]+di+row*13,raw=physical[p],unshifted=row>=4?physical[p-52]:0;
   if(raw!==unshifted&&add(originalFingerRawIndex(group,raw)))mark(di*8+row);
  }
  if(finger===0){if(add(originalFingerRawIndex(group,126)))mark(8);if(add(originalFingerRawIndex(group,96)))mark(9);}
  if(finger===7)for(let i=0;i<12;i++){
   const p=F.rightExtras[i],raw=physical[p],unshifted=p>=52?physical[p-52]:0;
   if(raw===unshifted||!add(originalFingerRawIndex(group,raw)))continue;
   if(i<3)di=8;else if(i<=5)di=12;else if(i===6&&i===7)di=16;else if(i===8&&i===9)di=20;else if(i===10)di=24;else if(i===11)di=28;
   mark(i+di);
  }
  if(group===3){
   const li=['korean2','korean3','korean3NoShift'].indexOf(layout),firstColumn=F.columnStarts[finger]+1,indices=li===0?0:1;
   for(const kind of ['vowel','final'])for(let i=0;i<F[`${kind}Counts`][li];i++){
    const packed=F[`${kind}Pairs`][li][i],index=F[`${kind}Indices`][indices][i]+(kind==='vowel'?19:40);
    for(let half=0;half<2;half++){
     const physicalColumn=half===0?(packed>>>12)&15:(packed>>>4)&15;
     const mergedColumn=physicalColumn===5?4:physicalColumn===7?6:physicalColumn;
     if(!physicalColumn||mergedColumn!==firstColumn||!add(index,true))continue;
     let base=physicalColumn===5||physicalColumn===7?8:0;
     if(physicalColumn>=11)base=physicalColumn===11?8:physicalColumn===12?(kind==='vowel'&&half===0?16:11):(kind==='vowel'&&half===0?24:13);
     const row=half===0?(packed>>>8)&15:packed&15;mark(base+row-1);
    }
   }
  }
  const occupied=flags.slice(0,32).reduce((a,b)=>a+(b?1:0),0);
  const speed=sum&&(previous?occupied:correct)?Math.trunc(previous?sum/occupied:correct*60/sum):0;
  return {finger,speed,chartPixels:Math.max(0,Math.min(200,Math.trunc(speed/5))),correct,seconds:previous?undefined:sum,occupied};
 });
}

/** Native chart ordinate conversion: 17dd0 count, 17ea8 speed,
 * 17f01 accuracy. Pass the already truncated displayed speed/percentage,
 * not a normalized fraction. Native speed/accuracy are signed 16-bit words.
 * Count is the native unsigned 16-bit occurrence counter. */
export function originalKeyChartHeight(value,kind='speed'){
 const integer=Math.trunc(Number(value)||0);
 if(kind==='count')return Math.min(200,Math.floor((integer&65535)/2));
 const n=(integer<<16)>>16;
 if(n<=0)return 0;
 if(kind==='accuracy')return n>=100?200:n*2;
 if(kind!=='speed')throw new RangeError('Unknown original chart kind');
 return n>=1000?200:Math.trunc(n/100)*20+Math.trunc((n%100)*0.2);
}
/** Exact color-mode filled rectangles from17f69. Coordinates are global DOS
 * pixels; rectangle width/height include both endpoint pixels. Zero ordinate
 * means no rectangle, not a one-pixel bar. yTop is the chart window top.
 * Glyph centers: EN/JP62+18*i, KO66+20*i (189e0,18cd6,18b41,18e47).
 * Finger centers:80+64*i, plus16 after the fourth finger (188f4..18943).
 * Labels are intentionally outside this helper: no inferred ink alignment.
 */
export function originalKeyChartBars(language,index,blueHeight,redHeight,{yTop=102}={}){
 const center=language==='finger'?80+64*index+(index>=4?16:0):language==='ko'?66+20*index:62+18*index;
 const baseline=yTop+240;
 const rect=(height,offset,width)=>height>0?{x:center+offset,y:baseline-height,width,height:height+1}:null;
 return {center,baseline,blue:rect(blueHeight,-4,6),red:rect(redHeight,3,5)};
}
