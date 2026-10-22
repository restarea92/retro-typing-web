import test from 'node:test';import assert from 'node:assert/strict';
import {localRecordDate,loadOriginalGameScores,loadOriginalExamRecords,saveOriginalExamRecord} from '../original-record-store.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
test('legacy game records migrate to native global score ranking',()=>{const s=memory();s.setItem('retro-game-records-v1',JSON.stringify([{score:10,stage:1},{score:30,stage:1},{score:20,stage:2}]));assert.deepEqual(loadOriginalGameScores(s).map(r=>r.score),[30,20,10]);});
test('native exam top survives the bounded generic practice log',()=>{const s=memory();let state=loadOriginalExamRecords(s);state=saveOriginalExamRecord(state,{correct:1000,errors:0,elapsedMs:300000},s);for(let i=0;i<15;i++)state=saveOriginalExamRecord(state,{correct:1,errors:0,elapsedMs:300000},s);assert.equal(state.top.correct,1000);assert.equal(state.recent.length,10);assert.equal(loadOriginalExamRecords(s).top.correct,1000);});
test('record dates use caller-local calendar fields',()=>{assert.equal(localRecordDate({getFullYear:()=>2026,getMonth:()=>9,getDate:()=>2}),'2026-10-02');});
