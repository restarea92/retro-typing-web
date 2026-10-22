// Advancement thresholds reconstructed from the original call paths.
export function advancePractice({stages,savedStage=1,mode,selectedStage=0,accuracy=0,cpm=0,elapsedMs=0,lastDate='',today,settings}){
 const current=stages[savedStage-1];if(!current)return {savedStage,lastDate};
 const category=mode==='sentences'?'short':mode==='exam'?'test':mode;
 if(current.mode!==category||accuracy<settings.targetAccuracy)return {savedStage,lastDate};
 if(category!=='keys'&&cpm<settings.targetSpeed)return {savedStage,lastDate};
 if(['keys','words'].includes(category)){if(current.subIndex!==selectedStage)return {savedStage,lastDate};}
 else {if(lastDate===today)return {savedStage,lastDate};if(['long','test'].includes(category)&&elapsedMs<1200000)return {savedStage,lastDate};lastDate=today;}
 return {savedStage:Math.min(stages.length,savedStage+1),lastDate};
}

/** Compatibility-only bug at138cf..1391f. Exam RESULT/HISTORY use max(C-W,0),
 * but progression initializes its positive-C numerator with W and replaces it
 * only when C>W. Keep this isolated from all displayed scoring. */
export function originalExamProgressionUnits(correctUnits,wrongGlyphs){
 const correct=Math.max(0,correctUnits),wrong=Math.max(0,wrongGlyphs);
 return {correct:correct>0?(correct>wrong?correct-wrong:wrong):0,entered:correct};
}
