import { originalRandomIndex } from './original-random.js';
/** Rules verified against 1997 _HTTD_.EXE TypingKey (file 0xfa1b), not the unrelated
 * key-list routine. Values are physical ASCII keys before layout conversion. */
export function fingerHomeKey(index){
 let column=(index%52)%13;
 column=Math.min(9,column);
 if(column===4)column=3;
 if(column===5)column=6;
 return 'asdfghjkl;'[column];
}
export function createKeyDrill(pool,{stage=0,rounds=120,repeat=false,position=0}={}){
 if(!pool?.physicalKeys?.length)throw new Error('A non-empty original key pool is required');
 return {pool,stage,rounds,repeat,position:Math.max(0,position)%pool.physicalKeys.length,phase:'target',phaseCorrect:0,completedTargets:0,correct:0,incorrect:0,finished:false};
}
export function requestedKey(state){return state.phase==='home'?fingerHomeKey(state.pool.keyIndices[state.position]):state.pool.physicalKeys[state.position];}
export function remainingKeyRounds(state){return Math.max(0,state.rounds-Math.floor(state.completedTargets/state.pool.physicalKeys.length));}
export function pressKeyDrill(state,physicalKey,random=Math.random){
 if(state.finished)return state;
 const next={...state};
 if(physicalKey!==requestedKey(state)){next.incorrect++;return next;}
 next.correct++;next.phaseCorrect++;
 if(next.phaseCorrect<(state.repeat?4:1))return next;
 next.phaseCorrect=0;
 if(state.phase==='target'&&state.stage>0){next.phase='home';return next;}
 next.phase='target';next.completedTargets++;
 const size=state.pool.physicalKeys.length;
 if(next.completedTargets>=state.rounds*size){next.finished=true;return next;}
 next.position=next.completedTargets<size?(state.position+1)%size:originalRandomIndex(size,random);
 return next;
}

/** 1997 key-accuracy helper at file0xf915 intentionally truncates correct*100
 * to signed16 bits before CWD/IDIV. The 1999 helper uses32-bit arithmetic.
 * A native divide fault has no numeric result; the web boundary returns0. */
export function originalKeyAccuracy(correct,incorrect){
 const signed16=value=>(Math.trunc(Number(value)||0)<<16)>>16;
 const c=signed16(correct);if(c===0)return 0;
 const numerator=signed16(c*100),denominator=signed16(c+signed16(incorrect));
 if(denominator===0||(numerator===-32768&&denominator===-1))return 0;
 const value=Math.trunc(numerator/denominator);return value===0?0:value;
}
