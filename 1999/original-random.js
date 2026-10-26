import { originalBrowserTimeSeed } from './original-dos-time.js';
/** Original HTTD.exe Borland-style runtime: srand48cc, rand48dd, mul4894.
 * One explicitly owned app-launch stream starts at state1. Original srand
 * receives only16 seed bits; rand updates32 bits and returns high15 bits.
 * Gameplay uses rand()%bound, NOT floor(randomFloat*bound).
 */
export const ORIGINAL_RANDOM_MULTIPLIER=0x015a4e35;
/** Production follows the original DOS calendar/time conversion, not a fixed
 * QA seed. Inject timeSeed to replay the five native reseed boundaries.
 * Equal seeds do not align event timing or random-call order by themselves. */
export const browserTimeSeed=originalBrowserTimeSeed;
export function createOriginalRandom(initialSeed=1,{timeSeed=browserTimeSeed}={}){
 let state=1;
 const random=()=>random.nextInt()/32768;
 random.seed=value=>{if(!Number.isFinite(value))throw new RangeError('Seed must be finite');state=Math.trunc(value)&0xffff;return state;};
 random.nextInt=()=>{state=(Math.imul(state,ORIGINAL_RANDOM_MULTIPLIER)+1)>>>0;return (state>>>16)&0x7fff;};
 random.modulo=maximum=>{
  // Valid recovered callers use positive signed16-bit divisors. A zero native
  // divisor faults; JavaScript rejects it explicitly instead of crashing DOS.
  if(!Number.isInteger(maximum)||maximum<1||maximum>0x7fff)throw new RangeError('Random bound must be1..32767');
  return random.nextInt()%maximum;
 };
 random.reseedFromTime=()=>random.seed(timeSeed());
 Object.defineProperty(random,'state',{get:()=>state});random.seed(initialSeed);return random;
}
/** Compatibility for explicitly injected floating random fixtures. Production
 * should pass the shared original generator so modulo semantics are retained.
 * Empty optional pools are guarded without consuming the stream. */
export function originalRandomIndex(maximum,random){
 if(!Number.isInteger(maximum)||maximum<=0)return 0;
 return random.modulo?random.modulo(maximum):Math.min(maximum-1,Math.floor(Math.max(0,random())*maximum));
}
/** Explicit QA-only URL contract. Invalid/ambiguous values never fix production
 * randomness. Canonical decimal0..65535, exactly one qa=1 and qaRngSeed value. */
export function originalQaSeed(search=''){
 const params=new URLSearchParams(search),flags=params.getAll('qa'),seeds=params.getAll('qaRngSeed');
 if(flags.length!==1||flags[0]!=='1'||seeds.length!==1||!/^(?:0|[1-9]\d{0,4})$/.test(seeds[0]))return null;
 const seed=Number(seeds[0]);return seed<=65535?seed:null;
}
/** Own exactly one stream per app launch. QA fixes reseeds, NOT the initial
 * state1, elapsed time, event order, word data, or any game state. */
export function createOriginalAppRandom(search='',{timeSeed=browserTimeSeed}={}){
 const qaSeed=originalQaSeed(search),random=createOriginalRandom(1,{timeSeed:qaSeed===null?timeSeed:()=>qaSeed});
 Object.defineProperty(random,'configuration',{value:Object.freeze({mode:qaSeed===null?'original-dos-time':'qa-fixed-reseed',initialSeed:1,qaSeed,clockPolicy:'DOS local calendar; default EST5EDT; legacy DST',timingSynchronized:false})});
 return random;
}
