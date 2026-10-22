import { originalRandomIndex } from './original-random.js';
/** Rules verified against HTTD TypingKey (file 0xf675), not the unrelated
 * key-list routine. Values are physical ASCII keys before layout conversion. */
export function fingerHomeKey(index){
 let column=(index%52)%13;
 column=Math.min(9,column);
 if(column===4)column=3;
 if(column===5)column=6;
 return 'asdfghjkl;'[column];
}
export function createKeyDrill(pool,{stage=0,rounds=100,repeat=false,position=0}={}){
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
