import {insertOriginalGameScore,insertOriginalExamRecord} from './original-records.js';
export const localRecordDate=(date=new Date())=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
export function loadOriginalGameScores(storage){
 try{const rows=JSON.parse(storage.getItem('retro-game-records-v1')||'[]');if(!Array.isArray(rows))return [];return rows.filter(r=>Number.isFinite(r.score)&&Number.isFinite(r.stage)).reduce((out,row)=>insertOriginalGameScore(out,row).records,[]);}catch{return [];}
}
export function loadOriginalExamRecords(storage,legacy=[]){
 try{const state=JSON.parse(storage.getItem('retro-native-exam-records-v1')||'null');if(state&&Array.isArray(state.recent))return {top:state.top||null,recent:state.recent.slice(0,10)};}catch{}
 return legacy.filter(r=>r.mode==='exam').reduce((state,r)=>insertOriginalExamRecord(state,{...r,effectiveUnits:r.valid??Math.max(0,(r.correct||0)-(r.errors||0)),seconds:(r.elapsedMs||0)/1000}),{top:null,recent:[]});
}
export function saveOriginalExamRecord(state,record,storage){
 const next=insertOriginalExamRecord(state,{...record,effectiveUnits:record.valid??Math.max(0,(record.correct||0)-(record.errors||0)),seconds:(record.elapsedMs||0)/1000});
 try{storage.setItem('retro-native-exam-records-v1',JSON.stringify(next));}catch{}return next;
}
