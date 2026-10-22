import {createOriginalRandom,originalRandomIndex} from './original-random.js';
import {originalWordGetter,originalWordDisplay} from './original-word-getter.js';
import {ENERGY_CAPACITY,energyAfter,textColumns,hitScore} from './game-rules.js';
export const BIOS_TICK_MS=1800000/32767;
export const RAIN_EFFECT_LABELS=['빠르게..','천천히..','앞으로 앞으로','안보이지..','잠깐만 !','처음부터','되살리기','지우기','다음 놀이마당..'];
const pick=originalRandomIndex;
export function effectForRoll(roll){if(roll<1||roll>19)throw new RangeError('Special roll must be 1..19');return roll<=9?roll-1:roll<=15?roll-10:roll-16;}
/** The original three static spawn bytes survive stages and separate games.
 * The app owns one instance for its launch; omitted memory is test-isolated. */
export function createRainSpawnMemory(){return {skipCounter:0,sinceSpecial:0,pending:false};}
/** Native ten-slot bonus record buffer, shared by both games for one launch.
 * CJK initialization overwrites only its first five entries. */
export function createGameWordMemory(){return {bonusWords:Array(10).fill('')};}
/** a5fb keeps0x1f pending; a60f exits on NUL before drawing that prefix.
 * Comparison/byte width retains the suffix; only visible text omits it. */
export const gameWordDisplay=originalWordDisplay;
function selectGameWord(pool,random){
 if(!pool.length)return 'HTT!!!'; // Guard the native zero-divisor failure.
 for(let attempt=0;attempt<52;attempt++){const word=pool[pick(pool.length,random)];if(word)return originalWordGetter(word);}
 return 'HTT!!!'; // Original DS7030 fallback after empty dictionary results.
}
function preselectGameWords(pool,random,language,wordMemory){
 const selectedWords=Array.from({length:60},()=>selectGameWord(pool,random));
 const english=language?language==='en':!pool.some(word=>Array.from(word).some(c=>c.codePointAt(0)>255));
 for(let index=0;index<(english?10:5);index++)wordMemory.bonusWords[index]=selectGameWord(pool,random);
 return {selectedWords,bonusWords:wordMemory.bonusWords};
}
export function createRainStage(stage,pool,{energy=ENERGY_CAPACITY,random=createOriginalRandom(),spawnMemory=createRainSpawnMemory(),wordMemory=createGameWordMemory(),language}={}){
 random.reseedFromTime?.();
 const {selectedWords,bonusWords}=preselectGameWords(pool,random,language,wordMemory);
 const zero=Math.max(0,Math.min(13,stage-1));
 return {stage:zero+1,pool,selectedWords,bonusWords,energy,interval:18-zero,lastIndex:25+zero*2,spawned:0,firstRemaining:0,spawnMemory,
  get skipCounter(){return spawnMemory.skipCounter;},set skipCounter(value){spawnMemory.skipCounter=value&255;},
  get sinceSpecial(){return spawnMemory.sinceSpecial;},set sinceSpecial(value){spawnMemory.sinceSpecial=value&255;},
  words:[],concealUntil:0,pauseUntil:0,rewinding:false,burstRemaining:0,clearing:false,awaitingNext:false,complete:false,random};
}
// Native record state persists while a rewound word is no longer visible.
const rainRecordState=word=>word?.nativeState??(word?.active?(word.special?2:1):0);
function removeRainWord(word){word.active=false;word.nativeState=0;}
function updateFirst(state){while(state.firstRemaining<state.spawned&&!state.words[state.firstRemaining]?.active)state.firstRemaining++;state.complete=state.firstRemaining>state.lastIndex;return state;}
export function rainWordFalls(word){const bottom=word.y+32,right=word.x+textColumns(word.word)*8;return bottom>439&&((word.x>268&&word.x<372)||(right>268&&right<372)||bottom>461);}
/** One original16px motion, then a spawn attempt. Mutates the supplied stage
 * and its explicitly shared app-launch spawn memory. */
export function tickRain(state){
 if(state.complete||state.energy<=0||state.awaitingNext)return {points:0};
 if(state.rewinding){
  // 15eb7 scans from spawnedCount INCLUSIVE, including a deferred spawn.
  // Leaving the top decrements the count but preserves native state and y.
  for(let index=state.spawned;index>=state.rewindStart;index--){
   const word=state.words[index],recordState=rainRecordState(word);if(!recordState)continue;word.nativeState=recordState;
   if(word.y-16<47){
    word.active=false;state.spawned--;
    if(state.spawned<state.rewindStart){
     state.spawned=state.rewindStart;state.firstRemaining=state.rewindStart;
     state.rewinding=false;state.interval=state.rewindInterval;return {points:0};
    }
   }else word.y-=16;
  }
  return {points:0};
 }
 if(state.clearing){const word=state.words.find(w=>w?.active);if(word){removeRainWord(word);updateFirst(state);return {points:hitScore(word.word)};}state.clearing=false;return {points:0};}
 for(const word of state.words){if(!word?.active)continue;if(rainWordFalls(word)){removeRainWord(word);state.energy=energyAfter(state.energy,word.special?1:-1);if(state.energy<=0){updateFirst(state);return {points:0};}}else word.y+=16;}
 updateFirst(state);if(state.complete||state.energy<=0)return {points:0};
 if(state.spawned<=state.lastIndex){
  let spawn=pick(4,state.random)===0;
  if(!spawn){state.skipCounter++;if(state.skipCounter>=3){state.skipCounter=0;spawn=true;}}
  if(spawn){
   let candidate=state.words[state.spawned];
   if(state.spawnMemory.pending){
    // Gate first, then reuse this stage's CURRENT slot. A new stage resets
    // records to state0, so a surviving flag consumes one attempt only.
    state.spawnMemory.pending=false;
    if(!rainRecordState(candidate))return {points:0};
   }else{
    // InitTypingData preselects all60 ordinary slots before gameplay.
    const word=candidate?.word??state.selectedWords[state.spawned]??'';
    const x=pick(Math.max(1,81-textColumns(word)),state.random)*8;
    const special=state.sinceSpecial>8&&pick(3,state.random)===0;
    if(special)state.sinceSpecial=0;
    candidate={id:state.spawned,word,x,y:47,special,active:false,nativeState:special?2:1};
    state.words[state.spawned]=candidate;
    if(x+textColumns(word)*8>631){candidate.y=48;state.spawnMemory.pending=true;return {points:0};}
   }
   candidate.active=true;state.sinceSpecial++;state.spawned++;
  }
 }
 updateFirst(state);return {points:0};
}
export function hitRain(state,text){const word=state.words.find(w=>w?.active&&w.word===text);if(!word)return {matched:false,points:0,effect:null};removeRainWord(word);updateFirst(state);let effect=null;if(word.special&&!state.complete){state.random.reseedFromTime?.();effect=effectForRoll(pick(19,state.random)+1);}return {matched:true,points:hitScore(word.word),effect};}
export function applyRainEffect(state,effect,now){
 if(effect===0)state.interval=Math.max(2,state.interval-1);
 else if(effect===1)state.interval+=2;
 else if(effect===2)state.burstRemaining=3;
 else if(effect===3)state.concealUntil=now+60*BIOS_TICK_MS;
 else if(effect===4)state.pauseUntil=now+160*BIOS_TICK_MS;
 else if(effect===5&&state.firstRemaining<state.spawned){state.rewinding=true;state.rewindStart=state.firstRemaining;state.rewindInterval=state.interval;state.interval=1;}
 else if(effect===6)state.energy=ENERGY_CAPACITY;
 else if(effect===7)state.clearing=true;
 else if(effect===8)state.awaitingNext=true;
 return RAIN_EFFECT_LABELS[effect]||'';
}

export function createInvadersStage(stage,pool,{random=createOriginalRandom(),wordMemory=createGameWordMemory(),language}={}){
 random.reseedFromTime?.();
 const {selectedWords,bonusWords}=preselectGameWords(pool,random,language,wordMemory);
 const zero=Math.max(0,Math.min(13,stage-1)),activeColumns=3+Math.min(3,Math.floor(zero/3));
 return {stage:zero+1,pool,selectedWords,bonusWords,columns:Array.from({length:6},(_,c)=>({x:6+c*12,count:10,words:selectedWords.slice(c*10,c*10+10)})),left:0,right:activeColumns-1,y:47,direction:1,interval:20-zero,normalKills:0,bonusIndex:0,bonus:null,concealed:[],concealUntil:0,pauseUntil:0,forcedDown:0,awaitingNext:false,complete:false,defeated:false,random};
}
const invaderHeight=state=>Math.max(0,...state.columns.slice(state.left,state.right+1).map(c=>c.count));
const columnWidth=(column,full=false)=>Math.max(0,...column.words.slice(0,full?10:column.count).map(w=>(textColumns(w)+1)&~1));
function trimInvaders(state){while(state.left<=state.right&&!state.columns[state.left].count)state.left++;while(state.right>=state.left&&!state.columns[state.right].count)state.right--;state.complete=state.left>state.right;state.defeated=!state.complete&&state.y+16*invaderHeight(state)>442;}
export function tickInvaders(state,{forceDown=false}={}){
 if(state.complete||state.defeated||state.awaitingNext)return;
 const edge=state.direction>0?state.columns[state.right]:state.columns[state.left];
 const boundary=forceDown||(state.direction>0?edge.x+columnWidth(edge)>79:edge.x<=0);
 if(boundary){state.y+=16;state.direction*=-1;}else for(let c=state.left;c<=state.right;c++)state.columns[c].x+=state.direction*2;
 trimInvaders(state);
}
export function tickInvaderBonus(state,now){if(!state.bonus||now<state.bonus.nextMove)return;const bonus=state.bonus;if(bonus.x+textColumns(bonus.word)>79){state.bonus=null;state.bonusIndex++;return;}bonus.x+=2;bonus.nextMove=now+7*BIOS_TICK_MS;}
function maybeSpawnBonus(state,now){if(state.normalKills>9&&!state.bonus&&state.y!==47&&state.bonusIndex<9){state.bonus={word:state.bonusWords[state.bonusIndex]||'',x:2,y:47,nextMove:now};state.normalKills=0;}}
export function hitInvaders(state,text,now=0){
 if(state.bonus?.word===text){state.random.reseedFromTime?.();const effect=effectForRoll(pick(19,state.random)+1);state.bonus=null;state.bonusIndex++;return {matched:true,points:hitScore(text),effect};}
 let found=-1;
 for(let c=state.direction>0?state.right:state.left;state.direction>0?c>=state.left:c<=state.right;c-=state.direction){const col=state.columns[c];if(col.count&&col.words[col.count-1]===text){found=c;break;}}
 if(found<0)return {matched:false,points:0,effect:null};
 const beforeHeight=invaderHeight(state),oldLeft=state.left,oldRight=state.right,column=state.columns[found];column.count--;if(!state.bonus)state.normalKills++;
 let reduction=0;if(!state.columns[oldLeft].count)reduction++;if(oldRight!==oldLeft&&!state.columns[oldRight].count)reduction++;
 if(!column.count&&found>oldLeft&&found<oldRight)reduction++;
 trimInvaders(state);if(invaderHeight(state)!==beforeHeight)reduction++;
 state.interval=Math.max(2,state.interval-reduction);if(!state.complete)maybeSpawnBonus(state,now);
 return {matched:true,points:hitScore(text),effect:null};
}
export function applyInvadersEffect(state,effect,now){
 if(effect===0)state.interval=Math.max(3,state.interval-2);
 else if(effect===1)state.interval+=2;
 else if(effect===2)state.forcedDown=2;
 else if(effect===3){state.concealed=[];for(let c=state.left;c<=state.right;c++)if(state.columns[c].count)state.concealed.push(`${c}:${state.columns[c].count-1}`);state.concealUntil=now+120*BIOS_TICK_MS;}
 else if(effect===4)state.pauseUntil=now+180*BIOS_TICK_MS;
 else if(effect===5)state.y=47;
 else if(effect===6){for(let c=state.left;c<=state.right;c++){if(c===state.right&&state.columns[c].x+columnWidth(state.columns[c],true)>79)continue;state.columns[c].count=10;}trimInvaders(state);}
 else if(effect===7){if(state.left<=state.right)state.columns[state.direction>0?state.right:state.left].count=0;trimInvaders(state);}
 else if(effect===8)state.awaitingNext=true;
 return RAIN_EFFECT_LABELS[effect]||'';
}
