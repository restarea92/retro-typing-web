/** Original HTTD.exe Borland-style runtime: srand48cc, rand48dd, mul4894.
 * One explicitly owned app-launch stream starts at state1. Original srand
 * receives only16 seed bits; rand updates32 bits and returns high15 bits.
 * Gameplay uses rand()%bound, NOT floor(randomFloat*bound).
 */
export const ORIGINAL_RANDOM_MULTIPLIER=0x015a4e35;
/** Browser default supplies Unix seconds. Original time(NULL) used DOS calendar
 * plus its configured timezone/DST (default EST/EDT), so this does not promise
 * the same seed for identical displayed local clocks. Inject timeSeed for exact
 * replay. Different input timing and vocabulary call order change sequences. */
export function browserTimeSeed(){return Math.floor(Date.now()/1000)&0xffff;}
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
