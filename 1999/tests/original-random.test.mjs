import test from 'node:test';import assert from 'node:assert/strict';
import {createOriginalRandom,originalRandomIndex} from '../original-random.js';
test('original LCG fixed vectors match independent32-bit integer transcription',()=>{
 for(const [seed,expected,last]of [[0,[0,346,130,10982,1090,11656,7117,17595,6415,22948],1503962414],[1,[346,130,10982,1090,11656,7117,17595,6415,22948,31126],4187371143],[65535,[19674,22826,13739,4027,10529,13036,25308,13768,17294,19212],1259082709],[0x12345678,[30874,10618,27756,2824,20539,1973,14837,28750,4370,31156],2041883878]]){
  const r=createOriginalRandom(seed);assert.deepEqual(Array.from({length:10},()=>r.nextInt()),expected);assert.equal(r.state,last);
 }
});
test('original LCG long run agrees with BigInt multiplication and masks srand to16bits',()=>{
 const r=createOriginalRandom(-1);let reference=65535n;for(let i=0;i<10000;i++){reference=(reference*0x015a4e35n+1n)&0xffffffffn;assert.equal(r.nextInt(),Number((reference>>16n)&0x7fffn));assert.equal(r.state,Number(reference));}
 r.seed(65536);assert.equal(r.state,0);assert.equal(r.nextInt(),0);
});
test('original selection uses remainder rather than scaled floating-point values',()=>{
 const r=createOriginalRandom(1);assert.equal(originalRandomIndex(19,r),346%19);assert.equal(r.modulo(4),130%4);
 assert.equal(originalRandomIndex(4,()=>0.75),3);const state=r.state;assert.equal(originalRandomIndex(0,r),0);assert.equal(r.state,state);
 for(const value of[0,-1,1.5,32768,NaN])assert.throws(()=>r.modulo(value),RangeError);assert.throws(()=>r.seed(Infinity),RangeError);
});
test('shared stream and injectable time reseeds are explicit, never hidden global state',()=>{
 let time=123;const r=createOriginalRandom(1,{timeSeed:()=>time}),independent=createOriginalRandom(1);assert.equal(r.nextInt(),346);assert.equal(independent.nextInt(),346);
 r.reseedFromTime();assert.equal(r.state,123);assert.equal(r.nextInt(),createOriginalRandom(123).nextInt());time=65537;r.reseedFromTime();assert.equal(r.state,1);assert.equal(r.nextInt(),346);
});
