import {originalGlyphCode} from './original-metrics.js';
/** Shared dictionary getter14863..14936 copies bytes until copiedLength>10.
 * Source data is never changed. A truncated lead byte is retained as an
 * INTERNAL U+00xx byte marker, not an invented Unicode glyph. In the supplied
 * dictionaries only two hiragana entries truncate, both ending raw0x1f. */
export function originalWordGetter(word){
 let result='',bytes=0;
 for(const character of String(word)){
  if(bytes>=11)break;
  const point=character.codePointAt(0),code=point<=255?point:originalGlyphCode(character);
  if(code===null)throw new RangeError('Dictionary word is outside the original encoded repertoire');
  const width=code>255?2:1;
  if(bytes+width>11){result+=String.fromCharCode(code>>>8);break;}
  result+=character;bytes+=width;
 }
 return result;
}
/** The word-study separator is byte0x20. After a retained kana prefix it is
 * consumed as the low byte of raw1f20 (だ), not drawn as a separate space. */
export function decodeJoinedWordPrefixes(line){return String(line).replace(/\u001f /g,'だ');}
/** Native string drawing exits on NUL before drawing a final pending lead. */
export function originalWordDisplay(word){const last=String(word).charCodeAt(String(word).length-1);return last===0x1f||(last>=0x80&&last<=0xff)?String(word).slice(0,-1):String(word);}
