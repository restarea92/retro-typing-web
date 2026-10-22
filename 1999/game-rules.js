// Only these arithmetic rules are verified from the original executable.
export const ENERGY_CAPACITY=17;
export const INITIAL_SCORE=10;
/** Native game input accepts only committed returned cells. A double-byte cell
 * that would cross capacity is rejected; hitting ten submits before the next
 * requeued cell. Pending composition is not part of this byte-count buffer. */
export function acceptGameCommittedInput(text){
 const submitted=[];let remaining='',columns=0;
 for(const c of Array.from(text)){
  const width=textColumns(c);if(columns+width>10)continue;
  remaining+=c;columns+=width;
  if(columns===10){submitted.push(remaining);remaining='';columns=0;}
 }
 return {submitted,remaining};
}
export function textColumns(text){return Array.from(text).reduce((n,c)=>n+(c.codePointAt(0)>255?2:1),0)}
export function hitScore(text){return 10*(Math.floor(textColumns(text)/2)+1)}
export function stageBonus(correct,incorrect){const accuracy=correct+incorrect?Math.floor(correct*100/(correct+incorrect)):0;return 500+(accuracy>=90?500:0)}
export function energyAfter(value,change){return Math.max(0,Math.min(ENERGY_CAPACITY,value+Math.sign(change)))}
