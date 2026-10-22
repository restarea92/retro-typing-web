import test from 'node:test';import assert from 'node:assert/strict';import {advancePractice} from '../progression.js';
const settings={targetSpeed:150,targetAccuracy:90};
const run=(mode,rest={})=>advancePractice({stages:[{mode,subIndex:0},{mode,subIndex:1}],mode,savedStage:1,selectedStage:0,accuracy:95,cpm:180,settings,today:'2026-10-22',...rest});
test('key advancement needs accuracy but not speed or20min',()=>assert.equal(run('keys',{cpm:0}).savedStage,2));
test('word advancement requires selected stage and speed',()=>{assert.equal(run('words',{cpm:140}).savedStage,1);assert.equal(run('words',{selectedStage:1}).savedStage,1)});
test('short advances once per local date, no20min condition',()=>{assert.equal(run('short').savedStage,2);assert.equal(run('short',{lastDate:'2026-10-22'}).savedStage,1)});
test('long requires20minutes and target metrics',()=>{assert.equal(run('long',{elapsedMs:1199999}).savedStage,1);assert.equal(run('long',{elapsedMs:1200000}).savedStage,2)});

import {originalExamProgressionUnits} from '../progression.js';
test('exam progression alone retains native non-clamping legacy branch',()=>{assert.deepEqual(originalExamProgressionUnits(10,2),{correct:8,entered:10});assert.deepEqual(originalExamProgressionUnits(2,5),{correct:5,entered:2});assert.deepEqual(originalExamProgressionUnits(0,5),{correct:0,entered:0});});
