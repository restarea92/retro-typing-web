import test from'node:test';import assert from'node:assert/strict';import{webQaUrl,describeRng,inspectExecutableRng,describeDosReady}from'../source/qa-rng.js';
import{originalQaSeed}from'../../original-random.js';
test('workbench forwards seed values without weakening strict app parser',()=>{
 assert.equal(webQaUrl(''),'../?qa=1');assert.equal(webQaUrl('?qaRngSeed=12345'),'../?qa=1&qaRngSeed=12345');
 for(const value of['0','65535','65536','-1','','01'])assert.equal(originalQaSeed(webQaUrl('?qaRngSeed='+value).slice(3)),originalQaSeed('?qa=1&qaRngSeed='+value));
 assert.equal(originalQaSeed(webQaUrl('?qaRngSeed=1&qaRngSeed=1').slice(3)),null);
});
test('seed match status requires verified DOS copy and never promises gameplay/timing',()=>{
 const web={mode:'qa-fixed-reseed',qaSeed:42,initialSeed:1};
 for(const dos of[null,{mode:'original-dos-time',verified:true},{mode:'qa-fixed-reseed',qaSeed:42,initialSeed:1,verified:false},{mode:'qa-fixed-reseed',qaSeed:43,initialSeed:1,verified:true}])assert.equal(describeRng(web,dos).seedSetupMatched,false);
 const matched=describeRng(web,{mode:'qa-fixed-reseed',qaSeed:42,initialSeed:1,verified:true});assert.equal(matched.seedSetupMatched,true);assert.equal(matched.timingSynchronized,false);assert.equal(matched.gameplaySynchronized,false);assert.match(matched.text,/자동 동기화되지/);
});
test('unknown executable never receives trusted seed provenance and input remains unchanged',async()=>{
 const bytes=new Uint8Array(0x48d8);bytes.set([0xb8,42,0],0x48cf);const before=bytes.slice(),result=await inspectExecutableRng(bytes);assert.equal(result.verified,false);assert.equal(result.mode,'unverified');assert.deepEqual(bytes,before);assert.ok(Object.isFrozen(result));
});

test('unloaded and unverified DOS provenance is never called original or time-seeded',()=>{
 const web={mode:'original-dos-time',initialSeed:1};
 assert.match(describeRng(web,null).text,/DOS 파일 로드 대기/);
 for(const dos of [{mode:'unverified',verified:false},{mode:'original-dos-time',verified:false},{mode:'qa-fixed-reseed',qaSeed:42,verified:false}]){
  const result=describeRng(web,dos);assert.match(result.text,/DOS 원본·시드 미확인/);assert.equal(result.seedSetupMatched,false);assert.match(describeDosReady(dos),/원본·시드 미확인/);
 }
 assert.match(describeDosReady(null),/원본·시드 미확인/);
 assert.equal(describeDosReady({mode:'original-dos-time',verified:true}),'원본 준비 완료 · 시간 시드');
 assert.match(describeDosReady({mode:'qa-fixed-reseed',verified:true,qaSeed:42}),/QA 복사본 준비 완료 · 재시드 42/);
 assert.match(describeRng(web,{mode:'original-dos-time',verified:true}).text,/원본 시간 시드 모드/);
 assert.match(describeRng({mode:'qa-fixed-reseed',qaSeed:42,initialSeed:1},null).text,/DOS 파일 로드 대기.*웹만 QA 재시드 42/);
});
