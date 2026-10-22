/** Static transcription of original HTTD.exe weighting d062/d16f and metrics
 * 1022e, 10dfe/10e1b, 1a37b. Offsets are EXE file offsets. The original uses
 * weighted correct target units, not actual physical keypress counts.
 * Native runtime validation is separate from this source-derived transcription.
 */
export const ORIGINAL_LAYOUT_INDEX = Object.freeze({us:0,dvorak:1,hiragana:2,katakana:3,korean2:4,korean3:5,korean3NoShift:6,'2':4,ko2:4,'3':5,ko3:5,'3-no-shift':6});
export const BIOS_TICK_MS = 1800000 / 32767;
export const BIOS_TICKS_PER_SECOND = 32767 / 1800;
const LEADS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const VOWELS = [3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 26, 27, 28, 29];
const FINALS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
const JAMO = {"12593": 34881, "12594": 35905, "12595": 33860, "12596": 36929, "12597": 33862, "12598": 33863, "12599": 37953, "12600": 38977, "12601": 40001, "12602": 33866, "12603": 33867, "12604": 33868, "12605": 33869, "12606": 33870, "12607": 33871, "12608": 33872, "12609": 41025, "12610": 42049, "12611": 43073, "12612": 33876, "12613": 44097, "12614": 45121, "12615": 46145, "12616": 47169, "12617": 48193, "12618": 49217, "12619": 50241, "12620": 51265, "12621": 52289, "12622": 53313, "12623": 33889, "12624": 33921, "12625": 33953, "12626": 33985, "12627": 34017, "12628": 34113, "12629": 34145, "12630": 34177, "12631": 34209, "12632": 34241, "12633": 34273, "12634": 34369, "12635": 34401, "12636": 34433, "12637": 34465, "12638": 34497, "12639": 34529, "12640": 34625, "12641": 34657, "12642": 34689, "12643": 34721};
/** Encode the actual original font/input code, including custom partial-glyph
 * aliases. Returns null for text outside the original supported repertoire. */
export function originalGlyphCode(character) {
 const u=typeof character==='number'?character:String(character).codePointAt(0);
 if(!Number.isInteger(u))return null;
 if(u>=0xf0000&&u<=0xfffff)return u-0xf0000;
 if(u<128)return u;
 if(u>=0xac00&&u<=0xd7a3){const n=u-0xac00;return 0x8000|(LEADS[Math.floor(n/588)]<<10)|(VOWELS[Math.floor(n/28)%21]<<5)|FINALS[n%28];}
 if(JAMO[u]!==undefined)return JAMO[u];
 if((u>=0x3041&&u<=0x3093)||(u>=0x30a1&&u<=0x30f6))return 0x1f00+(u-0x3040);
 return null;
}
/** d062 accepts original packed code, not a Unicode code point. Numeric layout
 * is original0..6; strings use ORIGINAL_LAYOUT_INDEX. Japanese codes count1,
 * including voiced kana entered with2 physical keys. For Unicode use a string. */
export function originalKeyUnits(codeOrCharacter,layout='korean2') {
 const code=typeof codeOrCharacter==='number'?codeOrCharacter:originalGlyphCode(codeOrCharacter);
 if(code===null)return null;
 const l=typeof layout==='number'?layout:ORIGINAL_LAYOUT_INDEX[layout];
 if(!Number.isInteger(l)||l<0||l>6)throw new RangeError('Unknown original layout');
 if(!(code&0x8000))return 1;
 let units=0;
 const initial=((code>>>10)&31)-1;
 if(initial!==0){units++;if(l>=5&&[2,5,9,11,14].includes(initial))units++;}
 const vowel=((code>>>5)&31)-2;
 if(vowel!==0){units++;if([12,13,16].includes(vowel)||(vowel>18&&vowel<22))units++;if(l===4&&vowel===26)units++;}
 const final=(code&31)-1;
 if(final!==0){units++;if(l===4){if([3,5,6].includes(final)||(final>8&&final<16))units++;}else if(l===5){if([3,5].includes(final)||(final>10&&final<15))units++;}else if([2,3,5,6,19].includes(final)||(final>8&&final<16))units++;}
 return units;
}
export function originalTextUnits(text,layout='korean2') {
 // StringTypeLeng d16f parses original BYTES, checking NUL before a pending
 // lead. This matters for the two dictionary entries truncated to lone0x1f.
 let total=0,pending=0;
 for(const char of String(text)){
  const code=originalGlyphCode(char);if(code===null)return null;
  const bytes=code>255?[code>>>8,code&255]:[code];
  for(const byte of bytes){
   if(byte===0)return total;
   if(pending){total+=originalKeyUnits((pending<<8)|byte,layout);pending=0;}
   else if((byte&128)||byte===0x1f)pending=byte;
   else total++;
  }
 }
 return total;
}
/** Quantize two clock readings separately, mirroring BIOS endpoint subtraction.
 * A relative elapsed duration cannot recover the start tick's phase. */
export function originalElapsedTicks(startMs,endMs){return Math.max(0,Math.floor(endMs/BIOS_TICK_MS)-Math.floor(startMs/BIOS_TICK_MS));}
export function originalSeconds(elapsedTicks){return elapsedTicks===0?Math.fround(0.001):Math.fround(elapsedTicks*1800/32767);}
/** Caller supplies the denominator appropriate to its native mode. In completed
 * word/short lines this is FULL target weight; do not substitute entered weight.
 * Partial long/test denominator needs caller's original processed-target data.
 * elapsedMs convenience assumes a relative start at BIOS tick0; prefer explicit
 * elapsedTicks from originalElapsedTicks(start,end). Positive results truncate.
 */
export function originalMetrics({correctUnits=0,targetUnits=0,elapsedTicks,elapsedMs}){
 if(elapsedTicks===undefined){if(!Number.isFinite(elapsedMs))throw new TypeError('Supply elapsedTicks or elapsedMs');elapsedTicks=Math.max(0,Math.floor(elapsedMs/BIOS_TICK_MS));}
 const seconds=originalSeconds(Math.max(0,elapsedTicks));
 return {correctUnits,targetUnits,elapsedTicks,seconds,speed:correctUnits?Math.trunc(correctUnits*60/seconds):0,accuracy:targetUnits?Math.trunc(correctUnits*100/targetUnits):0};
}
/** Typ_Test_Result13237 differs from practice scoring. C is weighted correct
 * units; W is the number of wrong glyphs. Penalty is forcibly1 in Init_Variable
 * 19bc8 and profile save19756. Esc cancels the test; only finalized results use
 * this calculation. The misleading native 'words' labels count glyphs. */
export function originalExamMetrics({correctUnits=0,wrongGlyphs=0,usedGlyphs=0,correctGlyphs=0,elapsedTicks,elapsedMs}){
 const effectiveUnits=Math.max(correctUnits-wrongGlyphs,0);
 const m=originalMetrics({correctUnits:effectiveUnits,targetUnits:correctUnits,elapsedTicks,elapsedMs});
 return {...m,correctUnits,wrongGlyphs,effectiveUnits,usedGlyphs,correctGlyphs};
}
/** TypSound b468. Duration arguments are milliseconds to Borland delay().
 * Sound uses a PC-speaker square wave, with no gaps between type2 notes.
 * A browser's speaker/envelope/amplitude is an adaptation, not source data. */
export const ORIGINAL_SOUND_SEQUENCES=Object.freeze([
 Object.freeze([{hz:1600,ms:40}]),
 Object.freeze([{hz:800,ms:40}]),
 Object.freeze([{hz:450,ms:55},{hz:650,ms:50},{hz:1000,ms:45}])
]);
